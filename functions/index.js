// functions/index.js
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");
const cheerio = require("cheerio");
const { Pinecone } = require("@pinecone-database/pinecone");
const OpenAI = require("openai");

admin.initializeApp();

// PROD
const openaiApiKey = functions.config().openai?.key;
const pineconeApiKey = functions.config().pinecone?.key;
const pineconeIndexName = functions.config().pinecone?.index;

// DEV
//const openaiApiKey = process.env.OPENAI_API_KEY;
//const pineconeApiKey = process.env.PINECONE_API_KEY;
//const pineconeIndexName = process.env.PINECONE_INDEX_NAME;

// Check if required environment variables are available
if (!openaiApiKey || !pineconeApiKey || !pineconeIndexName) {
  console.error(
    "Missing required environment variables. Please set OPENAI_API_KEY, PINECONE_API_KEY, and PINECONE_INDEX_NAME."
  );
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: openaiApiKey,
});

const pc = new Pinecone({
  apiKey: pineconeApiKey,
});

exports.scrapeAndIndexBookmark = functions.firestore
  .document("bookmarks/{bookmarkId}")
  .onCreate(async (snap, context) => {
    const bookmark = snap.data();
    const { url, userId, projectId } = bookmark;

    if (!projectId) {
      console.error(
        `No projectId found for bookmark ${context.params.bookmarkId}`
      );
      return;
    }

    try {
      // Scrape website content
      const response = await axios.get(url);
      const html = response.data;
      const $ = cheerio.load(html);
      const bodyText = $("body").text().trim();
      const cleanedText = bodyText.replace(/\s+/g, " ").trim();

      // Chunk the text
      const chunkSize = 1000;
      const chunks = [];
      for (let i = 0; i < cleanedText.length; i += chunkSize) {
        chunks.push(cleanedText.slice(i, i + chunkSize));
      }

      // Initialize Pinecone index
      if (!pineconeApiKey || !pineconeIndexName) {
        throw new Error(
          "Pinecone configuration is incomplete. Please check your Firebase Functions config."
        );
      }

      const index = pc.Index(pineconeIndexName);

      // Create embeddings and index chunks
      for (let i = 0; i < chunks.length; i++) {
        const embedding = await createEmbedding(chunks[i]);
        await index.upsert([
          {
            id: `${userId}-${projectId}-bookmark-${context.params.bookmarkId}-${i}`,
            values: embedding,
            metadata: {
              userId,
              projectId,
              type: "bookmark",
              content: chunks[i],
              url,
              chunkIndex: i,
            },
          },
        ]);
      }

      // Update bookmark document to indicate successful indexing
      await snap.ref.update({ indexed: true });

      console.log(`Successfully scraped and indexed bookmark: ${url}`);
    } catch (error) {
      console.error(`Error processing bookmark ${url}:`, error);
      // You might want to update the bookmark document to indicate failed indexing
      await snap.ref.update({ indexed: false, error: error.message });
    }
  });

async function createEmbedding(text) {
  const response = await openai.embeddings.create({
    model: "text-embedding-ada-002",
    input: text,
  });

  return response.data[0].embedding;
}

exports.cleanupPineconeVectors = functions.pubsub
  .schedule("every 12 hours")
  .onRun(async (context) => {
    const db = admin.firestore();
    const index = pc.Index(pineconeIndexName);

    try {
      // Fetch all document IDs from Firestore for notes and tasks
      const notesSnapshot = await db.collectionGroup("notes").get();
      const tasksSnapshot = await db.collectionGroup("tasks").get();

      const validIds = new Set([
        ...notesSnapshot.docs.map(
          (doc) => `${doc.data().userId}-${doc.data().projectId}-${doc.id}`
        ),
        ...tasksSnapshot.docs.map(
          (doc) => `${doc.data().userId}-${doc.data().projectId}-${doc.id}`
        ),
      ]);

      console.log(`Found ${validIds.size} valid note/task IDs`);

      // Fetch all bookmarks from Firestore
      const bookmarksSnapshot = await db.collectionGroup("bookmarks").get();
      const validBookmarks = new Set(
        bookmarksSnapshot.docs.map(
          (doc) =>
            `${doc.data().userId}-${doc.data().projectId}-${doc.id}-${
              doc.data().url
            }`
        )
      );

      console.log(`Found ${validBookmarks.size} valid bookmark IDs`);

      // Fetch all vector IDs from Pinecone
      const queryResponse = await index.query({
        vector: Array(1536).fill(0), // Assuming 1536 is your vector dimension
        topK: 10000, // Adjust based on your expected maximum number of vectors
        includeMetadata: true,
      });

      console.log(
        `Retrieved ${queryResponse.matches.length} vectors from Pinecone`
      );

      const idsToDelete = [];

      queryResponse.matches.forEach((match) => {
        const [userId, projectId, type, docId, ...rest] = match.id.split("-");

        if (type === "bookmark") {
          // For bookmarks, check against the URL in metadata
          if (
            !validBookmarks.has(
              `${userId}-${projectId}-${docId}-${match.metadata.url}`
            )
          ) {
            idsToDelete.push(match.id);
          }
        } else {
          // For notes and tasks, check against the document ID
          if (!validIds.has(`${userId}-${projectId}-${docId}`)) {
            idsToDelete.push(match.id);
          }
        }
      });

      console.log(`Identified ${idsToDelete.length} vectors to delete`);

      if (idsToDelete.length > 0) {
        // Implement batch deletion
        const batchSize = 1000;
        for (let i = 0; i < idsToDelete.length; i += batchSize) {
          const batch = idsToDelete.slice(i, i + batchSize);
          await index.deleteMany(batch);
          console.log(`Deleted batch of ${batch.length} vectors from Pinecone`);
        }
        console.log(
          `Successfully deleted all ${idsToDelete.length} vectors from Pinecone`
        );
      } else {
        console.log("No vectors to delete");
      }

      return null;
    } catch (error) {
      console.error("Error in cleanupPineconeVectors:", error);
      return null;
    }
  });

exports.indexTaskOrNote = functions.firestore
  .document("{collectionName}/{docId}")
  .onCreate(async (snap, context) => {
    const { collectionName, docId } = context.params;
    if (collectionName !== "tasks" && collectionName !== "notes") return;

    const data = snap.data();
    const { content, userId, priority, projectId } = data;

    if (!projectId) {
      console.error(`No projectId found for ${collectionName} ${docId}`);
      return;
    }

    try {
      // Initialize Pinecone index
      const index = pc.Index(pineconeIndexName);

      let metadata = {
        userId,
        projectId,
        type: collectionName.slice(0, -1),
        content,
      };

      if (collectionName === "tasks" && priority) {
        metadata.priority = priority;
      }

      // Create embedding
      const embedding = await createEmbedding(content);

      // Index the task or note
      await index.upsert([
        {
          id: `${userId}-${projectId}-${collectionName.slice(0, -1)}-${docId}`,
          values: embedding,
          metadata: metadata,
        },
      ]);

      // Update document to indicate successful indexing
      await snap.ref.update({ indexedInPinecone: true });

      console.log(
        `Successfully indexed ${collectionName.slice(
          0,
          -1
        )} with ID: ${docId} for project: ${projectId}`
      );
    } catch (error) {
      console.error(
        `Error indexing ${collectionName.slice(0, -1)} ${docId}:`,
        error
      );
      // Update document to indicate failed indexing
      await snap.ref.update({ indexedInPinecone: false, error: error.message });
    }
  });

exports.retryFailedIndexing = functions.pubsub
  .schedule("every 6 hours")
  .onRun(async (context) => {
    const db = admin.firestore();
    const collections = ["tasks", "notes"];

    for (const collectionName of collections) {
      const snapshot = await db
        .collection(collectionName)
        .where("indexedInPinecone", "==", false)
        .get();

      for (const doc of snapshot.docs) {
        const data = doc.data();
        try {
          const index = pc.Index(pineconeIndexName);
          const embedding = await createEmbedding(data.content);

          await index.upsert([
            {
              id: `${data.userId}-${collectionName.slice(0, -1)}-${doc.id}`,
              values: embedding,
              metadata: {
                userId: data.userId,
                type: collectionName.slice(0, -1),
                content: data.content,
              },
            },
          ]);

          await doc.ref.update({ indexedInPinecone: true });
          console.log(
            `Successfully re-indexed ${collectionName.slice(0, -1)} with ID: ${
              doc.id
            }`
          );
        } catch (error) {
          console.error(
            `Error re-indexing ${collectionName.slice(0, -1)} ${doc.id}:`,
            error
          );
        }
      }
    }
  });

exports.queryPinecone = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "The function must be called while authenticated."
    );
  }

  const userId = context.auth.uid;
  const { query, projectId } = data;

  if (!projectId) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "The function must be called with a projectId."
    );
  }

  try {
    const index = pc.Index(pineconeIndexName);

    let queryVector;
    try {
      queryVector = await createEmbedding(query);
    } catch (error) {
      console.error("Error generating embedding for query:", error);
      queryVector = null;
    }

    const queryRequest = {
      topK: 20,
      filter: { userId: userId, projectId: projectId },
      includeMetadata: true,
    };

    if (queryVector) {
      queryRequest.vector = queryVector;
    }

    const queryResponse = await index.query(queryRequest);

    const relevantContent = queryResponse.matches
      .map((match) => {
        const type = match.metadata.type.toUpperCase();
        const priority = match.metadata.priority
          ? ` (Priority: ${match.metadata.priority})`
          : "";
        return `[${type}${priority}]: ${match.metadata.content}`;
      })
      .join("\n\n");

    return { relevantContent };
  } catch (error) {
    console.error("Error querying Pinecone:", error);
    throw new functions.https.HttpsError(
      "internal",
      "Error querying Pinecone",
      error
    );
  }
});

exports.analyzeContent = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "The function must be called while authenticated."
    );
  }

  const prompt = data.prompt;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: prompt },
      ],
      max_tokens: 2000,
      temperature: 0.7,
    });

    return { content: response.choices[0].message.content.trim() };
  } catch (error) {
    console.error("Error analyzing content:", error);
    throw new functions.https.HttpsError(
      "internal",
      "Error analyzing content",
      error
    );
  }
});

exports.generateSuggestions = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User must be authenticated to generate suggestions."
    );
  }

  const { userId, projectId } = data;

  // Fetch project content (tasks, notes, bookmarks, documents)
  const db = admin.firestore();
  const [tasks, notes, bookmarks, documents] = await Promise.all([
    db
      .collection("tasks")
      .where("userId", "==", userId)
      .where("projectId", "==", projectId)
      .get(),
    db
      .collection("notes")
      .where("userId", "==", userId)
      .where("projectId", "==", projectId)
      .get(),
    db
      .collection("bookmarks")
      .where("userId", "==", userId)
      .where("projectId", "==", projectId)
      .get(),
    db
      .collection("documents")
      .where("userId", "==", userId)
      .where("projectId", "==", projectId)
      .get(),
  ]);

  // Combine all content
  const allContent = [
    ...tasks.docs.map((doc) => doc.data().content),
    ...notes.docs.map((doc) => doc.data().content),
    ...bookmarks.docs.map((doc) => doc.data().title),
    ...documents.docs.map((doc) => {
      const data = doc.data();
      return `Document (${data.title}): ${data.content}`;
    }),
  ].join("\n\n");

  console.log("Project content:", allContent);

  try {
    // Use OpenAI to generate suggestions based on the project content
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "You are an AI assistant that generates insightful questions based on project content. Generate 3 questions that would help the user analyze or explore their project further. Consider relationships between documents, tasks, notes, and bookmarks.",
        },
        {
          role: "user",
          content: `Based on the following project content, generate 3 insightful questions. Pay special attention to any documents and how they relate to other project items:\n\n${allContent}`,
        },
      ],
      max_tokens: 200, // Increased to accommodate more complex responses
      temperature: 0.7,
    });

    const suggestions = response.choices[0].message.content.trim().split("\n");

    return { suggestions: suggestions.slice(0, 3) };
  } catch (error) {
    console.error("Error generating suggestions:", error);
    throw new functions.https.HttpsError(
      "internal",
      "Error generating suggestions",
      error
    );
  }
});

exports.analyzeSynapseContent = functions.https.onCall(
  async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "User must be authenticated"
      );
    }

    const { synapseContent, synapseName, analysisType = "comprehensive", analysisMode = "core" } = data;

    try {
      // Organize content by type
      const organizedContent = synapseContent.reduce((acc, item) => {
        if (!acc[item.type]) {
          acc[item.type] = [];
        }
        acc[item.type].push(item);
        return acc;
      }, {});

      // Create a detailed context string
      const contextString = Object.entries(organizedContent)
        .map(
          ([type, items]) => `
${type.toUpperCase()}:
${items.map((item) => `- ${item.title || item.content}`).join("\n")}
`
        )
        .join("\n");

      // Configure the analysis based on the analysis type
      let specificFocus = "";
      let systemPrompt = "You are an AI assistant specializing in finding meaningful patterns and connections between different types of project items.";
      
      switch (analysisType) {
        case "relationships":
          specificFocus = `Focus primarily on:
1. Detailed relationship mapping between all items
2. How different content types interact with each other
3. Hierarchical or dependency relationships between items
4. Conflicting or reinforcing relationships between the items
5. Network-style analysis of how ideas connect`;
          break;
          
        case "summary":
          specificFocus = `Focus primarily on:
1. High-level executive summary of the key themes (be concise)
2. The 3-5 most important insights from this collection
3. Brief recommendations based on these insights
4. Avoid excessive detail and focus on clarity and actionability`;
          systemPrompt = "You are an executive assistant providing concise summaries of complex information.";
          break;
          
        case "actionItems":
          specificFocus = `Focus primarily on:
1. Extracting and organizing all explicit and implicit action items
2. Prioritizing these action items by apparent importance
3. Identifying dependencies between action items
4. Suggesting timeframes for completion where possible
5. Identifying any missing action items that would be logical next steps`;
          systemPrompt = "You are a project management assistant specializing in action item extraction and organization.";
          break;
          
        case "timeline":
          specificFocus = `Focus primarily on:
1. Analyzing the temporal relationships between items
2. Creating a logical sequence or timeline of events/ideas
3. Identifying past accomplishments vs. future plans
4. Suggesting a chronological organization of the content
5. Noting any time-sensitive elements that require attention`;
          systemPrompt = "You are a timeline analysis specialist who excels at organizing information chronologically.";
          break;
          
        case "comprehensive":
        default:
          specificFocus = `Focus on:
1. Key themes and patterns across these items
2. Specific relationships between different types of items
3. Concrete insights based on the connections between these items
4. Potential next steps directly related to these items`;
          break;
      }

      // Configure temperature and model based on analysis mode
      let temperature = 0.7;
      let model = "gpt-3.5-turbo";
      let includesBroaderAnalysis = false;
      
      switch (analysisMode) {
        case "expanded":
          temperature = 0.8;
          model = "gpt-4";
          includesBroaderAnalysis = true;
          break;
        case "creative":
          temperature = 1.0;
          model = "gpt-4";
          includesBroaderAnalysis = true;
          systemPrompt += " You think creatively and provide innovative perspectives.";
          break;
        case "core":
        default:
          includesBroaderAnalysis = false;
          break;
      }

      // First, analyze the specific synapse content
      const synapseAnalysisPrompt = `
You are analyzing a "synapse" - a collection of related items that the user has intentionally grouped together. This synapse is named "${synapseName}" and contains the following items:

${contextString}

Please analyze these specific items and their relationships. ${specificFocus}

Only reference the items provided above in this analysis.
`;

      let result;
      
      // If using core mode, just do a single analysis
      if (!includesBroaderAnalysis) {
        const analysis = await openai.chat.completions.create({
          model: model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: synapseAnalysisPrompt },
          ],
          temperature: temperature,
          max_tokens: 2000,
        });
        
        result = `
## Analysis of Your Synapse: ${synapseName}

${analysis.choices[0].message.content.trim()}
`;
      } else {
        // For expanded or creative modes, include broader analysis
        const broaderAnalysisPrompt = `
You're now going to provide additional insights about the themes present in the synapse named "${synapseName}". 
The synapse contains content related to: ${Object.keys(organizedContent).join(", ")}.

The main themes appear to be about: ${contextString.substring(0, 200)}...

Using your knowledge base:
1. What broader concepts or theories might be relevant to these themes?
2. Are there any well-known frameworks, methodologies, or best practices that could be applicable?
3. Can you suggest any additional resources, tools, or approaches that might complement this collection?
4. What are some potential innovative applications or combinations of these ideas?

Use specific examples and explain why they're relevant to this collection of items.
`;

        // Make both API calls concurrently
        const [synapseAnalysis, broaderAnalysis] = await Promise.all([
          openai.chat.completions.create({
            model: model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: synapseAnalysisPrompt },
            ],
            temperature: temperature,
            max_tokens: 2000,
          }),
          openai.chat.completions.create({
            model: "gpt-4", // Always use GPT-4 for broader analysis
            messages: [
              {
                role: "system",
                content: "You are an AI assistant that provides broader context and innovative connections for collections of related items.",
              },
              { role: "user", content: broaderAnalysisPrompt },
            ],
            temperature: temperature + 0.1, // Slightly higher temperature for broader analysis
            max_tokens: 1500,
          }),
        ]);

        // Combine the analyses
        result = `
## Analysis of Your Synapse: ${synapseName}

${synapseAnalysis.choices[0].message.content.trim()}

## Broader Context & Insights

${broaderAnalysis.choices[0].message.content.trim()}`;
      }
      
      // For creative mode, add an additional creative section if appropriate
      if (analysisMode === "creative") {
        let additionalSection = "";
        
        if (analysisType === "comprehensive" || analysisType === "relationships") {
          additionalSection = `

## Creative Applications & Future Directions

How might these ideas evolve or be combined in unexpected ways? What innovative approaches could emerge from this collection?`;
        } else if (analysisType === "actionItems") {
          additionalSection = `

## Innovation Opportunities

Beyond the standard action items, what creative approaches or experiments could yield breakthrough results?`;
        }
        
        if (additionalSection) {
          const creativePrompt = `
For the synapse named "${synapseName}" containing:
${contextString.substring(0, 500)}...

${additionalSection.replace('##', '')}

Be specific, imaginative, and thought-provoking. Suggest at least 3-5 creative possibilities that go beyond obvious connections.`;

          try {
            const creativeResponse = await openai.chat.completions.create({
              model: "gpt-4",
              messages: [
                { 
                  role: "system", 
                  content: "You are a creative innovation consultant who specializes in generating unexpected connections and novel applications from existing ideas." 
                },
                { role: "user", content: creativePrompt },
              ],
              temperature: 1.1,
              max_tokens: 1000,
            });
            
            result += `${additionalSection}

${creativeResponse.choices[0].message.content.trim()}`;
          } catch (error) {
            console.error("Error generating creative section:", error);
            // Continue without the creative section if it fails
          }
        }
      }

      return { content: result };
    } catch (error) {
      console.error("Error analyzing synapse content:", error);
      throw new functions.https.HttpsError(
        "internal",
        "Error analyzing synapse content"
      );
    }
  }
);

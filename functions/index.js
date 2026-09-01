// functions/index.js
const functions = require("firebase-functions");
const { defineSecret, defineString } = require("firebase-functions/params");
const admin = require("firebase-admin");
const axios = require("axios");
const cheerio = require("cheerio");
const { Pinecone } = require("@pinecone-database/pinecone");
const OpenAI = require("openai");

admin.initializeApp();

// Secrets are resolved at call time, never at module load. Set them with:
//   firebase functions:secrets:set OPENAI_API_KEY
//   firebase functions:secrets:set PINECONE_API_KEY
//   firebase functions:secrets:set LINKPREVIEW_API_KEY
const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");
const PINECONE_API_KEY = defineSecret("PINECONE_API_KEY");
const LINKPREVIEW_API_KEY = defineSecret("LINKPREVIEW_API_KEY");

// Not a secret - overridable via functions/.env
const PINECONE_INDEX_NAME = defineString("PINECONE_INDEX_NAME", {
  default: "user-data-index",
});

// Secret sets bound to each function via runWith.
const AI_SECRETS = { secrets: [OPENAI_API_KEY, PINECONE_API_KEY] };
const LINK_SECRETS = { secrets: [LINKPREVIEW_API_KEY] };

let openaiClient = null;
let pineconeClient = null;

function requireSecret(param, name) {
  const value = param.value();
  if (!value) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      `${name} is not configured. Set it with: firebase functions:secrets:set ${name}`
    );
  }
  return value;
}

function getOpenAI() {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: requireSecret(OPENAI_API_KEY, "OPENAI_API_KEY"),
    });
  }
  return openaiClient;
}

function getPineconeIndex() {
  if (!pineconeClient) {
    pineconeClient = new Pinecone({
      apiKey: requireSecret(PINECONE_API_KEY, "PINECONE_API_KEY"),
    });
  }
  return pineconeClient.Index(PINECONE_INDEX_NAME.value());
}

// Single source of truth for Pinecone vector IDs. The client used to build a
// different ID (${userId}-${type}-${id}) than the Firestore triggers did,
// which meant every note was stored twice and deletes orphaned one copy.
function vectorId(userId, projectId, type, id) {
  return `${userId}-${projectId}-${type}-${id}`;
}

exports.scrapeAndIndexBookmark = functions.runWith(AI_SECRETS).firestore
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

      const index = getPineconeIndex();

      // Create embeddings and index chunks
      for (let i = 0; i < chunks.length; i++) {
        const embedding = await createEmbedding(chunks[i]);
        await index.upsert([
          {
            id: `${vectorId(userId, projectId, "bookmark", context.params.bookmarkId)}-${i}`,
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
  const response = await getOpenAI().embeddings.create({
    model: "text-embedding-ada-002",
    input: text,
  });

  return response.data[0].embedding;
}

exports.cleanupPineconeVectors = functions.runWith(AI_SECRETS).pubsub
  .schedule("every 12 hours")
  .onRun(async (context) => {
    const db = admin.firestore();
    const index = getPineconeIndex();

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

exports.indexTaskOrNote = functions.runWith(AI_SECRETS).firestore
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
      const index = getPineconeIndex();

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
          id: vectorId(userId, projectId, collectionName.slice(0, -1), docId),
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

exports.retryFailedIndexing = functions.runWith(AI_SECRETS).pubsub
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
          const index = getPineconeIndex();
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

exports.queryPinecone = functions.runWith(AI_SECRETS).https.onCall(async (data, context) => {
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
    const index = getPineconeIndex();

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

exports.analyzeContent = functions.runWith(AI_SECRETS).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "The function must be called while authenticated."
    );
  }

  const prompt = data.prompt;

  try {
    const response = await getOpenAI().chat.completions.create({
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

exports.generateSuggestions = functions.runWith(AI_SECRETS).https.onCall(async (data, context) => {
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
    const response = await getOpenAI().chat.completions.create({
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

// Function to convert tasks to a document
exports.convertTasksToDocument = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User must be authenticated"
    );
  }

  const { userId, projectId, documentTitle = "Tasks Summary", archiveTasks = false } = data;

  try {
    // Get all tasks for the project
    const db = admin.firestore();
    const taskSnapshot = await db.collection("tasks")
      .where("userId", "==", userId)
      .where("projectId", "==", projectId)
      .get();
    
    if (taskSnapshot.empty) {
      return { 
        success: false, 
        message: "No tasks found for this project" 
      };
    }

    // Group tasks by completion status and priority
    const completedTasks = [];
    const incompleteTasks = [];
    
    taskSnapshot.docs.forEach((doc) => {
      const task = { id: doc.id, ...doc.data() };
      if (task.completed) {
        completedTasks.push(task);
      } else {
        incompleteTasks.push(task);
      }
    });
    
    // Sort by priority if available
    const sortByPriority = (a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      
      // Handle both string and numeric priorities (convert string to lowercase if it's a string)
      const getPriorityValue = (task) => {
        if (!task.priority) return 3;
        if (typeof task.priority === 'string') {
          return priorityOrder[task.priority.toLowerCase()] || 3;
        }
        // If priority is numeric, assume 1=high, 2=medium, 3=low
        return typeof task.priority === 'number' ? task.priority : 3;
      };
      
      const aPriority = getPriorityValue(a);
      const bPriority = getPriorityValue(b);
      return aPriority - bPriority;
    };
    
    incompleteTasks.sort(sortByPriority);
    completedTasks.sort(sortByPriority);
    
    // Format markdown content
    const currentDate = new Date().toLocaleDateString();
    let documentContent = `# ${documentTitle}\n\nGenerated on ${currentDate}\n\n`;
    
    // Add incomplete tasks section
    documentContent += `## Active Tasks (${incompleteTasks.length})\n\n`;
    
    if (incompleteTasks.length > 0) {
      // Group by priority - handling both string and numeric priorities
      const highPriority = incompleteTasks.filter(t => {
        if (!t.priority) return false;
        if (typeof t.priority === 'string') return t.priority.toLowerCase() === 'high';
        if (typeof t.priority === 'number') return t.priority === 1;
        return false;
      });
      
      const mediumPriority = incompleteTasks.filter(t => {
        if (!t.priority) return false;
        if (typeof t.priority === 'string') return t.priority.toLowerCase() === 'medium';
        if (typeof t.priority === 'number') return t.priority === 2;
        return false;
      });
      
      const lowPriority = incompleteTasks.filter(t => {
        if (!t.priority) return false;
        if (typeof t.priority === 'string') return t.priority.toLowerCase() === 'low';
        if (typeof t.priority === 'number') return t.priority === 3;
        return false;
      });
      
      const noPriority = incompleteTasks.filter(t => !t.priority);
      
      // Add high priority tasks
      if (highPriority.length > 0) {
        documentContent += `### High Priority\n\n`;
        highPriority.forEach(task => {
          const dueDate = task.nextDueDate ? `\n**Due:** ${new Date(task.nextDueDate).toLocaleDateString()}` : '';
          const notes = task.notes ? `\n\n${task.notes}` : '';
          documentContent += `${task.title || task.content}${dueDate}${notes}\n\n`;
        });
      }
      
      // Add medium priority tasks
      if (mediumPriority.length > 0) {
        documentContent += `### Medium Priority\n\n`;
        mediumPriority.forEach(task => {
          const dueDate = task.nextDueDate ? `\n**Due:** ${new Date(task.nextDueDate).toLocaleDateString()}` : '';
          const notes = task.notes ? `\n\n${task.notes}` : '';
          documentContent += `${task.title || task.content}${dueDate}${notes}\n\n`;
        });
      }
      
      // Add low priority tasks
      if (lowPriority.length > 0) {
        documentContent += `### Low Priority\n\n`;
        lowPriority.forEach(task => {
          const dueDate = task.nextDueDate ? `\n**Due:** ${new Date(task.nextDueDate).toLocaleDateString()}` : '';
          const notes = task.notes ? `\n\n${task.notes}` : '';
          documentContent += `${task.title || task.content}${dueDate}${notes}\n\n`;
        });
      }
      
      // Add no priority tasks
      if (noPriority.length > 0) {
        documentContent += `### No Priority Set\n\n`;
        noPriority.forEach(task => {
          const dueDate = task.nextDueDate ? `\n**Due:** ${new Date(task.nextDueDate).toLocaleDateString()}` : '';
          const notes = task.notes ? `\n\n${task.notes}` : '';
          documentContent += `${task.title || task.content}${dueDate}${notes}\n\n`;
        });
      }
    } else {
      documentContent += "*No active tasks*\n\n";
    }
    
    // Add completed tasks section
    documentContent += `## Completed Tasks (${completedTasks.length})\n\n`;
    
    if (completedTasks.length > 0) {
      completedTasks.forEach(task => {
        const completedDate = task.completedAt ? `\n**Completed:** ${new Date(task.completedAt.toDate ? task.completedAt.toDate() : task.completedAt).toLocaleDateString()}` : '';
        const notes = task.notes ? `\n\n${task.notes}` : '';
        documentContent += `${task.title || task.content}${completedDate}${notes}\n\n`;
      });
    } else {
      documentContent += "*No completed tasks*\n\n";
    }
    
    // Create a new document
    const docRef = await db.collection("documents").add({
      title: documentTitle,
      content: documentContent,
      userId,
      projectId,
      createdAt: new Date(),
      updatedAt: new Date(),
      source: "task-conversion",
      indexedInPinecone: false
    });
    
    // If requested, archive/delete the tasks
    let archivedCount = 0;
    if (archiveTasks) {
      // For completed tasks, we'll delete them
      const deletionPromises = completedTasks.map(async (task) => {
        try {
          await db.collection("tasks").doc(task.id).delete();
          archivedCount++;
        } catch (err) {
          console.error(`Error deleting task ${task.id}:`, err);
        }
      });
      
      await Promise.all(deletionPromises);
    }
    
    return {
      success: true,
      documentId: docRef.id,
      documentTitle,
      archivedCount,
      totalTasks: taskSnapshot.docs.length
    };
    
  } catch (error) {
    console.error("Error converting tasks to document:", error);
    throw new functions.https.HttpsError(
      "internal",
      "Error converting tasks to document",
      error
    );
  }
});

exports.analyzeSynapseContent = functions.runWith(AI_SECRETS).https.onCall(
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

      // Create a more detailed context string with full content
      const contextString = Object.entries(organizedContent)
        .map(
          ([type, items]) => `
${type.toUpperCase()}:
${items.map((item, index) => {
  // Create a more detailed entry for each item with both title and content
  const title = item.title || (item.content ? item.content.substring(0, 50) + "..." : "Untitled");
  let fullContent = item.content || "";
  const url = item.url ? `\nURL: ${item.url}` : "";
  
  // For bookmarks, enhance the description since we may only have URLs
  let itemDescription = "";
  if (type === "bookmark") {
    // Get just the domain name for context
    let domain = "";
    try {
      domain = new URL(item.url).hostname;
    } catch (e) {
      domain = item.url;
    }
    
    itemDescription = `
SOURCE TYPE: Web resource / Article from ${domain}
TITLE: ${title}
${url}
`;

    // If we have no real content from the bookmark, add a note
    if (!fullContent || fullContent === item.url) {
      itemDescription += `
NOTE: This is a bookmark to a web resource. The content hasn't been fully extracted, 
but the title and URL suggest this is about "${title}".
`;
    }
  } else {
    itemDescription = `
SOURCE TYPE: ${type.charAt(0).toUpperCase() + type.slice(1)}
TITLE: ${title}
${url}
`;
  }
  
  return `SOURCE ${index + 1}: ${title}
${itemDescription}
FULL CONTENT:
${fullContent}
---
`;
}).join("\n")}
`
        )
        .join("\n");

      // Configure the analysis based on the analysis type
      let specificFocus = "";
      let systemPrompt = "You are an AI assistant specializing in finding meaningful patterns and connections between different types of project items. You provide deep, substantive analysis that goes beyond shallow overviews.";
      let maxTokens = 2500; // Default token limit
      
      // Add debug logging to see what we're working with
      console.log("Synapse Content Analysis - Input Data:", JSON.stringify({
        synapseContent: synapseContent.map(item => ({
          type: item.type,
          id: item.id,
          title: item.title,
          contentLength: item.content ? item.content.length : 0,
          url: item.url
        })),
        analysisType,
        analysisMode
      }));
      
      switch (analysisType) {
        case "relationships":
          specificFocus = `Focus primarily on:
1. Detailed relationship mapping between all items - be specific and extensive
2. Analyze how different content types interact with each other with concrete examples
3. Map hierarchical or dependency relationships between items using specific references
4. Identify conflicting or reinforcing relationships between items and explain precisely how they interact
5. Provide network-style analysis of how ideas connect with substantive examples from source material

Important: Include direct references to specific content from the source items. Don't just list relationships - explain them in detail with evidence from the content.`;
          break;
          
        case "summary":
          specificFocus = `Focus primarily on:
1. High-level executive summary of the key themes (be concise but substantive)
2. The 3-5 most important insights from this collection with specific examples
3. Brief recommendations based on these insights, referencing specific content
4. Balance conciseness with meaningful content and actionable detail

Include specific references to the content where appropriate to maintain precision.`;
          systemPrompt = "You are an executive assistant providing concise yet substantive summaries of complex information.";
          break;
          
        case "actionItems":
          specificFocus = `Focus primarily on:
1. Extracting and organizing all explicit and implicit action items with concrete details
2. Prioritizing these action items by apparent importance with rationale
3. Identifying dependencies between action items with specific reasoning
4. Suggesting precise timeframes for completion where possible
5. Identifying missing action items that would be logical next steps 
6. For each action item, include specific references to the source content

Your response should be highly actionable, with clear steps and rationale for each item. Avoid vague suggestions. Provide substantive descriptions of each action item.`;
          systemPrompt = "You are a project management assistant specializing in detailed action item extraction and organization.";
          break;
          
        case "timeline":
          specificFocus = `Focus primarily on:
1. Analyzing the temporal relationships between items with specific references
2. Creating a detailed logical sequence or timeline of events/ideas
3. Identifying past accomplishments vs. future plans with supporting evidence
4. Suggesting a chronological organization of the content with rationale
5. Noting time-sensitive elements that require attention, with specific references
6. Where appropriate, create a visual timeline representation using markdown

Include sufficient context and explanations for each element in your timeline. Refer specifically to content when establishing chronology.`;
          systemPrompt = "You are a timeline analysis specialist who excels at organizing information chronologically with substantive explanations.";
          break;
          
        case "learningPlan":
          specificFocus = `Create a comprehensive learning plan / study guide based on this synapse content. Your response MUST include:

1. DETAILED CORE CONCEPTS: Identify and thoroughly explain each core concept from the source material
   - Each concept should have a thorough explanation with examples from the source
   - Include direct references or quotes from the source material with SPECIFIC details (e.g., "From the article 'Introduction to Python Type Hints' by Real Python: {quote}")
   - Connect concepts to each other to show relationships
   - For each concept, explain it in depth using 200+ words with examples

2. PROGRESSIVE LEARNING PATH: Structure topics in a logical learning sequence
   - Begin with foundational knowledge and progress to advanced topics
   - Explain the rationale for this sequence
   - Include realistic estimated time commitments for each section
   - Detail prerequisites for each topic

3. PRACTICAL APPLICATIONS: For each major concept, provide:
   - Detailed real-world applications with specific examples
   - At least 2-3 practical exercises with step-by-step instructions
   - Complete sample problems/solutions derived from the source material

4. RESOURCES: Identify specific resources from the source material
   - When referring to a resource, use its EXACT title and details (e.g., "Python Type Checking Guide by MyPy Documentation", not "Item 3")
   - Provide specific page numbers, sections, or chapters where appropriate
   - Explain exactly what valuable information each resource contains
   - Organize them by topic and difficulty level

5. ASSESSMENT: Create comprehension questions for each major section
   - Include 3-5 questions per section, ranging from basic to advanced
   - Provide detailed answer explanations based on the source material
   - For code examples, include complete runnable code, not just snippets

EXTREMELY IMPORTANT: Never use generic references like "Item 1" or "Source X". Instead, always use the EXACT titles and descriptions of the source materials. If a bookmark is a website, refer to it by its actual title and URL. If it's a document, use the document title. Be highly specific about where information comes from.

Your learning plan must be substantive, detailed, and directly reference the content provided. Avoid generic advice and shallow overviews. The plan should be immediately useful for someone wanting to master this subject matter. Your response should be at least 1500 words to provide sufficient depth.`;
          systemPrompt = "You are an expert educational content designer who creates comprehensive, in-depth learning plans based on source materials. You excel at extracting knowledge from various sources and organizing it into effective learning pathways. You have deep knowledge of programming concepts and can expand on references to programming topics with detailed, accurate information, while still clearly indicating what came from the source materials and what is your expert knowledge. If the source materials are limited, you should clearly indicate that you are supplementing with your knowledge, but still create a thorough, detailed plan. When referencing content, always use specific titles and sources, not generic 'Item X' references.";
          maxTokens = 4000; // Increase token limit for learning plans
          break;
          
        case "comprehensive":
        default:
          specificFocus = `Provide a deep, thorough analysis of this content. Focus on:

1. Key themes and patterns across these items - explore each theme in detail with examples
2. Specific relationships between different types of items with concrete references
3. Detailed insights based on the connections between these items
4. Potential next steps directly related to these items with specific rationale
5. Critical analysis of the content, including strengths, gaps, and contradictions

For each point, include specific references to the source content. Avoid shallow generalizations. Your analysis should provide substantive value beyond what's obvious from skimming the items.`;
          maxTokens = 3000; // Increase token limit for comprehensive analysis
          break;
      }

      // Configure temperature and model based on analysis mode and type
      let temperature = 0.7;
      let model = "gpt-3.5-turbo";
      let includesBroaderAnalysis = false;
      
      // Always use GPT-4 for learning plans regardless of mode
      if (analysisType === "learningPlan") {
        model = "gpt-4";
        temperature = 0.6; // Lower temperature for more focused, detailed content
      }
      
      switch (analysisMode) {
        case "expanded":
          temperature = 0.7; // Slightly reduced for better depth vs creativity balance
          model = "gpt-4";
          includesBroaderAnalysis = true;
          systemPrompt += " You provide thorough, in-depth analysis with comprehensive explanations and specific examples.";
          break;
        case "creative":
          temperature = 0.9; // Slightly reduced from 1.0 to balance creativity with substance
          model = "gpt-4";
          includesBroaderAnalysis = true;
          systemPrompt += " You think creatively and provide innovative perspectives while maintaining substantive depth and detailed examples.";
          break;
        case "core":
        default:
          // For comprehensive analysis, still use GPT-4 for more depth
          if (analysisType === "comprehensive") {
            model = "gpt-4";
          }
          includesBroaderAnalysis = false;
          systemPrompt += " You focus on factual, substantive analysis with specific references to source content.";
          break;
      }

      // First, analyze the specific synapse content
      const synapseAnalysisPrompt = `
You are analyzing a "synapse" - a carefully curated collection of related items that the user has intentionally grouped together. This synapse is named "${synapseName}" and contains the following items:

${contextString}

${analysisType === "learningPlan" ? 
`Your task is to create a comprehensive, detailed learning plan based on this content.` : 
`Your task is to analyze these specific items and their relationships in depth.`}

${specificFocus}

IMPORTANT GUIDELINES:
1. Be specific and substantive - avoid shallow overviews
2. Include direct quotes or specific references from the source material
3. Provide detailed explanations, not just listings or summaries
4. Go beyond what's immediately obvious to provide valuable insights
5. Structure your response in a clear, logical manner with appropriate headings

Only reference the items provided above in this analysis.
`;

      let result;
      
      // If using core mode, just do a single analysis
      if (!includesBroaderAnalysis) {
        const analysis = await getOpenAI().chat.completions.create({
          model: model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: synapseAnalysisPrompt },
          ],
          temperature: temperature,
          max_tokens: maxTokens, // Use the type-specific token limit
        });
        
        result = `
## Analysis of Your Synapse: ${synapseName}

${analysis.choices[0].message.content.trim()}
`;
      } else {
        // For expanded or creative modes, include broader analysis
        const broaderAnalysisPrompt = `
You're now going to provide additional substantive insights about the themes present in the synapse named "${synapseName}". 
The synapse contains content related to: ${Object.keys(organizedContent).join(", ")}.

Using your knowledge base, but directly referencing the synapse content:

1. What broader concepts or theories are clearly relevant to these materials? Be specific about how they relate to particular items.

2. Are there established frameworks, methodologies, or best practices that would help organize or understand this content better? Explain exactly how they apply.

3. What high-quality additional resources would complement this collection? Be specific about what each would add.

4. What potential applications of this knowledge would be most valuable? Provide specific, detailed examples.

Important: Your response should be substantive and directly reference the source content where possible. Avoid generic advice - be specific and practical.
`;

        // Make both API calls concurrently
        const [synapseAnalysis, broaderAnalysis] = await Promise.all([
          getOpenAI().chat.completions.create({
            model: model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: synapseAnalysisPrompt },
            ],
            temperature: temperature,
            max_tokens: maxTokens, // Use the type-specific token limit
          }),
          getOpenAI().chat.completions.create({
            model: "gpt-4", // Always use GPT-4 for broader analysis
            messages: [
              {
                role: "system",
                content: "You are an AI assistant that provides in-depth, practical context and substantive connections for collections of related items. You focus on meaningful analysis rather than superficial summaries.",
              },
              { role: "user", content: broaderAnalysisPrompt },
            ],
            temperature: temperature, // Keep same temperature for consistency
            max_tokens: Math.min(2000, maxTokens), // Limit to 2000 or the type-specific limit, whichever is smaller
          }),
        ]);

        // Combine the analyses
        result = `
## Analysis of Your Synapse: ${synapseName}

${synapseAnalysis.choices[0].message.content.trim()}

## Broader Context & Practical Applications

${broaderAnalysis.choices[0].message.content.trim()}`;
      }
      
      // For creative mode, add an additional creative section if appropriate
      if (analysisMode === "creative") {
        let additionalSection = "";
        let sectionTitle = "";
        
        if (analysisType === "comprehensive" || analysisType === "relationships") {
          sectionTitle = "Creative Applications & Future Directions";
        } else if (analysisType === "actionItems") {
          sectionTitle = "Innovation Opportunities";
        } else if (analysisType === "learningPlan") {
          sectionTitle = "Innovative Learning Approaches";
        } else {
          sectionTitle = "Creative Extensions";
        }
        
        additionalSection = `\n\n## ${sectionTitle}`;
          
        const creativePrompt = `
You're analyzing a synapse named "${synapseName}" that contains curated content on a specific topic.

Based on your in-depth analysis of this synapse, provide creative, substantive, and detailed innovations in the form of ${sectionTitle}.

IMPORTANT:
1. Reference specific content items when making your suggestions
2. For each idea, provide detailed implementation strategies, not just concepts
3. Include concrete examples of how each idea would work in practice
4. Explain why each suggestion is valuable, given the specific content in the synapse
5. Be innovative yet practical - these should be realistic ideas with substantive value
6. Include at least 3-5 detailed, thoughtful ideas, each with clear implementation steps

Do not provide generic advice or shallow overviews. Your suggestions should directly build upon the specific content in this synapse and provide substantive, actionable value.

Here's a sample of the content you're working with:
${contextString.substring(0, 1000)}...

(Note: the above is just a sample; your full analysis should consider all content items.)
`;

        try {
          const creativeResponse = await getOpenAI().chat.completions.create({
            model: "gpt-4",
            messages: [
              { 
                role: "system", 
                content: "You are a creative innovation consultant who specializes in generating substantive, detailed, and innovative applications from existing ideas. You provide depth and specificity, not just surface-level suggestions." 
              },
              { role: "user", content: creativePrompt },
            ],
            temperature: 0.9, // Slightly reduced for more focused creativity
            max_tokens: 2000, // Increase token limit for more detailed creative content
          });
          
          result += `${additionalSection}

${creativeResponse.choices[0].message.content.trim()}`;
        } catch (error) {
          console.error("Error generating creative section:", error);
          // Continue without the creative section if it fails
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

// ---------------------------------------------------------------------------
// Vector maintenance callables.
//
// These replace the browser-side pineconeService, which shipped a live Pinecone
// key and an OpenAI key in the bundle. Vector IDs come from vectorId() so the
// client and the Firestore triggers agree on a single scheme.
// ---------------------------------------------------------------------------

function requireAuth(context) {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "You must be signed in to perform this action."
    );
  }
  return context.auth.uid;
}

function requireFields(data, fields) {
  for (const field of fields) {
    if (!data || !data[field]) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        `Missing required field: ${field}`
      );
    }
  }
}

exports.indexContent = functions
  .runWith(AI_SECRETS)
  .https.onCall(async (data, context) => {
    // The caller's own uid owns the vector - never trust a userId from the client.
    const userId = requireAuth(context);
    requireFields(data, ["projectId", "content", "type", "id"]);

    const { projectId, content, type, id } = data;
    const additionalContext = data.additionalContext || "";
    const source = data.source || "native";

    try {
      const contextualizedContent = `${type.toUpperCase()}: ${content}\nContext: ${additionalContext}\nSource: ${source}`;
      const embedding = await createEmbedding(contextualizedContent);
      const index = getPineconeIndex();

      await index.upsert([
        {
          id: vectorId(userId, projectId, type, id),
          values: embedding,
          metadata: {
            userId,
            projectId,
            type,
            content: contextualizedContent,
            id,
            source,
          },
        },
      ]);

      return { success: true };
    } catch (error) {
      console.error(`Error indexing ${type} ${id}:`, error);
      throw new functions.https.HttpsError("internal", `Error indexing ${type}`);
    }
  });

exports.updateVector = functions
  .runWith(AI_SECRETS)
  .https.onCall(async (data, context) => {
    const userId = requireAuth(context);
    requireFields(data, ["projectId", "content", "type", "id"]);

    const { projectId, content, type, id } = data;

    try {
      const embedding = await createEmbedding(content);
      const index = getPineconeIndex();

      await index.upsert([
        {
          id: vectorId(userId, projectId, type, id),
          values: embedding,
          metadata: { userId, projectId, type, content, id },
        },
      ]);

      return { success: true };
    } catch (error) {
      console.error(`Error updating ${type} vector ${id}:`, error);
      throw new functions.https.HttpsError(
        "internal",
        `Error updating ${type} vector`
      );
    }
  });

exports.deleteVector = functions
  .runWith(AI_SECRETS)
  .https.onCall(async (data, context) => {
    const userId = requireAuth(context);
    requireFields(data, ["projectId", "type", "id"]);

    const { projectId, type, id } = data;

    try {
      const index = getPineconeIndex();
      await index.deleteOne(vectorId(userId, projectId, type, id));
      return { success: true };
    } catch (error) {
      console.error(`Error deleting ${type} vector ${id}:`, error);
      throw new functions.https.HttpsError(
        "internal",
        `Error deleting ${type} vector`
      );
    }
  });

// ---------------------------------------------------------------------------
// Bookmark link metadata. Replaces the browser-side LinkPreview call, which
// exposed the LinkPreview key to anyone who opened devtools.
// ---------------------------------------------------------------------------

exports.fetchLinkMetadata = functions
  .runWith(LINK_SECRETS)
  .https.onCall(async (data, context) => {
    requireAuth(context);
    requireFields(data, ["url"]);

    let parsed;
    try {
      parsed = new URL(data.url);
    } catch {
      throw new functions.https.HttpsError("invalid-argument", "Invalid URL.");
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Only http and https URLs are supported."
      );
    }

    // Resolve the secret outside the try so a misconfiguration surfaces as a
    // real error rather than being swallowed by the graceful-degradation catch.
    const apiKey = requireSecret(LINKPREVIEW_API_KEY, "LINKPREVIEW_API_KEY");

    try {
      const response = await axios.post(
        "https://api.linkpreview.net",
        { q: parsed.toString() },
        {
          headers: { "X-Linkpreview-Api-Key": apiKey },
          timeout: 10000,
        }
      );

      return {
        title: response.data.title || null,
        description: response.data.description || "",
        image: response.data.image || null,
      };
    } catch (error) {
      // A preview failure is not fatal - the client falls back to a favicon.
      console.warn(`Link metadata lookup failed for ${parsed.hostname}:`, error.message);
      return { title: null, description: "", image: null };
    }
  });

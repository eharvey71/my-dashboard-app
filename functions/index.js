// functions/index.js
const functions = require("firebase-functions");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const crypto = require("crypto");
const axios = require("axios");
const cheerio = require("cheerio");
const llm = require("./llm");
const { FieldValue } = require("firebase-admin/firestore");

admin.initializeApp();

// Secrets are resolved at call time, never at module load. Set them with:
//   firebase functions:secrets:set OPENAI_API_KEY
//   firebase functions:secrets:set LINKPREVIEW_API_KEY
const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");
const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");
// Only needed for identity-linked Anthropic keys, which must name the
// workspace they act in. Not a secret - set it in functions/.env.
const ANTHROPIC_WORKSPACE_ID = defineString("ANTHROPIC_WORKSPACE_ID", {
  default: "",
});
const LINKPREVIEW_API_KEY = defineSecret("LINKPREVIEW_API_KEY");

// Secret sets bound to each function via runWith.
const AI_SECRETS = { secrets: [OPENAI_API_KEY, ANTHROPIC_API_KEY] };
const LINK_SECRETS = { secrets: [LINKPREVIEW_API_KEY] };

// Collections whose documents carry their own embedding, one vector each.
const SEARCHABLE = ["notes", "tasks", "documents"];

// Bookmarks are scraped page text, too long for a single vector, so their
// chunks live in a subcollection: bookmarks/{id}/chunks/{index}.
const BOOKMARK_CHUNKS = "chunks";


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

// Keys are resolved per call - defineSecret values are only available at
// request time, never at module load.
function llmKeys() {
  return {
    openai: requireSecret(OPENAI_API_KEY, "OPENAI_API_KEY"),
    anthropic: requireSecret(ANTHROPIC_API_KEY, "ANTHROPIC_API_KEY"),
    anthropicWorkspaceId: ANTHROPIC_WORKSPACE_ID.value() || null,
  };
}

async function createEmbedding(text) {
  return llm.createEmbedding(
    text,
    requireSecret(OPENAI_API_KEY, "OPENAI_API_KEY")
  );
}

// Marks which content an embedding was computed from. The indexing trigger
// writes the embedding back onto the same document, which re-fires the trigger;
// comparing this hash is what stops that from looping forever.
function contentHash(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

// findNearest in @google-cloud/firestore 7.x returns matches but not their
// distances, so ranking across several collections has to be done here. Both
// vectors come from the same embedding model and are already unit-length in
// practice, but normalising keeps this correct regardless.
function cosineSimilarity(a, b) {
  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }

  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

// ---------------------------------------------------------------------------
// Indexing
//
// Embeddings live on the document they describe rather than in a separate
// vector store. Deleting a note deletes its embedding; there is nothing left to
// reconcile, which is what the old cleanupPineconeVectors and
// retryFailedIndexing jobs existed to do.
// ---------------------------------------------------------------------------

exports.indexSearchableContent = functions
  .runWith(AI_SECRETS)
  .firestore.document("{collectionName}/{docId}")
  .onWrite(async (change, context) => {
    const { collectionName, docId } = context.params;
    if (!SEARCHABLE.includes(collectionName)) return null;

    // Deletes need no work - the embedding went with the document.
    if (!change.after.exists) return null;

    const data = change.after.data();
    const content = data.content || data.title || "";
    const { userId, projectId } = data;

    if (!content.trim() || !userId || !projectId) return null;

    const hash = contentHash(content);

    // Already embedded from exactly this content: this is our own write-back.
    if (data.embeddedHash === hash) return null;

    // Already failed on exactly this content. Writing the failure marker
    // re-fires this trigger, so without this guard a permanent failure (a
    // revoked API key, say) would retry forever at one OpenAI call per pass.
    // Editing the document clears the guard by changing the hash.
    if (data.embedFailedHash === hash) return null;

    try {
      const embedding = await createEmbedding(content);

      await change.after.ref.update({
        embedding: FieldValue.vector(embedding),
        embeddedHash: hash,
        embeddedAt: FieldValue.serverTimestamp(),
        embedded: true,
        embedFailedHash: FieldValue.delete(),
        embeddingError: FieldValue.delete(),
      });

      console.log(`Embedded ${collectionName}/${docId}`);
    } catch (error) {
      console.error(`Error embedding ${collectionName}/${docId}:`, error);
      await change.after.ref.update({
        embedded: false,
        embedFailedHash: hash,
        embeddingError: error.message,
      });
    }

    return null;
  });

exports.scrapeAndIndexBookmark = functions
  .runWith(AI_SECRETS)
  .firestore.document("bookmarks/{bookmarkId}")
  .onCreate(async (snap, context) => {
    const { url, userId, projectId } = snap.data();

    if (!projectId) {
      console.error(`No projectId on bookmark ${context.params.bookmarkId}`);
      return null;
    }

    try {
      const response = await axios.get(url, { timeout: 15000 });
      const $ = cheerio.load(response.data);
      const cleanedText = $("body").text().replace(/\s+/g, " ").trim();

      const chunkSize = 1000;
      const chunks = [];
      for (let i = 0; i < cleanedText.length; i += chunkSize) {
        chunks.push(cleanedText.slice(i, i + chunkSize));
      }

      const chunksRef = snap.ref.collection(BOOKMARK_CHUNKS);

      for (let i = 0; i < chunks.length; i++) {
        const embedding = await createEmbedding(chunks[i]);

        // userId and projectId are denormalised onto each chunk so the
        // collection-group vector query can pre-filter on them.
        await chunksRef.doc(String(i)).set({
          userId,
          projectId,
          url,
          chunkIndex: i,
          content: chunks[i],
          embedding: FieldValue.vector(embedding),
        });
      }

      await snap.ref.update({ embedded: true, chunkCount: chunks.length });
      console.log(
        `Indexed bookmark ${context.params.bookmarkId} in ${chunks.length} chunks`
      );
    } catch (error) {
      console.error(
        `Error indexing bookmark ${context.params.bookmarkId}:`,
        error
      );
      await snap.ref.update({ embedded: false, embeddingError: error.message });
    }

    return null;
  });

// Firestore does not cascade deletes into subcollections, so bookmark chunks
// are the one case that still needs explicit cleanup - triggered by the delete
// itself rather than by a scheduled reconciliation sweep.
exports.cleanupBookmarkChunks = functions.firestore
  .document("bookmarks/{bookmarkId}")
  .onDelete(async (snap, context) => {
    const chunks = await snap.ref.collection(BOOKMARK_CHUNKS).get();
    if (chunks.empty) return null;

    const batch = admin.firestore().batch();
    chunks.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();

    console.log(
      `Deleted ${chunks.size} chunks for bookmark ${context.params.bookmarkId}`
    );
    return null;
  });

// ---------------------------------------------------------------------------
// Synapse content hydration
//
// A Synapse item arrives from the client with `content` set to the bookmark's
// URL - the scraped page text used to live only in Pinecone, so there was
// nothing else to send. It now sits in bookmarks/{id}/chunks, so the analysis
// prompt can include what the page actually says instead of asking the model
// to infer a whole article from its title and domain.
// ---------------------------------------------------------------------------

// These were tiny because gpt-4's context window is 8K tokens shared with the
// output. Claude Opus 5 has a 1M window, so the binding constraint is now cost
// rather than capacity - roughly 30K tokens of context per call, and far less
// than that on a cache hit. Raise them if synapses routinely get truncated.
const BOOKMARK_TEXT_BUDGET = 80000;
const BOOKMARK_TEXT_PER_ITEM = 20000;
const MAX_CONTEXT_CHARS = 120000;

async function hydrateBookmarkText(items, userId) {
  const bookmarks = items.filter((item) => item.type === "bookmark" && item.id);
  if (bookmarks.length === 0) return items;

  const perItem = Math.min(
    BOOKMARK_TEXT_PER_ITEM,
    Math.floor(BOOKMARK_TEXT_BUDGET / bookmarks.length)
  );

  const db = admin.firestore();
  const texts = new Map();

  await Promise.all(
    bookmarks.map(async (item) => {
      try {
        const snapshot = await db
          .collection("bookmarks")
          .doc(item.id)
          .collection(BOOKMARK_CHUNKS)
          .orderBy("chunkIndex")
          .get();

        // Chunks carry a denormalised userId; never read another account's.
        const text = snapshot.docs
          .filter((doc) => doc.data().userId === userId)
          .map((doc) => doc.data().content)
          .join(" ")
          .slice(0, perItem);

        if (text) texts.set(item.id, text);
      } catch (error) {
        console.error(`Could not read chunks for bookmark ${item.id}:`, error.message);
      }
    })
  );

  console.log(
    `Hydrated ${texts.size}/${bookmarks.length} bookmarks with scraped text (${perItem} chars each)`
  );

  return items.map((item) =>
    texts.has(item.id) ? { ...item, scrapedText: texts.get(item.id) } : item
  );
}

// ---------------------------------------------------------------------------
// Semantic search
// ---------------------------------------------------------------------------

exports.querySimilarContent = functions
  .runWith(AI_SECRETS)
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "You must be signed in to search."
      );
    }

    const userId = context.auth.uid;
    const { query, projectId } = data;

    if (!query || !projectId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Both query and projectId are required."
      );
    }

    const limit = Math.min(data.limit || 20, 100);

    try {
      const queryVector = await createEmbedding(query);
      const db = admin.firestore();

      // Each collection is searched separately - findNearest runs against one
      // vector index at a time - then merged and ranked here.
      const searches = SEARCHABLE.map((collectionName) =>
        db
          .collection(collectionName)
          .where("userId", "==", userId)
          .where("projectId", "==", projectId)
          .findNearest("embedding", queryVector, {
            limit,
            distanceMeasure: "COSINE",
          })
          .get()
          .then((snapshot) => ({ collectionName, snapshot }))
      );

      searches.push(
        db
          .collectionGroup(BOOKMARK_CHUNKS)
          .where("userId", "==", userId)
          .where("projectId", "==", projectId)
          .findNearest("embedding", queryVector, {
            limit,
            distanceMeasure: "COSINE",
          })
          .get()
          .then((snapshot) => ({ collectionName: "bookmarks", snapshot }))
      );

      const results = await Promise.all(
        searches.map((p) =>
          p.catch((error) => {
            // A missing vector index fails only its own collection; the rest of
            // the search still returns something useful.
            console.error(
              "Vector search failed for one collection:",
              error.message
            );
            return null;
          })
        )
      );

      const matches = [];

      for (const result of results) {
        if (!result) continue;

        for (const doc of result.snapshot.docs) {
          const docData = doc.data();
          if (!docData.embedding) continue;

          matches.push({
            type: result.collectionName.slice(0, -1),
            content: docData.content || docData.title || "",
            priority: docData.priority,
            score: cosineSimilarity(queryVector, docData.embedding.toArray()),
          });
        }
      }

      matches.sort((a, b) => b.score - a.score);

      const relevantContent = matches
        .slice(0, limit)
        .map((match) => {
          const priority = match.priority
            ? ` (Priority: ${match.priority})`
            : "";
          return `[${match.type.toUpperCase()}${priority}]: ${match.content}`;
        })
        .join("\n\n");

      return { relevantContent };
    } catch (error) {
      console.error("Error running semantic search:", error);
      throw new functions.https.HttpsError("internal", "Error running search");
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
    const content = await llm.complete("analyzeContent", {
      system: "You are a helpful assistant.",
      prompt,
      keys: llmKeys(),
    });

    return { content };
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
    const text = await llm.complete("suggestions", {
      system:
        "You are an AI assistant that generates insightful questions based on project content. Generate 3 questions that would help the user analyze or explore their project further. Consider relationships between documents, tasks, notes, and bookmarks.",
      prompt: `Based on the following project content, generate 3 insightful questions. Pay special attention to any documents and how they relate to other project items:\n\n${allContent}`,
      keys: llmKeys(),
    });

    const suggestions = text.split("\n").filter((line) => line.trim());

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
      embedded: false
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

    const {
      synapseContent,
      synapseName,
      analysisType = "comprehensive",
      analysisMode = "core",
      educationMode = false,
      projectType = "general",
    } = data;

    try {
      // Education mode reframes the analysis for academic work. The terms have
      // to match what the UI shows, or the answer talks about "tasks" while the
      // screen says "assignments".
      const TASK_TERMS = {
        course: "assignments",
        research: "milestones",
        thesis: "objectives",
      };
      const SPACE_TERMS = {
        course: "course",
        research: "research project",
        thesis: "thesis",
        "study-group": "study group",
      };

      const taskTerm = educationMode
        ? TASK_TERMS[projectType] || "tasks"
        : "tasks";
      const spaceContext = educationMode
        ? SPACE_TERMS[projectType] || "academic project"
        : "project";

      // Pull in the scraped page text for any bookmarks in this synapse.
      const hydratedContent = await hydrateBookmarkText(
        synapseContent,
        context.auth.uid
      );

      // Organize content by type
      const organizedContent = hydratedContent.reduce((acc, item) => {
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

    if (item.scrapedText) {
      // Real page text, so the model reads the article rather than guessing
      // at it from the title. fullContent is only the URL for bookmarks.
      fullContent = item.scrapedText;
    } else if (!fullContent || fullContent === item.url) {
      itemDescription += `
NOTE: Only the title and URL are available for this bookmark - its page text
could not be retrieved. Do not infer what the page says beyond its title, and
say so if asked about its contents.
`;
      fullContent = "";
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

      const promptContext = contextString.length > MAX_CONTEXT_CHARS
        ? contextString.slice(0, MAX_CONTEXT_CHARS) +
          "\n\n[Context truncated to fit the model's window - some source content is not shown.]"
        : contextString;

      if (contextString.length > MAX_CONTEXT_CHARS) {
        console.warn(
          `Synapse context truncated: ${contextString.length} chars -> ${MAX_CONTEXT_CHARS}`
        );
      }

      // The synapse content is identical across every call in this request and
      // across follow-up questions about the same synapse, so it is sent once
      // as a cacheable block rather than inlined into each prompt. Duplicating
      // it into the user prompt as well would pay for it twice and cache
      // neither copy.
      const synapseContextBlock = `The user has curated a "synapse" - a collection of related items they have intentionally grouped together - named "${synapseName}". Its contents:

${promptContext}`;

      // Configure the analysis based on the analysis type
      let specificFocus = "";
      let systemPrompt = educationMode
        ? `You are an AI assistant specializing in academic analysis and learning. You help students and educators find meaningful patterns and connections between different types of ${spaceContext} materials, including ${taskTerm}. You provide deep, substantive analysis that goes beyond shallow overviews, with a focus on learning outcomes and academic insights.`
        : "You are an AI assistant specializing in finding meaningful patterns and connections between different types of project items. You provide deep, substantive analysis that goes beyond shallow overviews.";
      
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
          break;
      }

      // Current Claude models reject temperature, top_p and top_k outright, so
      // the mode knob maps to reasoning effort instead. "Creative" no longer
      // buys randomness - it asks for divergent thinking in the prompt, which
      // is what it was reaching for anyway.
      let effort = "medium";
      let route = "synapseAnalysis";
      let includesBroaderAnalysis = false;

      if (analysisType === "learningPlan") {
        route = "synapseLearningPlan";
        effort = "high";
      }

      switch (analysisMode) {
        case "expanded":
          effort = "high";
          includesBroaderAnalysis = true;
          systemPrompt += " You provide thorough, in-depth analysis with comprehensive explanations and specific examples.";
          break;
        case "creative":
          effort = "high";
          includesBroaderAnalysis = true;
          systemPrompt += " You think creatively and provide innovative perspectives, unexpected connections and lateral applications, while keeping every claim grounded in the source content.";
          break;
        case "core":
        default:
          includesBroaderAnalysis = false;
          systemPrompt += " You focus on factual, substantive analysis with specific references to source content.";
          break;
      }

      // First, analyze the specific synapse content
      const synapseAnalysisPrompt = `
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
        const analysis = await llm.complete(route, {
          system: systemPrompt,
          // The synapse itself is the stable half of the prompt, so it is
          // cached: a follow-up question re-reads it at a fraction of the cost.
          cacheSystem: synapseContextBlock,
          prompt: synapseAnalysisPrompt,
          effort,
          keys: llmKeys(),
        });

        result = `
## Analysis of Your Synapse: ${synapseName}

${analysis}
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
          llm.complete(route, {
            system: systemPrompt,
            cacheSystem: synapseContextBlock,
            prompt: synapseAnalysisPrompt,
            effort,
            keys: llmKeys(),
          }),
          llm.complete("synapseBroader", {
            system:
              "You are an AI assistant that provides in-depth, practical context and substantive connections for collections of related items. You focus on meaningful analysis rather than superficial summaries.",
            cacheSystem: synapseContextBlock,
            prompt: broaderAnalysisPrompt,
            keys: llmKeys(),
          }),
        ]);

        // Combine the analyses
        result = `
## Analysis of Your Synapse: ${synapseName}

${synapseAnalysis}

## Broader Context & Practical Applications

${broaderAnalysis}`;
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

Base every suggestion on the synapse content given above.
`;

        try {
          const creativeResponse = await llm.complete("synapseBroader", {
            system:
              "You are a creative innovation consultant who specializes in generating substantive, detailed, and innovative applications from existing ideas. You provide depth and specificity, not just surface-level suggestions.",
            cacheSystem: synapseContextBlock,
            prompt: creativePrompt,
            effort: "high",
            keys: llmKeys(),
          });

          result += `${additionalSection}

${creativeResponse}`;
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
// Shared callable guards
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

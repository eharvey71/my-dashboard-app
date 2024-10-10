// functions/index.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');
const cheerio = require('cheerio');
const { Pinecone } = require("@pinecone-database/pinecone");
const OpenAI = require('openai');

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
  console.error('Missing required environment variables. Please set OPENAI_API_KEY, PINECONE_API_KEY, and PINECONE_INDEX_NAME.');
  process.exit(1);
} 

const openai = new OpenAI({
  apiKey: openaiApiKey
});

const pc = new Pinecone({
  apiKey: pineconeApiKey,
});

exports.scrapeAndIndexBookmark = functions.firestore
  .document('bookmarks/{bookmarkId}')
  .onCreate(async (snap, context) => {
    const bookmark = snap.data();
    const { url, userId, projectId } = bookmark;

    if (!projectId) {
      console.error(`No projectId found for bookmark ${context.params.bookmarkId}`);
      return;
    }

    try {
      // Scrape website content
      const response = await axios.get(url);
      const html = response.data;
      const $ = cheerio.load(html);
      const bodyText = $('body').text().trim();
      const cleanedText = bodyText.replace(/\s+/g, ' ').trim();

      // Chunk the text
      const chunkSize = 1000;
      const chunks = [];
      for (let i = 0; i < cleanedText.length; i += chunkSize) {
        chunks.push(cleanedText.slice(i, i + chunkSize));
      }

      // Initialize Pinecone index
      if (!pineconeApiKey || !pineconeIndexName) {
        throw new Error('Pinecone configuration is incomplete. Please check your Firebase Functions config.');
      }

      const index = pc.Index(pineconeIndexName);

      // Create embeddings and index chunks
      for (let i = 0; i < chunks.length; i++) {
        const embedding = await createEmbedding(chunks[i]);
        await index.upsert([{
          id: `${userId}-${projectId}-bookmark-${context.params.bookmarkId}-${i}`,
          values: embedding,
          metadata: {
            userId,
            projectId,
            type: 'bookmark',
            content: chunks[i],
            url,
            chunkIndex: i,
          },
        }]);
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

exports.cleanupPineconeVectors = functions.pubsub.schedule('every 12 hours').onRun(async (context) => {
  const db = admin.firestore();
  const index = pc.Index(pineconeIndexName);

  try {
    // Fetch all document IDs from Firestore for notes and tasks
    const notesSnapshot = await db.collectionGroup('notes').get();
    const tasksSnapshot = await db.collectionGroup('tasks').get();

    const validIds = new Set([
      ...notesSnapshot.docs.map(doc => `${doc.data().userId}-${doc.data().projectId}-${doc.id}`),
      ...tasksSnapshot.docs.map(doc => `${doc.data().userId}-${doc.data().projectId}-${doc.id}`)
    ]);

    console.log(`Found ${validIds.size} valid note/task IDs`);

    // Fetch all bookmarks from Firestore
    const bookmarksSnapshot = await db.collectionGroup('bookmarks').get();
    const validBookmarks = new Set(bookmarksSnapshot.docs.map(doc => 
      `${doc.data().userId}-${doc.data().projectId}-${doc.id}-${doc.data().url}`
    ));

    console.log(`Found ${validBookmarks.size} valid bookmark IDs`);

    // Fetch all vector IDs from Pinecone
    const queryResponse = await index.query({
      vector: Array(1536).fill(0),  // Assuming 1536 is your vector dimension
      topK: 10000,  // Adjust based on your expected maximum number of vectors
      includeMetadata: true
    });

    console.log(`Retrieved ${queryResponse.matches.length} vectors from Pinecone`);

    const idsToDelete = [];

    queryResponse.matches.forEach(match => {
      const [userId, projectId, type, docId, ...rest] = match.id.split('-');
      
      if (type === 'bookmark') {
        // For bookmarks, check against the URL in metadata
        if (!validBookmarks.has(`${userId}-${projectId}-${docId}-${match.metadata.url}`)) {
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
      console.log(`Successfully deleted all ${idsToDelete.length} vectors from Pinecone`);
    } else {
      console.log('No vectors to delete');
    }

    return null;
  } catch (error) {
    console.error('Error in cleanupPineconeVectors:', error);
    return null;
  }
});

exports.indexTaskOrNote = functions.firestore
  .document('{collectionName}/{docId}')
  .onCreate(async (snap, context) => {
    const { collectionName, docId } = context.params;
    if (collectionName !== 'tasks' && collectionName !== 'notes') return;

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

      if (collectionName === 'tasks' && priority) {
        metadata.priority = priority;
      }

      // Create embedding
      const embedding = await createEmbedding(content);

      // Index the task or note
      await index.upsert([{
        id: `${userId}-${projectId}-${collectionName.slice(0, -1)}-${docId}`,
        values: embedding,
        metadata: metadata,
      }]);

      // Update document to indicate successful indexing
      await snap.ref.update({ indexedInPinecone: true });

      console.log(`Successfully indexed ${collectionName.slice(0, -1)} with ID: ${docId} for project: ${projectId}`);
    } catch (error) {
      console.error(`Error indexing ${collectionName.slice(0, -1)} ${docId}:`, error);
      // Update document to indicate failed indexing
      await snap.ref.update({ indexedInPinecone: false, error: error.message });
    }
  });

exports.retryFailedIndexing = functions.pubsub.schedule('every 6 hours').onRun(async (context) => {
  const db = admin.firestore();
  const collections = ['tasks', 'notes'];

  for (const collectionName of collections) {
    const snapshot = await db.collection(collectionName)
      .where('indexedInPinecone', '==', false)
      .get();

    for (const doc of snapshot.docs) {
      const data = doc.data();
      try {
        const index = pc.Index(pineconeIndexName);
        const embedding = await createEmbedding(data.content);

        await index.upsert([{
          id: `${data.userId}-${collectionName.slice(0, -1)}-${doc.id}`,
          values: embedding,
          metadata: {
            userId: data.userId,
            type: collectionName.slice(0, -1),
            content: data.content,
          },
        }]);

        await doc.ref.update({ indexedInPinecone: true });
        console.log(`Successfully re-indexed ${collectionName.slice(0, -1)} with ID: ${doc.id}`);
      } catch (error) {
        console.error(`Error re-indexing ${collectionName.slice(0, -1)} ${doc.id}:`, error);
      }
    }
  }
});

exports.queryPinecone = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
  }

  const userId = context.auth.uid;
  const { query, projectId } = data;

  if (!projectId) {
    throw new functions.https.HttpsError('invalid-argument', 'The function must be called with a projectId.');
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
      .map(
        (match) => {
          const type = match.metadata.type.toUpperCase();
          const priority = match.metadata.priority ? ` (Priority: ${match.metadata.priority})` : '';
          return `[${type}${priority}]: ${match.metadata.content}`;
        }
      )
      .join("\n\n");

    return { relevantContent };
  } catch (error) {
    console.error("Error querying Pinecone:", error);
    throw new functions.https.HttpsError('internal', 'Error querying Pinecone', error);
  }
});

exports.analyzeContent = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
  }

  const prompt = data.prompt;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 2000,
      temperature: 0.7,
    });

    return { content: response.choices[0].message.content.trim() };
  } catch (error) {
    console.error('Error analyzing content:', error);
    throw new functions.https.HttpsError('internal', 'Error analyzing content', error);
  }
});

// New function to generate suggestions
exports.generateSuggestions = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated to generate suggestions.');
  }

  const { userId, projectId } = data;
  
  // Fetch project content (tasks, notes, bookmarks, documents)
  const db = admin.firestore();
  const [tasks, notes, bookmarks] = await Promise.all([
    db.collection('tasks').where('userId', '==', userId).where('projectId', '==', projectId).get(),
    db.collection('notes').where('userId', '==', userId).where('projectId', '==', projectId).get(),
    db.collection('bookmarks').where('userId', '==', userId).where('projectId', '==', projectId).get(),
  ]);

  // Combine all content
  const allContent = [
    ...tasks.docs.map(doc => doc.data().content),
    ...notes.docs.map(doc => doc.data().content),
    ...bookmarks.docs.map(doc => doc.data().title),
  ].join(' ');

  console.log('Project content:', allContent);

  try {
    // Use OpenAI to generate suggestions based on the project content
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are an AI assistant that generates insightful questions based on project content. Generate 3 questions that would help the user analyze or explore their project further.' },
        { role: 'user', content: `Based on the following project content, generate 3 insightful questions:\n\n${allContent}` },
      ],
      max_tokens: 150,
      temperature: 0.7,
    });

    const suggestions = response.choices[0].message.content.trim().split('\n');

    return { suggestions: suggestions.slice(0, 3) };
  } catch (error) {
    console.error('Error generating suggestions:', error);
    throw new functions.https.HttpsError('internal', 'Error generating suggestions', error);
  }
});
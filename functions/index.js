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
    const { url, userId } = bookmark;

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
          id: `${userId}-bookmark-${context.params.bookmarkId}-${i}`,
          values: embedding,
          metadata: {
            userId,
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

// New Pinecone cleanup function
exports.cleanupPineconeVectors = functions.pubsub.schedule('every 12 hours').onRun(async (context) => {
  const db = admin.firestore();
  const index = pc.Index(pineconeIndexName);

  try {
    // Fetch all document IDs from Firestore for notes and tasks
    const notesSnapshot = await db.collection('notes').get();
    const tasksSnapshot = await db.collection('tasks').get();

    const validIds = new Set([
      ...notesSnapshot.docs.map(doc => doc.id),
      ...tasksSnapshot.docs.map(doc => doc.id)
    ]);

    // Fetch all bookmarks from Firestore
    const bookmarksSnapshot = await db.collection('bookmarks').get();
    const validBookmarkUrls = new Set(bookmarksSnapshot.docs.map(doc => doc.data().url));

    // Fetch all vector IDs from Pinecone
    const queryResponse = await index.query({
      vector: Array(1536).fill(0),  // Assuming 1536 is your vector dimension
      topK: 10000,  // Adjust based on your expected maximum number of vectors
      includeMetadata: true
    });

    const idsToDelete = [];

    queryResponse.matches.forEach(match => {
      const [userId, type, docId, chunkIndex] = match.id.split('-');
      
      if (type === 'bookmark') {
        // For bookmarks, check against the URL in metadata
        if (!validBookmarkUrls.has(match.metadata.url)) {
          idsToDelete.push(match.id);
        }
      } else {
        // For notes and tasks, check against the document ID
        if (!validIds.has(docId)) {
          idsToDelete.push(match.id);
        }
      }
    });

    if (idsToDelete.length > 0) {
      // Delete vectors from Pinecone
      await index.deleteMany(idsToDelete);
      console.log(`Deleted ${idsToDelete.length} vectors from Pinecone`);
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
    const { content, userId } = data;

    try {
      // Initialize Pinecone index
      const index = pc.Index(pineconeIndexName);

      // Create embedding
      const embedding = await createEmbedding(content);

      // Index the task or note
      await index.upsert([{
        id: `${userId}-${collectionName.slice(0, -1)}-${docId}`,
        values: embedding,
        metadata: {
          userId,
          type: collectionName.slice(0, -1),
          content,
        },
      }]);

      // Update document to indicate successful indexing
      await snap.ref.update({ indexedInPinecone: true });

      console.log(`Successfully indexed ${collectionName.slice(0, -1)} with ID: ${docId}`);
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
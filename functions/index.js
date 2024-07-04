// functions/index.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');
const cheerio = require('cheerio');
const { Pinecone } = require("@pinecone-database/pinecone");
const OpenAI = require('openai');

admin.initializeApp();

// Correctly access Firebase configuration
const openaiApiKey = functions.config().openai?.key;
const pineconeApiKey = functions.config().pinecone?.key;
const pineconeIndexName = functions.config().pinecone?.index;

// Check if the OpenAI API key is available
if (!openaiApiKey) {
  console.error('OpenAI API key is not set. Please set it using Firebase Functions config.');
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

// You can add more functions here, such as for querying Pinecone
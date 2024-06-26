import { Pinecone } from "@pinecone-database/pinecone";
import { generateEmbedding } from "./aiService";

const API_KEY = "5f9fc0b2-87f2-4645-9f64-fa9afe18fc48"; // Replace with your actual Pinecone API key

const pinecone = new Pinecone({
  apiKey: API_KEY,
});

const indexName = "user-data-index";
const EMBEDDING_DIMENSION = 1536; // Update this to match the dimension of your embedding model
let index = null;

const initializeClient = async () => {
  try {
    console.log("Initializing Pinecone client...");
    const existingIndexes = await pinecone.listIndexes();
    console.log("Contents of existingIndexes:", JSON.stringify(existingIndexes));

    const indexExists = existingIndexes.indexes.some(idx => idx.name === indexName);

    if (!indexExists) {
      console.log(`Creating index ${indexName}...`);
      await pinecone.createIndex({
        name: indexName,
        dimension: EMBEDDING_DIMENSION, // Ensure this matches the dimension of your embedding model
        spec: {
          serverless: {
            cloud: "aws",
            region: "us-east-1",
          },
        },
      });
      console.log(`Index ${indexName} created.`);
    } else {
      console.log(`Index ${indexName} already exists.`);
    }

    index = pinecone.Index(indexName);
  } catch (error) {
    console.error('Error initializing Pinecone client:', error);
    throw error;
  }
};

const ensureInitialized = async () => {
  if (!index) {
    await initializeClient();
  }
};

export const indexContent = async (userId, content, type) => {
  try {
    await ensureInitialized();

    if (!index) {
      throw new Error('Pinecone index is not initialized');
    }

    const embedding = await generateEmbedding(content);

    if (embedding.length !== EMBEDDING_DIMENSION) {
      throw new Error(`Embedding dimension ${embedding.length} does not match the expected dimension ${EMBEDDING_DIMENSION}`);
    }

    await index.upsert([
      {
        id: `${userId}-${type}-${new Date().toISOString()}`,
        values: embedding,
        metadata: {
          userId,
          type,
          content,
        },
      },
    ]);
    console.log(`Content indexed for user ${userId}.`);
  } catch (error) {
    console.error("Error indexing content:", error);
    throw error;
  }
};

export const queryPinecone = async (userId) => {
  try {
    await ensureInitialized();

    if (!index) {
      throw new Error('Pinecone index is not initialized');
    }

    const queryResponse = await index.query({
      topK: 10,
      includeMetadata: true,
      vector: Array(EMBEDDING_DIMENSION).fill(0.5), // Mock query vector, should be based on user context
      filter: {
        userId,
      },
    });

    return queryResponse.matches
      .map((match) => match.metadata.content)
      .join("\n");
  } catch (error) {
    console.error("Error querying Pinecone:", error);
    throw error;
  }
};

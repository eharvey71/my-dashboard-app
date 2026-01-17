import { Pinecone } from "@pinecone-database/pinecone";
import { generateEmbedding } from "./aiService";

const API_KEY = "5f9fc0b2-87f2-4645-9f64-fa9afe18fc48"; // Replace with your actual Pinecone API key

const pinecone = new Pinecone({
  apiKey: API_KEY,
});

const indexName = "user-data-index";
const EMBEDDING_DIMENSION = 1536; // Update this to match the dimension of your embedding model
let index = null;

const ensureInitialized = async () => {
  if (!index) {
    await initializeClient();
    index = pinecone.Index(indexName);
  }
};

const initializeClient = async () => {
  try {
    console.log("Initializing Pinecone client...");
    const existingIndexes = await pinecone.listIndexes();
    console.log(
      "Contents of existingIndexes:",
      JSON.stringify(existingIndexes)
    );

    const indexExists = existingIndexes.indexes.some(
      (idx) => idx.name === indexName
    );

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
    console.error("Error initializing Pinecone client:", error);
    throw error;
  }
};

export const indexContent = async (
  userId,
  projectId,
  content,
  type,
  id,
  additionalContext = "",
  source = "native"
) => {
  try {
    await ensureInitialized();

    const contextualizedContent = `${type.toUpperCase()}: ${content}\nContext: ${additionalContext}\nSource: ${source}`;
    const embedding = await generateEmbedding(contextualizedContent);
    console.log(`Generated embedding for ${type} ${id}`);

    const vectorId = `${userId}-${projectId}-${type}-${id}`;

    await index.upsert([
      {
        id: vectorId,
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
    console.log(`Content indexed for user ${userId} with ${type} ID: ${id}`);
  } catch (error) {
    console.error(`Error indexing ${type}:`, error);
    throw error;
  }
};

export const updateVector = async (userId, projectId, id, newContent, type) => {
  try {
    await ensureInitialized();

    const embedding = await generateEmbedding(newContent);

    const vectorId = `${userId}-${projectId}-${type}-${id}`;

    await index.upsert([
      {
        id: vectorId,
        values: embedding,
        metadata: {
          userId,
          projectId,
          type,
          content: newContent,
          id,
        },
      },
    ]);
    console.log(`Vector updated for ${type} ${id} of user ${userId}.`);
  } catch (error) {
    console.error(`Error updating ${type} vector:`, error);
    throw error;
  }
};

export const deleteVector = async (userId, projectId, id, type) => {
  try {
    await ensureInitialized();

    const vectorId = `${userId}-${projectId}-${type}-${id}`;
    console.log(`Attempting to delete vector with ID ${vectorId}`);

    await index.deleteOne(vectorId);
    console.log(`Vector deleted for ${type} ${id} of user ${userId}.`);
  } catch (error) {
    console.error(`Error deleting ${type} vector:`, error);
    throw error;
  }
};

export const deleteVectors = async (userId, url, batchSize = 1000) => {
  try {
    await ensureInitialized();

    if (!index) {
      throw new Error("Pinecone index is not initialized");
    }

    const filterCondition = {
      userId: userId,
      content: { $contains: url }
    };

    let totalDeleted = 0;
    let cursor = null;

    while (true) {
      // Fetch vector IDs matching the filter

      const queryResponse = await index.query({
        vector: new Array(await index.describeIndexStats().dimension).fill(0), // dummy vector
        filter: { url: { $eq: url } },
        topK: batchSize,
        includeMetadata: false,
        includeValues: false,
        cursor: cursor,
    });

      // Extract vector IDs
      const vectorIds = queryResponse.matches.map(match => match.id);

      if (vectorIds.length === 0) {
        break; // No more vectors to delete
      }

      // Delete the fetched vector IDs
      await index.deleteMany(vectorIds);

      totalDeleted += vectorIds.length;
      console.log(`Deleted batch of ${vectorIds.length} vectors. Total deleted: ${totalDeleted}`);

      // Update cursor for next iteration
      cursor = queryResponse.cursor;

      if (!cursor) {
        break; // No more results to fetch
      }
    }

    console.log(`Deletion operation completed. Total vectors deleted: ${totalDeleted}`);
  } catch (error) {
    console.error("Error deleting vectors:", error);
    throw error;
  }
};
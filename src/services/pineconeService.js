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
  content,
  type,
  id,
  additionalContext = ""
) => {
  try {
    await ensureInitialized();

    // if (!index) {
    //   throw new Error("Pinecone index is not initialized");
    // }

    const contextualizedContent = `${type.toUpperCase()}: ${content}\nContext: ${additionalContext}`;
    const embedding = await generateEmbedding(contextualizedContent);
    console.log(`Generated embedding for ${type} ${id}`);

    // if (embedding.length !== EMBEDDING_DIMENSION) {
    //   throw new Error(
    //     `Embedding dimension ${embedding.length} does not match the expected dimension ${EMBEDDING_DIMENSION}`
    //   );
    // }

    const vectorId = `${userId}-${type}-${id}`;

    await index.upsert([
      {
        id: vectorId,
        values: embedding,
        metadata: {
          userId,
          type,
          content: contextualizedContent,
          id,
        },
      },
    ]);
    console.log(`Content indexed for user ${userId} with ${type} ID: ${id}`);
  } catch (error) {
    console.error(`Error indexing ${type}:`, error);
    throw error;
  }
};

export const updateVector = async (userId, id, newContent, type) => {
  try {
    //   console.log(
    //     `Updating vector for task ${taskId} of user ${userId}. Type is ${type}`
    //   );
    //   console.log(`New content is ${newContent}`);

    await ensureInitialized();

    //   if (!index) {
    //     throw new Error("Pinecone index is not initialized");
    //   }

    const embedding = await generateEmbedding(newContent);

    const vectorId = `${userId}-${type}-${id}`;
    // console.log(`Vector ID is ${vectorId}`);

    await index.upsert([
      {
        id: vectorId,
        values: embedding,
        metadata: {
          userId,
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

export const deleteVector = async (userId, id, type) => {
  try {
    // console.log(
    //   `Deleting vector for note ${noteId} of user ${userId}. Type is ${type}`
    // );

    await ensureInitialized();

    // if (!index) {
    //   throw new Error("Pinecone index is not initialized");
    // }

    const vectorId = `${userId}-${type}-${id}`;
    console.log(`Attempting to delete vector with ID ${vectorId}`);

    await index.deleteOne(vectorId);
    console.log(`Vector deleted for note ${type} ${id} of user ${userId}.`);
  } catch (error) {
    console.error(`Error deleting ${type} vector:`, error);
    throw error;
  }
};

export const queryPinecone = async (userId, query = "") => {
  try {
    await ensureInitialized();

    if (!index) {
      throw new Error("Pinecone index is not initialized");
    }

    let queryVector;
    try {
      queryVector = await generateEmbedding(query);
    } catch (error) {
      console.error("Error generating embedding for query:", error);
      // If we can't generate an embedding, fall back to a metadata-only query
      queryVector = null;
    }

    const queryRequest = {
      topK: 20,
      filter: { userId: userId },
      includeMetadata: true,
    };

    if (queryVector) {
      queryRequest.vector = queryVector;
    }

    const queryResponse = await index.query(queryRequest);

    const relevantContent = queryResponse.matches
      .map(
        (match) =>
          `[${match.metadata.type.toUpperCase()}]: ${match.metadata.content}`
      )
      .join("\n\n");

    return relevantContent;
  } catch (error) {
    console.error("Error querying Pinecone:", error);
    // Return an empty string instead of throwing an error
    return "";
  }
};

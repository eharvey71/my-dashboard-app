// Lambda function to cleanup orphaned Pinecone vectors
// Triggered by EventBridge every 12 hours

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { Pinecone } = require('@pinecone-database/pinecone');

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

const index = pinecone.Index(process.env.PINECONE_INDEX);

exports.handler = async (event) => {
  console.log('Cleanup Pinecone vectors - event:', JSON.stringify(event, null, 2));

  try {
    // Fetch all document IDs from DynamoDB
    const [notesResult, tasksResult, documentsResult, bookmarksResult] = await Promise.all([
      docClient.send(new ScanCommand({ TableName: 'cognify-notes' })),
      docClient.send(new ScanCommand({ TableName: 'cognify-tasks' })),
      docClient.send(new ScanCommand({ TableName: 'cognify-documents' })),
      docClient.send(new ScanCommand({ TableName: 'cognify-bookmarks' })),
    ]);

    const validIds = new Set([
      ...(notesResult.Items || []).map((doc) => `${doc.userId}-${doc.projectId}-${doc.id}`),
      ...(tasksResult.Items || []).map((doc) => `${doc.userId}-${doc.projectId}-${doc.id}`),
      ...(documentsResult.Items || []).map((doc) => `${doc.userId}-${doc.projectId}-${doc.id}`),
    ]);

    console.log(`Found ${validIds.size} valid note/task/document IDs`);

    const validBookmarks = new Set(
      (bookmarksResult.Items || []).map(
        (doc) => `${doc.userId}-${doc.projectId}-${doc.id}-${doc.url}`
      )
    );

    console.log(`Found ${validBookmarks.size} valid bookmark IDs`);

    // Fetch all vector IDs from Pinecone
    const queryResponse = await index.query({
      vector: Array(1536).fill(0),
      topK: 10000,
      includeMetadata: true,
    });

    console.log(`Retrieved ${queryResponse.matches.length} vectors from Pinecone`);

    const idsToDelete = [];

    queryResponse.matches.forEach((match) => {
      const [userId, projectId, type, docId, ...rest] = match.id.split('-');

      if (type === 'bookmark') {
        // For bookmarks, check against the URL in metadata
        if (!validBookmarks.has(`${userId}-${projectId}-${docId}-${match.metadata.url}`)) {
          idsToDelete.push(match.id);
        }
      } else {
        // For notes, tasks, and documents
        if (!validIds.has(`${userId}-${projectId}-${docId}`)) {
          idsToDelete.push(match.id);
        }
      }
    });

    console.log(`Identified ${idsToDelete.length} vectors to delete`);

    if (idsToDelete.length > 0) {
      // Batch deletion
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

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Cleanup complete',
        deletedCount: idsToDelete.length,
      }),
    };
  } catch (error) {
    console.error('Error in cleanupPineconeVectors:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

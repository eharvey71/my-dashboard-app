// Lambda function to retry failed indexing operations
// Triggered by EventBridge every 6 hours

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { Pinecone } = require('@pinecone-database/pinecone');
const { OpenAI } = require('openai');

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const index = pinecone.Index(process.env.PINECONE_INDEX);

async function createEmbedding(text) {
  const response = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: text,
  });
  return response.data[0].embedding;
}

exports.handler = async (event) => {
  console.log('Retry failed indexing - event:', JSON.stringify(event, null, 2));

  const tables = [
    { name: 'cognify-tasks', type: 'task' },
    { name: 'cognify-notes', type: 'note' },
    { name: 'cognify-documents', type: 'document' },
  ];

  for (const table of tables) {
    try {
      // Scan for items with indexedInPinecone = false
      const result = await docClient.send(
        new ScanCommand({
          TableName: table.name,
          FilterExpression: 'indexedInPinecone = :false',
          ExpressionAttributeValues: {
            ':false': false,
          },
        })
      );

      console.log(`Found ${result.Items?.length || 0} failed items in ${table.name}`);

      for (const item of result.Items || []) {
        try {
          const embedding = await createEmbedding(item.content);

          await index.upsert([
            {
              id: `${item.userId}-${item.projectId}-${table.type}-${item.id}`,
              values: embedding,
              metadata: {
                userId: item.userId,
                projectId: item.projectId,
                type: table.type,
                content: item.content,
              },
            },
          ]);

          await docClient.send(
            new UpdateCommand({
              TableName: table.name,
              Key: { id: item.id },
              UpdateExpression: 'SET indexedInPinecone = :true',
              ExpressionAttributeValues: {
                ':true': true,
              },
            })
          );

          console.log(`Successfully re-indexed ${table.type} with ID: ${item.id}`);
        } catch (error) {
          console.error(`Error re-indexing ${table.type} ${item.id}:`, error);
        }
      }
    } catch (error) {
      console.error(`Error processing ${table.name}:`, error);
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Retry indexing complete' }),
  };
};

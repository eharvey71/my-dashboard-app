// Lambda function to index tasks, notes, and documents to Pinecone
// Triggered by DynamoDB Streams

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
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
  console.log('Processing DynamoDB Stream event:', JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    // Only process INSERT events
    if (record.eventName !== 'INSERT') {
      continue;
    }

    const newImage = record.dynamodb.NewImage;

    // Extract data from DynamoDB format
    const id = newImage.id?.S;
    const content = newImage.content?.S;
    const userId = newImage.userId?.S;
    const projectId = newImage.projectId?.S;
    const priority = newImage.priority?.S || newImage.priority?.N;

    // Determine type from the event source ARN (table name)
    const tableName = record.eventSourceARN.split('/')[1];
    let type;
    if (tableName.includes('tasks')) {
      type = 'task';
    } else if (tableName.includes('notes')) {
      type = 'note';
    } else if (tableName.includes('documents')) {
      type = 'document';
    } else {
      console.log('Unknown table, skipping:', tableName);
      continue;
    }

    if (!id || !content || !userId || !projectId) {
      console.error('Missing required fields:', { id, userId, projectId, hasContent: !!content });
      continue;
    }

    try {
      // Create metadata
      const metadata = {
        userId,
        projectId,
        type,
        content,
      };

      if (type === 'task' && priority) {
        metadata.priority = priority;
      }

      // Create embedding
      const embedding = await createEmbedding(content);

      // Index to Pinecone
      const vectorId = `${userId}-${projectId}-${type}-${id}`;
      await index.upsert([
        {
          id: vectorId,
          values: embedding,
          metadata: metadata,
        },
      ]);

      // Update DynamoDB item to indicate successful indexing
      await docClient.send(new UpdateCommand({
        TableName: tableName,
        Key: { id },
        UpdateExpression: 'SET indexedInPinecone = :true',
        ExpressionAttributeValues: {
          ':true': true,
        },
      }));

      console.log(`Successfully indexed ${type} with ID: ${id} for project: ${projectId}`);
    } catch (error) {
      console.error(`Error indexing ${type} ${id}:`, error);

      // Update DynamoDB to indicate failed indexing
      try {
        await docClient.send(new UpdateCommand({
          TableName: tableName,
          Key: { id },
          UpdateExpression: 'SET indexedInPinecone = :false, #error = :errorMsg',
          ExpressionAttributeNames: {
            '#error': 'error',
          },
          ExpressionAttributeValues: {
            ':false': false,
            ':errorMsg': error.message,
          },
        }));
      } catch (updateError) {
        console.error('Error updating failure status:', updateError);
      }
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Processing complete' }),
  };
};

// Lambda function to scrape and index bookmarks to Pinecone
// Triggered by DynamoDB Streams

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { Pinecone } = require('@pinecone-database/pinecone');
const { OpenAI } = require('openai');
const axios = require('axios');
const cheerio = require('cheerio');

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
  console.log('Processing bookmark DynamoDB Stream event:', JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    // Only process INSERT events
    if (record.eventName !== 'INSERT') {
      continue;
    }

    const newImage = record.dynamodb.NewImage;

    // Extract data from DynamoDB format
    const id = newImage.id?.S;
    const url = newImage.url?.S;
    const userId = newImage.userId?.S;
    const projectId = newImage.projectId?.S;

    if (!id || !url || !userId || !projectId) {
      console.error('Missing required fields:', { id, url, userId, projectId });
      continue;
    }

    try {
      // Scrape website content
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; CognifyBot/1.0)',
        },
      });

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

      // Create embeddings and index chunks
      for (let i = 0; i < chunks.length; i++) {
        const embedding = await createEmbedding(chunks[i]);
        await index.upsert([
          {
            id: `${userId}-${projectId}-bookmark-${id}-${i}`,
            values: embedding,
            metadata: {
              userId,
              projectId,
              type: 'bookmark',
              content: chunks[i],
              url,
              chunkIndex: i,
            },
          },
        ]);
      }

      // Update bookmark to indicate successful indexing
      const tableName = record.eventSourceARN.split('/')[1];
      await docClient.send(new UpdateCommand({
        TableName: tableName,
        Key: { id },
        UpdateExpression: 'SET indexed = :true',
        ExpressionAttributeValues: {
          ':true': true,
        },
      }));

      console.log(`Successfully scraped and indexed bookmark: ${url}`);
    } catch (error) {
      console.error(`Error processing bookmark ${url}:`, error);

      // Update bookmark to indicate failed indexing
      try {
        const tableName = record.eventSourceARN.split('/')[1];
        await docClient.send(new UpdateCommand({
          TableName: tableName,
          Key: { id },
          UpdateExpression: 'SET indexed = :false, #error = :errorMsg',
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

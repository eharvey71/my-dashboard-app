// Lambda function to query Pinecone for relevant content
// Exposed via API Gateway

const { Pinecone } = require('@pinecone-database/pinecone');
const { OpenAI } = require('openai');

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
  console.log('Query Pinecone event:', JSON.stringify(event, null, 2));

  try {
    // Get userId from Cognito authorizer
    const userId = event.requestContext.authorizer.claims.sub;

    // Parse request body
    const body = JSON.parse(event.body);
    const { query, projectId } = body;

    if (!projectId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'projectId is required' }),
      };
    }

    let queryVector;
    try {
      queryVector = await createEmbedding(query);
    } catch (error) {
      console.error('Error generating embedding for query:', error);
      queryVector = null;
    }

    const queryRequest = {
      topK: 20,
      filter: { userId, projectId },
      includeMetadata: true,
    };

    if (queryVector) {
      queryRequest.vector = queryVector;
    }

    const queryResponse = await index.query(queryRequest);

    const relevantContent = queryResponse.matches
      .map((match) => {
        const type = match.metadata.type.toUpperCase();
        const priority = match.metadata.priority
          ? ` (Priority: ${match.metadata.priority})`
          : '';
        return `[${type}${priority}]: ${match.metadata.content}`;
      })
      .join('\n\n');

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ relevantContent }),
    };
  } catch (error) {
    console.error('Error querying Pinecone:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Error querying Pinecone', details: error.message }),
    };
  }
};

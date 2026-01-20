// Lambda function to generate AI suggestions based on project content
// Exposed via API Gateway

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { OpenAI } = require('openai');

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

exports.handler = async (event) => {
  console.log('Generate suggestions event:', JSON.stringify(event, null, 2));

  try {
    // Get userId from Cognito authorizer
    const userId = event.requestContext.authorizer.claims.sub;

    // Parse request body
    const body = JSON.parse(event.body);
    const { projectId } = body;

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

    // Fetch project content from DynamoDB
    const [tasks, notes, bookmarks, documents] = await Promise.all([
      docClient.send(new QueryCommand({
        TableName: 'cognify-tasks',
        IndexName: 'UserProjectIndex',
        KeyConditionExpression: 'userId = :userId AND projectId = :projectId',
        ExpressionAttributeValues: {
          ':userId': userId,
          ':projectId': projectId,
        },
      })),
      docClient.send(new QueryCommand({
        TableName: 'cognify-notes',
        IndexName: 'UserProjectIndex',
        KeyConditionExpression: 'userId = :userId AND projectId = :projectId',
        ExpressionAttributeValues: {
          ':userId': userId,
          ':projectId': projectId,
        },
      })),
      docClient.send(new QueryCommand({
        TableName: 'cognify-bookmarks',
        IndexName: 'UserProjectIndex',
        KeyConditionExpression: 'userId = :userId AND projectId = :projectId',
        ExpressionAttributeValues: {
          ':userId': userId,
          ':projectId': projectId,
        },
      })),
      docClient.send(new QueryCommand({
        TableName: 'cognify-documents',
        IndexName: 'UserProjectIndex',
        KeyConditionExpression: 'userId = :userId AND projectId = :projectId',
        ExpressionAttributeValues: {
          ':userId': userId,
          ':projectId': projectId,
        },
      })),
    ]);

    // Combine all content
    const allContent = [
      ...(tasks.Items || []).map((item) => item.content),
      ...(notes.Items || []).map((item) => item.content),
      ...(bookmarks.Items || []).map((item) => item.title),
      ...(documents.Items || []).map((item) => {
        return `Document (${item.title}): ${item.content}`;
      }),
    ].join('\n\n');

    console.log('Project content length:', allContent.length);

    // Use OpenAI to generate suggestions
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content:
            'You are an AI assistant that generates insightful questions based on project content. Generate 3 questions that would help the user analyze or explore their project further. Consider relationships between documents, tasks, notes, and bookmarks.',
        },
        {
          role: 'user',
          content: `Based on the following project content, generate 3 insightful questions. Pay special attention to any documents and how they relate to other project items:\n\n${allContent}`,
        },
      ],
      max_tokens: 200,
      temperature: 0.7,
    });

    const suggestions = response.choices[0].message.content.trim().split('\n');

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ suggestions: suggestions.slice(0, 3) }),
    };
  } catch (error) {
    console.error('Error generating suggestions:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Error generating suggestions', details: error.message }),
    };
  }
};

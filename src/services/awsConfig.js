// AWS Service Layer - Mirrors Firebase Config
// This provides the same API as firebaseConfig.js but uses AWS services

import { Amplify, Auth } from 'aws-amplify';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';

// AWS Configuration
// These values will be output by CDK deployment
const awsConfig = {
  Auth: {
    region: import.meta.env.VITE_AWS_REGION || 'us-east-1',
    userPoolId: import.meta.env.VITE_AWS_USER_POOL_ID,
    userPoolWebClientId: import.meta.env.VITE_AWS_USER_POOL_CLIENT_ID,
    identityPoolId: import.meta.env.VITE_AWS_IDENTITY_POOL_ID,
  },
  API: {
    endpoints: [
      {
        name: 'cognifyAPI',
        endpoint: import.meta.env.VITE_AWS_API_ENDPOINT,
        region: import.meta.env.VITE_AWS_REGION || 'us-east-1',
      },
    ],
  },
};

// Configure Amplify
Amplify.configure(awsConfig);

// DynamoDB client
const client = new DynamoDBClient({
  region: awsConfig.Auth.region,
});
const docClient = DynamoDBDocumentClient.from(client);

// Table names
const TABLES = {
  PROJECTS: 'cognify-projects',
  TASKS: 'cognify-tasks',
  NOTES: 'cognify-notes',
  DOCUMENTS: 'cognify-documents',
  BOOKMARKS: 'cognify-bookmarks',
  SYNAPSES: 'cognify-synapses',
  AI_RESPONSES: 'cognify-ai-responses',
};

// Helper to generate unique IDs
const generateId = () => {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

// Helper to get current timestamp
const getTimestamp = () => new Date().toISOString();

// ==================== Authentication ====================

export const signInWithGoogle = async () => {
  try {
    const user = await Auth.federatedSignIn({ provider: 'Google' });
    return user;
  } catch (error) {
    console.error('Error signing in with Google:', error);
    throw error;
  }
};

export const signOut = async () => {
  try {
    await Auth.signOut();
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
};

export const getCurrentUser = async () => {
  try {
    const user = await Auth.currentAuthenticatedUser();
    return {
      uid: user.attributes.sub,
      email: user.attributes.email,
      displayName: user.attributes.name || user.attributes.email,
    };
  } catch (error) {
    return null;
  }
};

// ==================== Projects ====================

export const addProject = async (userId, name, educationMode, projectType) => {
  const id = generateId();
  const project = {
    id,
    userId,
    name,
    educationMode: educationMode || false,
    projectType: projectType || 'general',
    createdAt: getTimestamp(),
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLES.PROJECTS,
      Item: project,
    })
  );

  return { id, ...project };
};

export const getProjects = async (userId) => {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLES.PROJECTS,
      IndexName: 'UserIdIndex',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId,
      },
    })
  );

  return result.Items || [];
};

export const getProject = async (projectId) => {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLES.PROJECTS,
      Key: { id: projectId },
    })
  );

  return result.Item || null;
};

export const updateProject = async (projectId, updates) => {
  const updateExpressions = [];
  const expressionAttributeValues = {};
  const expressionAttributeNames = {};

  Object.keys(updates).forEach((key, index) => {
    const placeholder = `:val${index}`;
    const attributeName = `#attr${index}`;
    updateExpressions.push(`${attributeName} = ${placeholder}`);
    expressionAttributeValues[placeholder] = updates[key];
    expressionAttributeNames[attributeName] = key;
  });

  await docClient.send(
    new UpdateCommand({
      TableName: TABLES.PROJECTS,
      Key: { id: projectId },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeValues: expressionAttributeValues,
      ExpressionAttributeNames: expressionAttributeNames,
    })
  );
};

export const deleteProject = async (projectId) => {
  await docClient.send(
    new DeleteCommand({
      TableName: TABLES.PROJECTS,
      Key: { id: projectId },
    })
  );
};

// ==================== Tasks ====================

export const addTask = async (userId, projectId, content, priority) => {
  const id = generateId();
  const task = {
    id,
    userId,
    projectId,
    content,
    priority: priority || 'medium',
    completed: false,
    createdAt: getTimestamp(),
    indexedInPinecone: false,
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLES.TASKS,
      Item: task,
    })
  );

  return { id, ...task };
};

export const getTasks = async (userId, projectId) => {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLES.TASKS,
      IndexName: 'UserProjectIndex',
      KeyConditionExpression: 'userId = :userId AND projectId = :projectId',
      ExpressionAttributeValues: {
        ':userId': userId,
        ':projectId': projectId,
      },
    })
  );

  return result.Items || [];
};

export const updateTask = async (taskId, updates) => {
  const updateExpressions = [];
  const expressionAttributeValues = {};
  const expressionAttributeNames = {};

  Object.keys(updates).forEach((key, index) => {
    const placeholder = `:val${index}`;
    const attributeName = `#attr${index}`;
    updateExpressions.push(`${attributeName} = ${placeholder}`);
    expressionAttributeValues[placeholder] = updates[key];
    expressionAttributeNames[attributeName] = key;
  });

  await docClient.send(
    new UpdateCommand({
      TableName: TABLES.TASKS,
      Key: { id: taskId },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeValues: expressionAttributeValues,
      ExpressionAttributeNames: expressionAttributeNames,
    })
  );
};

export const deleteTask = async (taskId) => {
  await docClient.send(
    new DeleteCommand({
      TableName: TABLES.TASKS,
      Key: { id: taskId },
    })
  );
};

// ==================== Notes ====================

export const addNote = async (userId, projectId, content) => {
  const id = generateId();
  const note = {
    id,
    userId,
    projectId,
    content,
    createdAt: getTimestamp(),
    indexedInPinecone: false,
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLES.NOTES,
      Item: note,
    })
  );

  return { id, ...note };
};

export const getNotes = async (userId, projectId) => {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLES.NOTES,
      IndexName: 'UserProjectIndex',
      KeyConditionExpression: 'userId = :userId AND projectId = :projectId',
      ExpressionAttributeValues: {
        ':userId': userId,
        ':projectId': projectId,
      },
    })
  );

  return result.Items || [];
};

export const updateNote = async (noteId, content) => {
  await docClient.send(
    new UpdateCommand({
      TableName: TABLES.NOTES,
      Key: { id: noteId },
      UpdateExpression: 'SET content = :content',
      ExpressionAttributeValues: {
        ':content': content,
      },
    })
  );
};

export const deleteNote = async (noteId) => {
  await docClient.send(
    new DeleteCommand({
      TableName: TABLES.NOTES,
      Key: { id: noteId },
    })
  );
};

// ==================== Documents ====================

export const addDocument = async (userId, projectId, title, content) => {
  const id = generateId();
  const document = {
    id,
    userId,
    projectId,
    title,
    content,
    createdAt: getTimestamp(),
    updatedAt: getTimestamp(),
    indexedInPinecone: false,
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLES.DOCUMENTS,
      Item: document,
    })
  );

  return { id, ...document };
};

export const getDocuments = async (userId, projectId) => {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLES.DOCUMENTS,
      IndexName: 'UserProjectIndex',
      KeyConditionExpression: 'userId = :userId AND projectId = :projectId',
      ExpressionAttributeValues: {
        ':userId': userId,
        ':projectId': projectId,
      },
    })
  );

  return result.Items || [];
};

export const getDocument = async (documentId) => {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLES.DOCUMENTS,
      Key: { id: documentId },
    })
  );

  return result.Item || null;
};

export const updateDocument = async (documentId, title, content) => {
  await docClient.send(
    new UpdateCommand({
      TableName: TABLES.DOCUMENTS,
      Key: { id: documentId },
      UpdateExpression: 'SET title = :title, content = :content, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':title': title,
        ':content': content,
        ':updatedAt': getTimestamp(),
      },
    })
  );
};

export const deleteDocument = async (documentId) => {
  await docClient.send(
    new DeleteCommand({
      TableName: TABLES.DOCUMENTS,
      Key: { id: documentId },
    })
  );
};

// ==================== Bookmarks ====================

export const addBookmark = async (userId, projectId, url, title) => {
  const id = generateId();
  const bookmark = {
    id,
    userId,
    projectId,
    url,
    title,
    createdAt: getTimestamp(),
    indexed: false,
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLES.BOOKMARKS,
      Item: bookmark,
    })
  );

  return { id, ...bookmark };
};

export const getBookmarks = async (userId, projectId) => {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLES.BOOKMARKS,
      IndexName: 'UserProjectIndex',
      KeyConditionExpression: 'userId = :userId AND projectId = :projectId',
      ExpressionAttributeValues: {
        ':userId': userId,
        ':projectId': projectId,
      },
    })
  );

  return result.Items || [];
};

export const deleteBookmark = async (bookmarkId) => {
  await docClient.send(
    new DeleteCommand({
      TableName: TABLES.BOOKMARKS,
      Key: { id: bookmarkId },
    })
  );
};

// ==================== Synapses ====================

export const addSynapse = async (userId, projectId, name, contentIds) => {
  const id = generateId();
  const synapse = {
    id,
    userId,
    projectId,
    name,
    contentIds: contentIds || [],
    createdAt: getTimestamp(),
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLES.SYNAPSES,
      Item: synapse,
    })
  );

  return { id, ...synapse };
};

export const getSynapses = async (userId, projectId) => {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLES.SYNAPSES,
      IndexName: 'UserProjectIndex',
      KeyConditionExpression: 'userId = :userId AND projectId = :projectId',
      ExpressionAttributeValues: {
        ':userId': userId,
        ':projectId': projectId,
      },
    })
  );

  return result.Items || [];
};

export const updateSynapse = async (synapseId, updates) => {
  const updateExpressions = [];
  const expressionAttributeValues = {};
  const expressionAttributeNames = {};

  Object.keys(updates).forEach((key, index) => {
    const placeholder = `:val${index}`;
    const attributeName = `#attr${index}`;
    updateExpressions.push(`${attributeName} = ${placeholder}`);
    expressionAttributeValues[placeholder] = updates[key];
    expressionAttributeNames[attributeName] = key;
  });

  await docClient.send(
    new UpdateCommand({
      TableName: TABLES.SYNAPSES,
      Key: { id: synapseId },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeValues: expressionAttributeValues,
      ExpressionAttributeNames: expressionAttributeNames,
    })
  );
};

export const deleteSynapse = async (synapseId) => {
  await docClient.send(
    new DeleteCommand({
      TableName: TABLES.SYNAPSES,
      Key: { id: synapseId },
    })
  );
};

// ==================== AI Responses ====================

export const addAIResponse = async (userId, projectId, content, synapseId, synapseName, type) => {
  const id = generateId();
  const response = {
    id,
    userId,
    projectId,
    content,
    synapseId: synapseId || '',
    synapseName: synapseName || '',
    type: type || 'synapse-analysis',
    included: true,
    createdAt: getTimestamp(),
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLES.AI_RESPONSES,
      Item: response,
    })
  );

  return { id, ...response };
};

export const getAIResponses = async (userId, projectId) => {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLES.AI_RESPONSES,
      IndexName: 'UserProjectIndex',
      KeyConditionExpression: 'userId = :userId AND projectId = :projectId',
      ExpressionAttributeValues: {
        ':userId': userId,
        ':projectId': projectId,
      },
    })
  );

  return result.Items || [];
};

export const deleteAIResponse = async (responseId) => {
  await docClient.send(
    new DeleteCommand({
      TableName: TABLES.AI_RESPONSES,
      Key: { id: responseId },
    })
  );
};

// Export AWS-specific objects for direct use if needed
export { Auth, Amplify, docClient };

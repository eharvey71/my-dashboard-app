// Lambda function to convert tasks to a document
// Exposed via API Gateway

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, PutCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

exports.handler = async (event) => {
  console.log('Convert tasks event:', JSON.stringify(event, null, 2));

  try {
    // Get userId from Cognito authorizer
    const userId = event.requestContext.authorizer.claims.sub;

    // Parse request body
    const body = JSON.parse(event.body);
    const { projectId, documentTitle = 'Tasks Summary', archiveTasks = false } = body;

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

    // Get all tasks for the project
    const taskResult = await docClient.send(
      new QueryCommand({
        TableName: 'cognify-tasks',
        IndexName: 'UserProjectIndex',
        KeyConditionExpression: 'userId = :userId AND projectId = :projectId',
        ExpressionAttributeValues: {
          ':userId': userId,
          ':projectId': projectId,
        },
      })
    );

    if (!taskResult.Items || taskResult.Items.length === 0) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          message: 'No tasks found for this project',
        }),
      };
    }

    // Group tasks by completion status
    const completedTasks = [];
    const incompleteTasks = [];

    taskResult.Items.forEach((task) => {
      if (task.completed) {
        completedTasks.push(task);
      } else {
        incompleteTasks.push(task);
      }
    });

    // Sort by priority
    const sortByPriority = (a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };

      const getPriorityValue = (task) => {
        if (!task.priority) return 3;
        if (typeof task.priority === 'string') {
          return priorityOrder[task.priority.toLowerCase()] || 3;
        }
        return typeof task.priority === 'number' ? task.priority : 3;
      };

      return getPriorityValue(a) - getPriorityValue(b);
    };

    incompleteTasks.sort(sortByPriority);
    completedTasks.sort(sortByPriority);

    // Format markdown content
    const currentDate = new Date().toLocaleDateString();
    let documentContent = `# ${documentTitle}\n\nGenerated on ${currentDate}\n\n`;

    // Add incomplete tasks section
    documentContent += `## Active Tasks (${incompleteTasks.length})\n\n`;

    if (incompleteTasks.length > 0) {
      const highPriority = incompleteTasks.filter((t) => {
        if (!t.priority) return false;
        if (typeof t.priority === 'string') return t.priority.toLowerCase() === 'high';
        if (typeof t.priority === 'number') return t.priority === 1;
        return false;
      });

      const mediumPriority = incompleteTasks.filter((t) => {
        if (!t.priority) return false;
        if (typeof t.priority === 'string') return t.priority.toLowerCase() === 'medium';
        if (typeof t.priority === 'number') return t.priority === 2;
        return false;
      });

      const lowPriority = incompleteTasks.filter((t) => {
        if (!t.priority) return false;
        if (typeof t.priority === 'string') return t.priority.toLowerCase() === 'low';
        if (typeof t.priority === 'number') return t.priority === 3;
        return false;
      });

      const noPriority = incompleteTasks.filter((t) => !t.priority);

      if (highPriority.length > 0) {
        documentContent += `### High Priority\n\n`;
        highPriority.forEach((task) => {
          const dueDate = task.nextDueDate
            ? `\n**Due:** ${new Date(task.nextDueDate).toLocaleDateString()}`
            : '';
          const notes = task.notes ? `\n\n${task.notes}` : '';
          documentContent += `${task.title || task.content}${dueDate}${notes}\n\n`;
        });
      }

      if (mediumPriority.length > 0) {
        documentContent += `### Medium Priority\n\n`;
        mediumPriority.forEach((task) => {
          const dueDate = task.nextDueDate
            ? `\n**Due:** ${new Date(task.nextDueDate).toLocaleDateString()}`
            : '';
          const notes = task.notes ? `\n\n${task.notes}` : '';
          documentContent += `${task.title || task.content}${dueDate}${notes}\n\n`;
        });
      }

      if (lowPriority.length > 0) {
        documentContent += `### Low Priority\n\n`;
        lowPriority.forEach((task) => {
          const dueDate = task.nextDueDate
            ? `\n**Due:** ${new Date(task.nextDueDate).toLocaleDateString()}`
            : '';
          const notes = task.notes ? `\n\n${task.notes}` : '';
          documentContent += `${task.title || task.content}${dueDate}${notes}\n\n`;
        });
      }

      if (noPriority.length > 0) {
        documentContent += `### No Priority Set\n\n`;
        noPriority.forEach((task) => {
          const dueDate = task.nextDueDate
            ? `\n**Due:** ${new Date(task.nextDueDate).toLocaleDateString()}`
            : '';
          const notes = task.notes ? `\n\n${task.notes}` : '';
          documentContent += `${task.title || task.content}${dueDate}${notes}\n\n`;
        });
      }
    } else {
      documentContent += '*No active tasks*\n\n';
    }

    // Add completed tasks section
    documentContent += `## Completed Tasks (${completedTasks.length})\n\n`;

    if (completedTasks.length > 0) {
      completedTasks.forEach((task) => {
        const completedDate = task.completedAt
          ? `\n**Completed:** ${new Date(task.completedAt).toLocaleDateString()}`
          : '';
        const notes = task.notes ? `\n\n${task.notes}` : '';
        documentContent += `${task.title || task.content}${completedDate}${notes}\n\n`;
      });
    } else {
      documentContent += '*No completed tasks*\n\n';
    }

    // Create a new document
    const documentId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    await docClient.send(
      new PutCommand({
        TableName: 'cognify-documents',
        Item: {
          id: documentId,
          title: documentTitle,
          content: documentContent,
          userId,
          projectId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          source: 'task-conversion',
          indexedInPinecone: false,
        },
      })
    );

    // Archive tasks if requested
    let archivedCount = 0;
    if (archiveTasks) {
      const deletionPromises = completedTasks.map(async (task) => {
        try {
          await docClient.send(
            new DeleteCommand({
              TableName: 'cognify-tasks',
              Key: { id: task.id },
            })
          );
          archivedCount++;
        } catch (err) {
          console.error(`Error deleting task ${task.id}:`, err);
        }
      });

      await Promise.all(deletionPromises);
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        documentId,
        documentTitle,
        archivedCount,
        totalTasks: taskResult.Items.length,
      }),
    };
  } catch (error) {
    console.error('Error converting tasks to document:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Error converting tasks to document',
        details: error.message,
      }),
    };
  }
};

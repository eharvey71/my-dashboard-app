# Cognify AWS Lambda Functions

This directory contains Lambda functions for the Cognify application, replacing Firebase Cloud Functions.

## Directory Structure

```
functions-aws/
├── layers/
│   └── shared/           # Shared dependencies layer
│       └── nodejs/
│           └── package.json
├── index-content/        # Index tasks/notes/documents to Pinecone
├── scrape-bookmark/      # Scrape and index bookmarks
├── query-pinecone/       # Query Pinecone API endpoint
├── analyze-content/      # AI content analysis endpoint
├── generate-suggestions/ # AI suggestions endpoint
├── analyze-synapse/      # Synapse analysis endpoint
├── convert-tasks/        # Convert tasks to document endpoint
├── cleanup-pinecone/     # Cleanup orphaned vectors (scheduled)
└── retry-indexing/       # Retry failed indexing (scheduled)
```

## Lambda Functions

### Event-Driven Functions (DynamoDB Streams)

**index-content** - Triggered when tasks, notes, or documents are created
- Creates embeddings using OpenAI
- Indexes content to Pinecone
- Updates DynamoDB item with indexing status

**scrape-bookmark** - Triggered when bookmarks are created
- Scrapes URL content using Axios and Cheerio
- Chunks text and creates embeddings
- Indexes bookmark chunks to Pinecone

### API Functions (REST endpoints via API Gateway)

**query-pinecone** - POST `/query-pinecone`
- Queries Pinecone for relevant content
- Filters by userId and projectId
- Returns formatted relevant content

**analyze-content** - POST `/analyze-content`
- Analyzes content using OpenAI GPT-3.5
- General purpose content analysis

**generate-suggestions** - POST `/generate-suggestions`
- Fetches project content from DynamoDB
- Generates AI-powered suggestions
- Returns 3 insightful questions

**analyze-synapse** - POST `/analyze-synapse`
- Comprehensive synapse analysis
- Supports multiple analysis types (comprehensive, relationships, summary, etc.)
- Supports multiple modes (core, expanded, creative)
- Uses GPT-4 for enhanced analysis

**convert-tasks** - POST `/convert-tasks`
- Converts project tasks to a formatted document
- Groups by priority and completion status
- Optionally archives completed tasks

### Scheduled Functions (EventBridge)

**cleanup-pinecone** - Runs every 12 hours
- Scans DynamoDB for all valid items
- Queries Pinecone for all vectors
- Deletes orphaned vectors

**retry-indexing** - Runs every 6 hours
- Scans DynamoDB for failed indexing operations
- Retries embedding creation and indexing
- Updates status on success

## Environment Variables

All Lambda functions require the following environment variables (set via CDK):

- `PINECONE_API_KEY` - Pinecone API key
- `PINECONE_INDEX` - Pinecone index name
- `OPENAI_API_KEY` - OpenAI API key

## Deployment

Lambda functions are deployed via AWS CDK:

```bash
cd aws-cdk
npx cdk deploy
```

The CDK stack automatically:
1. Creates Lambda functions from these source files
2. Attaches the shared layer with dependencies
3. Sets up DynamoDB Stream triggers
4. Configures API Gateway endpoints
5. Sets up EventBridge schedules
6. Grants appropriate IAM permissions

## Development

### Installing Dependencies for Local Testing

```bash
cd layers/shared/nodejs
npm install
```

### Testing Locally

You can test Lambda functions locally using the AWS SAM CLI or by invoking them directly with test events.

## Key Differences from Firebase Functions

1. **Authentication**: Uses Cognito instead of Firebase Auth
   - User ID from `event.requestContext.authorizer.claims.sub`

2. **Database**: Uses DynamoDB instead of Firestore
   - Different query syntax
   - GSI for userId/projectId queries

3. **Triggers**: Uses DynamoDB Streams instead of Firestore triggers
   - Different event structure
   - Manual parsing of DynamoDB format

4. **Scheduling**: Uses EventBridge instead of Cloud Scheduler
   - Similar cron syntax

5. **HTTP Functions**: Uses API Gateway integration
   - Different request/response format
   - Must return proper HTTP response with headers

## Migration Notes

- All core functionality has been preserved
- Vector ID format remains consistent: `userId-projectId-type-id`
- Content truncation (3000 chars) applied for token limits
- All analysis types and modes supported in analyze-synapse
- Bookmark chunking logic unchanged (1000 char chunks)

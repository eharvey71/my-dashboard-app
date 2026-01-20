# Cognify AWS Infrastructure

This directory contains AWS CDK infrastructure code to deploy the Cognify dashboard application on AWS as an alternative to Firebase.

## Architecture Overview

### Services Used

- **Cognito**: User authentication (replaces Firebase Auth)
- **DynamoDB**: NoSQL database (replaces Firestore)
- **Lambda**: Serverless functions (replaces Firebase Functions)
- **API Gateway**: REST API endpoints
- **S3 + CloudFront**: Static website hosting (replaces Firebase Hosting)
- **EventBridge**: Scheduled tasks (replaces Firebase Functions cron)
- **Pinecone**: Vector database (external, unchanged)
- **OpenAI**: AI services (external, unchanged)

### DynamoDB Tables

All tables use on-demand billing and have Global Secondary Indexes for querying by `userId` and `projectId`:

1. `cognify-projects` - User projects
2. `cognify-tasks` - Project tasks
3. `cognify-notes` - Project notes
4. `cognify-documents` - Project documents
5. `cognify-bookmarks` - Project bookmarks
6. `cognify-synapses` - Synapse collections
7. `cognify-ai-responses` - AI response history

### Lambda Functions

#### Event-Driven Functions (DynamoDB Streams)
- `cognify-index-content` - Indexes tasks/notes/documents to Pinecone when created
- `cognify-scrape-bookmark` - Scrapes and indexes bookmark URLs

#### API Functions (REST endpoints)
- `cognify-query-pinecone` - Query Pinecone for relevant content
- `cognify-analyze-content` - AI content analysis
- `cognify-generate-suggestions` - AI-powered suggestions
- `cognify-analyze-synapse` - Synapse analysis
- `cognify-convert-tasks` - Convert tasks to document

#### Scheduled Functions (EventBridge)
- `cognify-cleanup-pinecone` - Clean up orphaned vectors (every 12 hours)
- `cognify-retry-indexing` - Retry failed indexing operations (every 6 hours)

## Prerequisites

### 1. AWS CLI Setup
```bash
# Install AWS CLI
brew install awscli  # macOS
# or
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Configure AWS credentials
aws configure
# Enter your AWS Access Key ID, Secret Access Key, region (us-east-1 recommended)
```

### 2. Environment Variables
Create a `.env` file in the `aws-cdk` directory:

```bash
PINECONE_API_KEY=your-pinecone-api-key
PINECONE_INDEX=user-data-index
OPENAI_API_KEY=your-openai-api-key
```

### 3. Bootstrap AWS CDK (first time only)
```bash
npx cdk bootstrap aws://ACCOUNT-ID/REGION
```

Replace `ACCOUNT-ID` with your AWS account ID and `REGION` with your preferred region (e.g., `us-east-1`).

## Deployment

### Step 1: Create Lambda Function Code

Before deploying, you need to create the Lambda function code. The CDK expects Lambda functions in `../functions-aws/`:

```
functions-aws/
├── layers/
│   └── shared/           # Shared dependencies (OpenAI, Pinecone, etc.)
├── index-content/        # Index content to Pinecone
├── scrape-bookmark/      # Scrape and index bookmarks
├── query-pinecone/       # Query Pinecone API
├── analyze-content/      # AI content analysis
├── generate-suggestions/ # AI suggestions
├── analyze-synapse/      # Synapse analysis
├── convert-tasks/        # Convert tasks to document
├── cleanup-pinecone/     # Cleanup orphaned vectors
└── retry-indexing/       # Retry failed indexing
```

Each function directory should contain:
- `index.js` - Handler function
- `package.json` - Dependencies (if any beyond the shared layer)

The next step is to port the Firebase Functions code to these Lambda functions.

### Step 2: Build the CDK Stack
```bash
cd aws-cdk
npm run build
```

### Step 3: Preview Changes
```bash
npx cdk diff
```

### Step 4: Deploy Infrastructure
```bash
# Deploy all resources
npx cdk deploy

# Or deploy specific stacks
npx cdk deploy AwsCdkStack
```

After deployment, CDK will output important values:
- `UserPoolId` - Cognito User Pool ID
- `UserPoolClientId` - Cognito Client ID
- `IdentityPoolId` - Cognito Identity Pool ID
- `ApiEndpoint` - API Gateway URL
- `DistributionDomain` - CloudFront URL for frontend
- `WebsiteBucketName` - S3 bucket name

### Step 5: Deploy Frontend

After the infrastructure is deployed:

1. Build the React app with AWS configuration
2. Upload to S3:
```bash
aws s3 sync ../dist/ s3://BUCKET-NAME --delete
```

3. Invalidate CloudFront cache:
```bash
aws cloudfront create-invalidation --distribution-id DISTRIBUTION-ID --paths "/*"
```

## Next Steps

### 1. Port Firebase Functions to Lambda

Convert each Firebase Function to a Lambda function:

**Example: Query Pinecone**
```javascript
// Firebase version (functions/index.js)
exports.queryPinecone = functions.https.onCall(async (data, context) => {
  // ... implementation
});

// Lambda version (functions-aws/query-pinecone/index.js)
exports.handler = async (event) => {
  const body = JSON.parse(event.body);
  const userId = event.requestContext.authorizer.claims.sub;

  // ... implementation

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(result),
  };
};
```

### 2. Create AWS Service Layer

Create a new service layer for React app (`src/services/awsConfig.js`) that mirrors Firebase:

```javascript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import { Amplify, Auth } from 'aws-amplify';

// Configure Amplify
Amplify.configure({
  Auth: {
    region: 'us-east-1',
    userPoolId: 'USER_POOL_ID',
    userPoolWebClientId: 'USER_POOL_CLIENT_ID',
    identityPoolId: 'IDENTITY_POOL_ID',
  },
  API: {
    endpoints: [
      {
        name: 'cognifyAPI',
        endpoint: 'API_GATEWAY_URL',
      },
    ],
  },
});

// DynamoDB client
const client = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

// Example: Add task
export const addTask = async (task) => {
  const command = new PutCommand({
    TableName: 'cognify-tasks',
    Item: {
      ...task,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
    },
  });

  await docClient.send(command);
};
```

### 3. Environment Switching

Create an environment variable to switch between Firebase and AWS:

```javascript
// src/config.js
const env = import.meta.env.VITE_BACKEND || 'firebase';

export const backend = {
  firebase: env === 'firebase',
  aws: env === 'aws',
};

// In components
import { backend } from './config';
import * as firebaseService from './services/firebaseConfig';
import * as awsService from './services/awsConfig';

const service = backend.firebase ? firebaseService : awsService;

// Use service.addTask(), service.getTasks(), etc.
```

## Cost Estimates

### DynamoDB
- On-demand pricing: ~$1.25 per million writes, ~$0.25 per million reads
- Storage: $0.25/GB per month
- Expected monthly cost for low-medium usage: **$5-20**

### Lambda
- First 1M requests/month: FREE
- Additional: $0.20 per 1M requests
- Expected monthly cost: **$0-5**

### Cognito
- First 50,000 MAU (Monthly Active Users): FREE
- Expected monthly cost: **$0**

### API Gateway
- First 1M requests: $3.50
- Expected monthly cost: **$3-10**

### S3 + CloudFront
- S3 storage: $0.023/GB
- CloudFront data transfer: $0.085/GB
- Expected monthly cost: **$1-5**

### Total Estimated Cost
**$10-40/month** for low-medium usage

Compare to Firebase (Blaze plan):
- Firestore: $0.06 per 100K reads, $0.18 per 100K writes
- Functions: $0.40 per 1M invocations
- Hosting: $0.15/GB

AWS is typically **30-50% cheaper** for this usage pattern.

## Monitoring

### CloudWatch Dashboards
```bash
# View Lambda logs
aws logs tail /aws/lambda/cognify-index-content --follow

# View API Gateway logs
aws logs tail API-Gateway-Execution-Logs_API-ID/STAGE --follow
```

### X-Ray Tracing
Enable X-Ray tracing in CDK for distributed tracing:
```typescript
const fn = new lambda.Function(this, 'Function', {
  // ... other props
  tracing: lambda.Tracing.ACTIVE,
});
```

## Cleanup

To delete all AWS resources:
```bash
npx cdk destroy
```

⚠️ **Warning**: This will delete all data in DynamoDB tables unless `removalPolicy` is set to `RETAIN`.

## Troubleshooting

### Lambda timeout errors
Increase timeout in CDK:
```typescript
timeout: cdk.Duration.seconds(300), // 5 minutes
```

### CORS errors
Ensure API Gateway has CORS configured and Lambda returns proper headers.

### Cognito authentication errors
Check that the user pool client has the correct auth flows enabled.

## Useful CDK Commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `npx cdk deploy`  deploy this stack to your default AWS account/region
* `npx cdk diff`    compare deployed stack with current state
* `npx cdk synth`   emits the synthesized CloudFormation template
* `npx cdk destroy` destroy all resources

## Additional Resources

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [DynamoDB Best Practices](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html)
- [Lambda Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
- [Cognito Developer Guide](https://docs.aws.amazon.com/cognito/latest/developerguide/)

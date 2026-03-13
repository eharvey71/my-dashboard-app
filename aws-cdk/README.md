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

All tables use **provisioned billing** configured to stay within the AWS free tier (25 RCU / 25 WCU total). Each table has Global Secondary Indexes for querying by `userId` and `projectId`.

**Capacity Allocation (Free Tier Optimized - Total: 25 RCU / 25 WCU):**

1. `cognify-projects` - User projects (2 RCU / 2 WCU, GSI: 1/1)
2. `cognify-tasks` - Project tasks (4 RCU / 4 WCU, GSI: 2/2)
3. `cognify-notes` - Project notes (3 RCU / 3 WCU, GSI: 2/2)
4. `cognify-documents` - Project documents (2 RCU / 2 WCU, GSI: 1/1)
5. `cognify-bookmarks` - Project bookmarks (2 RCU / 2 WCU, GSI: 1/1)
6. `cognify-synapses` - Synapse collections (2 RCU / 2 WCU, GSI: 1/1)
7. `cognify-ai-responses` - AI response history (1 RCU / 1 WCU, GSI: 1/1)

**Note:** Point-in-time recovery is disabled to avoid additional costs (not included in free tier). For low-medium usage, this capacity should be sufficient. If you exceed these limits, DynamoDB will throttle requests.

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

## Cost Estimates (Free Tier Optimized)

This deployment is configured to maximize use of AWS free tier services:

### DynamoDB
- **Provisioned capacity: 25 RCU / 25 WCU (Free Tier)** ✅
- Storage: 25 GB free tier (first 25 GB)
- Expected monthly cost: **$0** (within free tier for low-medium usage)
- ⚠️ **Note:** If usage exceeds provisioned capacity, requests will be throttled (not charged)

### Lambda
- First 1M requests/month: **FREE** ✅
- First 400,000 GB-seconds compute: **FREE** ✅
- Expected monthly cost: **$0** (within free tier)

### Cognito
- First 50,000 MAU (Monthly Active Users): **FREE** ✅
- Expected monthly cost: **$0**

### API Gateway
- First 12 months: 1M API calls/month **FREE** ✅
- After 12 months: $3.50 per million requests
- Expected monthly cost: **$0** (first year), **$3-5** (after)

### S3 + CloudFront
- S3: First 5 GB storage **FREE** (12 months) ✅
- CloudFront: 1 TB data transfer **FREE** (always) ✅
- Expected monthly cost: **$0-2**

### External Services (Not Free)
- **Pinecone**: Free tier available, check pricing
- **OpenAI**: Pay per token, varies by usage

### Total Estimated AWS Cost
- **First 12 months: $0-2/month** (essentially free!)
- **After 12 months: $3-7/month** (API Gateway charges kick in)

### Compare to Firebase (Blaze plan)
- Firestore: $0.06 per 100K reads, $0.18 per 100K writes
- Functions: $0.40 per 1M invocations
- Hosting: $0.15/GB
- Typical cost: **$20-50/month**

**AWS with free tier is 90-100% cheaper in year 1, and 80-90% cheaper after!**

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

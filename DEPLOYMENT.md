# Cognify Deployment Guide

This guide explains how to deploy Cognify to either Firebase or AWS.

## Architecture

Cognify supports two backend architectures:

1. **Firebase** (default)
   - Firebase Auth for authentication
   - Firestore for database
   - Firebase Cloud Functions for serverless functions
   - Firebase Hosting for static website

2. **AWS** (alternative)
   - Amazon Cognito for authentication
   - DynamoDB for database
   - AWS Lambda for serverless functions
   - S3 + CloudFront for static website

## Switching Between Backends

The backend is controlled by the `VITE_BACKEND` environment variable:

```bash
# Use Firebase (default)
VITE_BACKEND=firebase

# Use AWS
VITE_BACKEND=aws
```

## Firebase Deployment

### Prerequisites

1. Install Firebase CLI:
```bash
npm install -g firebase-tools
```

2. Login to Firebase:
```bash
firebase login
```

### Setup

1. Copy the Firebase environment template:
```bash
cp .env.firebase.example .env
```

2. Fill in your Firebase configuration values in `.env`

3. Configure Firebase Functions:
```bash
cd functions
firebase functions:config:set \
  openai.key="your-openai-api-key" \
  pinecone.key="your-pinecone-api-key" \
  pinecone.index="user-data-index"
```

### Deploy

```bash
# Build the React app
npm run build

# Deploy everything
firebase deploy

# Or deploy individually
firebase deploy --only hosting
firebase deploy --only functions
```

### Access

Your app will be available at:
- https://your-project-id.web.app
- https://your-project-id.firebaseapp.com

## AWS Deployment

### Prerequisites

1. Install AWS CLI:
```bash
# macOS
brew install awscli

# Linux/Windows - see AWS documentation
```

2. Configure AWS credentials:
```bash
aws configure
# Enter your AWS Access Key ID, Secret Access Key, and region
```

3. Install AWS CDK:
```bash
npm install -g aws-cdk
```

### Setup

1. Bootstrap CDK (first time only):
```bash
cd aws-cdk
npx cdk bootstrap aws://ACCOUNT-ID/REGION
```

Replace `ACCOUNT-ID` with your AWS account ID and `REGION` with your preferred region (e.g., `us-east-1`).

2. Create environment file in `aws-cdk/`:
```bash
cd aws-cdk
cat > .env << EOF
PINECONE_API_KEY=your-pinecone-api-key
PINECONE_INDEX=user-data-index
OPENAI_API_KEY=your-openai-api-key
EOF
```

3. Install Lambda dependencies:
```bash
cd functions-aws/layers/shared/nodejs
npm install
cd ../../../..
```

### Deploy Infrastructure

```bash
cd aws-cdk

# Preview changes
npx cdk diff

# Deploy
npx cdk deploy
```

**Important:** Save the CDK outputs! You'll need these values for your frontend `.env` file:
- `UserPoolId`
- `UserPoolClientId`
- `IdentityPoolId`
- `ApiEndpoint`
- `WebsiteBucketName`
- `DistributionDomain`

### Configure Frontend

1. Copy the AWS environment template:
```bash
cd ..
cp .env.aws.example .env
```

2. Fill in the values from CDK outputs in `.env`:
```bash
VITE_BACKEND=aws
VITE_AWS_REGION=us-east-1
VITE_AWS_USER_POOL_ID=<UserPoolId from CDK>
VITE_AWS_USER_POOL_CLIENT_ID=<UserPoolClientId from CDK>
VITE_AWS_IDENTITY_POOL_ID=<IdentityPoolId from CDK>
VITE_AWS_API_ENDPOINT=<ApiEndpoint from CDK>
```

### Deploy Frontend

```bash
# Build the React app with AWS config
npm run build

# Upload to S3
aws s3 sync dist/ s3://BUCKET-NAME --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id DISTRIBUTION-ID \
  --paths "/*"
```

Replace `BUCKET-NAME` with the `WebsiteBucketName` from CDK outputs and `DISTRIBUTION-ID` with your CloudFront distribution ID.

### Access

Your app will be available at the CloudFront URL from CDK outputs (e.g., `https://d1234567890abc.cloudfront.net`).

## Development

### Run Locally with Firebase

```bash
# Set environment
cp .env.firebase.example .env

# Start dev server
npm run dev
```

### Run Locally with AWS

```bash
# Set environment
cp .env.aws.example .env
# Fill in AWS values from your deployment

# Start dev server
npm run dev
```

## Environment Variables Reference

### Common Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_BACKEND` | Backend type (`firebase` or `aws`) | Yes |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth client ID for Drive integration | Optional |
| `VITE_GOOGLE_API_KEY` | Google API key for Drive integration | Optional |

### Firebase Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_FIREBASE_API_KEY` | Firebase API key | Yes |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase auth domain | Yes |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID | Yes |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket | Yes |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID | Yes |
| `VITE_FIREBASE_APP_ID` | Firebase app ID | Yes |

### AWS Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_AWS_REGION` | AWS region | Yes |
| `VITE_AWS_USER_POOL_ID` | Cognito User Pool ID | Yes |
| `VITE_AWS_USER_POOL_CLIENT_ID` | Cognito User Pool Client ID | Yes |
| `VITE_AWS_IDENTITY_POOL_ID` | Cognito Identity Pool ID | Yes |
| `VITE_AWS_API_ENDPOINT` | API Gateway endpoint URL | Yes |

## Cost Comparison

### Firebase (Blaze Plan)

- **Firestore**: $0.06 per 100K reads, $0.18 per 100K writes
- **Functions**: $0.40 per 1M invocations
- **Hosting**: $0.15/GB
- **Estimated**: $20-50/month for low-medium usage

### AWS

- **DynamoDB**: ~$5-20/month (on-demand)
- **Lambda**: $0-5/month (1M free requests)
- **Cognito**: $0 (50K MAU free)
- **API Gateway**: $3-10/month
- **S3 + CloudFront**: $1-5/month
- **Estimated**: $10-40/month for low-medium usage

**AWS is typically 30-50% cheaper** for this usage pattern.

## Cleanup

### Firebase

```bash
# Delete hosting
firebase hosting:disable

# Manually delete project in Firebase Console
```

### AWS

```bash
cd aws-cdk
npx cdk destroy
```

**Warning:** This will delete all data in DynamoDB tables unless `removalPolicy` is set to `RETAIN`.

## Troubleshooting

### Firebase

- **Functions timeout**: Increase timeout in `functions/index.js`
- **CORS errors**: Check Firebase Functions CORS configuration
- **Auth errors**: Verify OAuth settings in Firebase Console

### AWS

- **Lambda timeout**: Increase timeout in CDK stack
- **CORS errors**: Check API Gateway CORS configuration
- **Cognito errors**: Verify user pool client settings
- **DynamoDB errors**: Check GSI configuration

## Support

For issues or questions:
1. Check the README files in `aws-cdk/` and `functions-aws/`
2. Review CloudWatch logs (AWS) or Firebase Console logs (Firebase)
3. Open an issue on the project repository

## Migration Between Backends

To migrate from Firebase to AWS (or vice versa):

1. Export data from source backend
2. Deploy target backend
3. Import data to target backend
4. Update `.env` to point to target backend
5. Test thoroughly before switching production traffic

Detailed migration scripts are available in `/scripts/migrate-*.js` (to be implemented).

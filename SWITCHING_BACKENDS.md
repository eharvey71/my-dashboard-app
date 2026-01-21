# Switching Between Firebase and AWS Backends

Cognify supports two backend architectures that can be switched via environment variables.

## Quick Switch Guide

### Switch to AWS

1. **Update `.env` file:**
   ```bash
   VITE_BACKEND=aws
   ```

2. **Rebuild the app:**
   ```bash
   npm run build
   ```

3. **For local development:**
   ```bash
   npm run dev
   ```
   App will connect to AWS (Cognito, DynamoDB, Lambda)

4. **For production deployment:**
   ```bash
   # Deploy to S3
   aws s3 sync dist/ s3://cognify-frontend-233632255343 --delete

   # Invalidate CloudFront cache
   aws cloudfront create-invalidation --distribution-id E29EVDKUE845ZJ --paths "/*"
   ```

### Switch to Firebase

1. **Update `.env` file:**
   ```bash
   VITE_BACKEND=firebase
   ```

2. **Rebuild the app:**
   ```bash
   npm run build
   ```

3. **For local development:**
   ```bash
   npm run dev
   ```
   App will connect to Firebase (Auth, Firestore, Functions)

4. **For production deployment:**
   ```bash
   firebase deploy
   ```

## Environment Variables Reference

### Required for AWS

```bash
VITE_BACKEND=aws
VITE_AWS_REGION=us-east-1
VITE_AWS_USER_POOL_ID=us-east-1_wI1KNxILe
VITE_AWS_USER_POOL_CLIENT_ID=jmrl3gm94gm5lbrtk6nqgfsm3
VITE_AWS_IDENTITY_POOL_ID=us-east-1:f00cb25e-4dec-4b4c-b097-fb89f796a5b6
VITE_AWS_API_ENDPOINT=https://txu6dr3h8k.execute-api.us-east-1.amazonaws.com/prod/
```

### Required for Firebase

```bash
VITE_BACKEND=firebase
VITE_FIREBASE_API_KEY=your-firebase-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

## How Backend Switching Works

The app uses a configuration file at `src/config/backend.js` that reads the `VITE_BACKEND` environment variable:

```javascript
const backendType = import.meta.env.VITE_BACKEND || 'firebase';

export const config = {
  backend: backendType,
  isFirebase: backendType === 'firebase',
  isAWS: backendType === 'aws',
};
```

Components import this config and conditionally load the appropriate service:

```javascript
import config from '../config/backend';
import * as firebaseService from '../services/firebaseConfig';
import * as awsService from '../services/awsConfig';

const service = config.isAWS ? awsService : firebaseService;

// Use service methods
await service.createProject(projectData);
await service.getTasks(projectId);
```

## Backend Feature Parity

Both backends provide the same API interface:

| Feature | Firebase | AWS |
|---------|----------|-----|
| Authentication | Firebase Auth | Cognito |
| Database | Firestore | DynamoDB |
| Serverless Functions | Cloud Functions | Lambda |
| Static Hosting | Firebase Hosting | S3 + CloudFront |
| Vector Search | Pinecone | Pinecone |
| AI Integration | OpenAI | OpenAI |

## Data Migration

**Important:** Firebase and AWS are completely separate backends with separate databases. Switching backends does NOT migrate your data.

### To migrate data from Firebase to AWS:

1. Export data from Firebase:
   ```bash
   # Run export script (to be created)
   node scripts/export-firebase.js > data.json
   ```

2. Import to AWS:
   ```bash
   # Run import script (to be created)
   node scripts/import-aws.js data.json
   ```

### To migrate data from AWS to Firebase:

1. Export from DynamoDB:
   ```bash
   node scripts/export-aws.js > data.json
   ```

2. Import to Firestore:
   ```bash
   node scripts/import-firebase.js data.json
   ```

> **Note:** Migration scripts are not yet implemented. Data must be manually migrated if needed.

## Testing Backend Switch

### 1. Test AWS locally:

```bash
# Set AWS backend
echo "VITE_BACKEND=aws" > .env
cat >> .env << 'EOF'
VITE_AWS_REGION=us-east-1
VITE_AWS_USER_POOL_ID=us-east-1_wI1KNxILe
VITE_AWS_USER_POOL_CLIENT_ID=jmrl3gm94gm5lbrtk6nqgfsm3
VITE_AWS_IDENTITY_POOL_ID=us-east-1:f00cb25e-4dec-4b4c-b097-fb89f796a5b6
VITE_AWS_API_ENDPOINT=https://txu6dr3h8k.execute-api.us-east-1.amazonaws.com/prod/
EOF

# Run dev server
npm run dev

# Open browser and check console - should see:
# "🔧 Backend configured: AWS"
```

### 2. Test Firebase locally:

```bash
# Set Firebase backend
echo "VITE_BACKEND=firebase" > .env
# Add your Firebase config variables...

# Run dev server
npm run dev

# Check console - should see:
# "🔧 Backend configured: FIREBASE"
```

## Troubleshooting

### AWS Issues

**"User is not authenticated"**
- Check Cognito User Pool ID is correct in `.env`
- Ensure you've created a user in Cognito (not Firebase)
- Clear browser cache and try again

**"DynamoDB access denied"**
- Check Lambda execution role has DynamoDB permissions
- Verify table names match in `awsConfig.js`

**"API Gateway 403"**
- Check API Gateway authorizer is configured for Cognito
- Verify the Authorization header is being sent

### Firebase Issues

**"Firebase: Error (auth/configuration-not-found)"**
- Check all Firebase env variables are set in `.env`
- Verify Firebase project ID is correct

**"Missing or insufficient permissions"**
- Check Firestore security rules
- Ensure user is authenticated

### General Issues

**"Backend not switching"**
- Run `npm run build` after changing `.env`
- Hard refresh browser (Cmd+Shift+R / Ctrl+Shift+R)
- Check browser console for backend confirmation message

**"Cannot read properties of undefined"**
- Some service methods may have minor differences
- Check the specific service layer implementation
- File an issue on GitHub

## Production Deployment Checklist

### Deploying to AWS:

- [ ] Set `VITE_BACKEND=aws` in `.env`
- [ ] Verify all AWS env variables are correct
- [ ] Run `npm run build`
- [ ] Upload to S3: `aws s3 sync dist/ s3://cognify-frontend-233632255343 --delete`
- [ ] Invalidate CloudFront: `aws cloudfront create-invalidation --distribution-id E29EVDKUE845ZJ --paths "/*"`
- [ ] Test: https://d1e3dhfxj8kdb0.cloudfront.net
- [ ] Create test user in Cognito
- [ ] Verify all features work

### Deploying to Firebase:

- [ ] Set `VITE_BACKEND=firebase` in `.env`
- [ ] Verify all Firebase env variables are correct
- [ ] Run `npm run build`
- [ ] Run `firebase deploy`
- [ ] Test: https://your-project.web.app
- [ ] Create test user in Firebase Auth
- [ ] Verify all features work

## Cost Comparison

### AWS (Current deployment):
- **Year 1:** $0-2/month (free tier)
- **After year 1:** $3-7/month
- **Estimated for 1000 users:** $20-30/month

### Firebase:
- **All years:** $20-50/month (Blaze plan)
- **Estimated for 1000 users:** $40-80/month

**AWS is 50-70% cheaper for low-medium usage.**

## Support

For issues with backend switching:
1. Check this guide's troubleshooting section
2. Review CloudWatch logs (AWS) or Firebase Console logs (Firebase)
3. Open an issue: [GitHub Issues](https://github.com/your-repo/issues)

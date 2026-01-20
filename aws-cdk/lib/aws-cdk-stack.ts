import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import * as path from 'path';

export class AwsCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ==================== DynamoDB Tables ====================
    // Projects table
    const projectsTable = new dynamodb.Table(this, 'ProjectsTable', {
      tableName: 'cognify-projects',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PROVISIONED,
      readCapacity: 2,
      writeCapacity: 2,
      removalPolicy: cdk.RemovalPolicy.RETAIN, // Protect data
      pointInTimeRecovery: false, // Disable to reduce costs (not free tier)
    });

    // Add GSI for querying by userId
    projectsTable.addGlobalSecondaryIndex({
      indexName: 'userId-index',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
      readCapacity: 1,
      writeCapacity: 1,
    });

    // Tasks table
    const tasksTable = new dynamodb.Table(this, 'TasksTable', {
      tableName: 'cognify-tasks',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PROVISIONED,
      readCapacity: 4,
      writeCapacity: 4,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecovery: false,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES, // For triggering indexing
    });

    tasksTable.addGlobalSecondaryIndex({
      indexName: 'userId-projectId-index',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'projectId', type: dynamodb.AttributeType.STRING },
      readCapacity: 2,
      writeCapacity: 2,
    });

    // Notes table
    const notesTable = new dynamodb.Table(this, 'NotesTable', {
      tableName: 'cognify-notes',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PROVISIONED,
      readCapacity: 3,
      writeCapacity: 3,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecovery: false,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
    });

    notesTable.addGlobalSecondaryIndex({
      indexName: 'userId-projectId-index',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'projectId', type: dynamodb.AttributeType.STRING },
      readCapacity: 2,
      writeCapacity: 2,
    });

    // Documents table
    const documentsTable = new dynamodb.Table(this, 'DocumentsTable', {
      tableName: 'cognify-documents',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PROVISIONED,
      readCapacity: 2,
      writeCapacity: 2,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecovery: false,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
    });

    documentsTable.addGlobalSecondaryIndex({
      indexName: 'userId-projectId-index',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'projectId', type: dynamodb.AttributeType.STRING },
      readCapacity: 1,
      writeCapacity: 1,
    });

    // Bookmarks table
    const bookmarksTable = new dynamodb.Table(this, 'BookmarksTable', {
      tableName: 'cognify-bookmarks',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PROVISIONED,
      readCapacity: 2,
      writeCapacity: 2,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecovery: false,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
    });

    bookmarksTable.addGlobalSecondaryIndex({
      indexName: 'userId-projectId-index',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'projectId', type: dynamodb.AttributeType.STRING },
      readCapacity: 1,
      writeCapacity: 1,
    });

    // Synapses table
    const synapsesTable = new dynamodb.Table(this, 'SynapsesTable', {
      tableName: 'cognify-synapses',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PROVISIONED,
      readCapacity: 2,
      writeCapacity: 2,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecovery: false,
    });

    synapsesTable.addGlobalSecondaryIndex({
      indexName: 'userId-projectId-index',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'projectId', type: dynamodb.AttributeType.STRING },
      readCapacity: 1,
      writeCapacity: 1,
    });

    // AI Responses table
    const aiResponsesTable = new dynamodb.Table(this, 'AIResponsesTable', {
      tableName: 'cognify-ai-responses',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PROVISIONED,
      readCapacity: 1,
      writeCapacity: 1,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecovery: false,
    });

    aiResponsesTable.addGlobalSecondaryIndex({
      indexName: 'userId-projectId-index',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'projectId', type: dynamodb.AttributeType.STRING },
      readCapacity: 1,
      writeCapacity: 1,
    });

    // ==================== Cognito User Pool ====================
    const userPool = new cognito.UserPool(this, 'CognifyUserPool', {
      userPoolName: 'cognify-users',
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
      },
      autoVerify: {
        email: true,
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // User pool client for web app
    const userPoolClient = userPool.addClient('WebClient', {
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
        },
        scopes: [cognito.OAuthScope.EMAIL, cognito.OAuthScope.OPENID, cognito.OAuthScope.PROFILE],
      },
    });

    // Identity pool for unauthenticated and authenticated access
    const identityPool = new cognito.CfnIdentityPool(this, 'CognifyIdentityPool', {
      identityPoolName: 'cognify-identity-pool',
      allowUnauthenticatedIdentities: false,
      cognitoIdentityProviders: [
        {
          clientId: userPoolClient.userPoolClientId,
          providerName: userPool.userPoolProviderName,
        },
      ],
    });

    // ==================== Lambda Layer for Shared Dependencies ====================
    const sharedLayer = new lambda.LayerVersion(this, 'SharedDependenciesLayer', {
      code: lambda.Code.fromAsset(path.join(__dirname, '../../functions-aws/layers/shared')),
      compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
      description: 'Shared dependencies for Lambda functions (OpenAI, Pinecone, etc.)',
    });

    // ==================== Lambda Functions ====================
    // Common Lambda environment variables
    const lambdaEnvironment = {
      PINECONE_API_KEY: process.env.PINECONE_API_KEY || '',
      PINECONE_INDEX: process.env.PINECONE_INDEX || '',
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
      PROJECTS_TABLE: projectsTable.tableName,
      TASKS_TABLE: tasksTable.tableName,
      NOTES_TABLE: notesTable.tableName,
      DOCUMENTS_TABLE: documentsTable.tableName,
      BOOKMARKS_TABLE: bookmarksTable.tableName,
      SYNAPSES_TABLE: synapsesTable.tableName,
      AI_RESPONSES_TABLE: aiResponsesTable.tableName,
    };

    // Index Task/Note/Document Lambda (triggered by DynamoDB Streams)
    const indexContentFn = new lambda.Function(this, 'IndexContentFunction', {
      functionName: 'cognify-index-content',
      runtime: lambda.Runtime.NODEJS_20_X,
      code: lambda.Code.fromAsset(path.join(__dirname, '../../functions-aws/index-content')),
      handler: 'index.handler',
      timeout: cdk.Duration.seconds(60),
      memorySize: 512,
      environment: lambdaEnvironment,
      layers: [sharedLayer],
    });

    // Grant DynamoDB read permissions
    tasksTable.grantStreamRead(indexContentFn);
    notesTable.grantStreamRead(indexContentFn);
    documentsTable.grantStreamRead(indexContentFn);

    // Connect DynamoDB streams to Lambda
    indexContentFn.addEventSource(
      new lambdaEventSources.DynamoEventSource(tasksTable, {
        startingPosition: lambda.StartingPosition.LATEST,
        batchSize: 10,
      })
    );
    indexContentFn.addEventSource(
      new lambdaEventSources.DynamoEventSource(notesTable, {
        startingPosition: lambda.StartingPosition.LATEST,
        batchSize: 10,
      })
    );
    indexContentFn.addEventSource(
      new lambdaEventSources.DynamoEventSource(documentsTable, {
        startingPosition: lambda.StartingPosition.LATEST,
        batchSize: 10,
      })
    );

    // Scrape and Index Bookmark Lambda
    const scrapeBookmarkFn = new lambda.Function(this, 'ScrapeBookmarkFunction', {
      functionName: 'cognify-scrape-bookmark',
      runtime: lambda.Runtime.NODEJS_20_X,
      code: lambda.Code.fromAsset(path.join(__dirname, '../../functions-aws/scrape-bookmark')),
      handler: 'index.handler',
      timeout: cdk.Duration.seconds(60),
      memorySize: 512,
      environment: lambdaEnvironment,
      layers: [sharedLayer],
    });

    bookmarksTable.grantStreamRead(scrapeBookmarkFn);
    scrapeBookmarkFn.addEventSource(
      new lambdaEventSources.DynamoEventSource(bookmarksTable, {
        startingPosition: lambda.StartingPosition.LATEST,
        batchSize: 10,
      })
    );

    // Query Pinecone Lambda (API)
    const queryPineconeFn = new lambda.Function(this, 'QueryPineconeFunction', {
      functionName: 'cognify-query-pinecone',
      runtime: lambda.Runtime.NODEJS_20_X,
      code: lambda.Code.fromAsset(path.join(__dirname, '../../functions-aws/query-pinecone')),
      handler: 'index.handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: lambdaEnvironment,
      layers: [sharedLayer],
    });

    // Analyze Content Lambda (API)
    const analyzeContentFn = new lambda.Function(this, 'AnalyzeContentFunction', {
      functionName: 'cognify-analyze-content',
      runtime: lambda.Runtime.NODEJS_20_X,
      code: lambda.Code.fromAsset(path.join(__dirname, '../../functions-aws/analyze-content')),
      handler: 'index.handler',
      timeout: cdk.Duration.seconds(60),
      memorySize: 512,
      environment: lambdaEnvironment,
      layers: [sharedLayer],
    });

    // Generate Suggestions Lambda (API)
    const generateSuggestionsFn = new lambda.Function(this, 'GenerateSuggestionsFunction', {
      functionName: 'cognify-generate-suggestions',
      runtime: lambda.Runtime.NODEJS_20_X,
      code: lambda.Code.fromAsset(path.join(__dirname, '../../functions-aws/generate-suggestions')),
      handler: 'index.handler',
      timeout: cdk.Duration.seconds(60),
      memorySize: 512,
      environment: lambdaEnvironment,
      layers: [sharedLayer],
    });

    // Grant DynamoDB read permissions
    [projectsTable, tasksTable, notesTable, documentsTable, bookmarksTable].forEach(table => {
      table.grantReadData(generateSuggestionsFn);
    });

    // Analyze Synapse Lambda (API)
    const analyzeSynapseFn = new lambda.Function(this, 'AnalyzeSynapseFunction', {
      functionName: 'cognify-analyze-synapse',
      runtime: lambda.Runtime.NODEJS_20_X,
      code: lambda.Code.fromAsset(path.join(__dirname, '../../functions-aws/analyze-synapse')),
      handler: 'index.handler',
      timeout: cdk.Duration.seconds(60),
      memorySize: 512,
      environment: lambdaEnvironment,
      layers: [sharedLayer],
    });

    // Convert Tasks to Document Lambda (API)
    const convertTasksFn = new lambda.Function(this, 'ConvertTasksFunction', {
      functionName: 'cognify-convert-tasks',
      runtime: lambda.Runtime.NODEJS_20_X,
      code: lambda.Code.fromAsset(path.join(__dirname, '../../functions-aws/convert-tasks')),
      handler: 'index.handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: lambdaEnvironment,
      layers: [sharedLayer],
    });

    tasksTable.grantReadData(convertTasksFn);
    documentsTable.grantWriteData(convertTasksFn);
    tasksTable.grantWriteData(convertTasksFn); // For archiving

    // Cleanup Pinecone Lambda (scheduled)
    const cleanupPineconeFn = new lambda.Function(this, 'CleanupPineconeFunction', {
      functionName: 'cognify-cleanup-pinecone',
      runtime: lambda.Runtime.NODEJS_20_X,
      code: lambda.Code.fromAsset(path.join(__dirname, '../../functions-aws/cleanup-pinecone')),
      handler: 'index.handler',
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      environment: lambdaEnvironment,
      layers: [sharedLayer],
    });

    // Grant read access to all tables for cleanup
    [tasksTable, notesTable, documentsTable, bookmarksTable].forEach(table => {
      table.grantReadData(cleanupPineconeFn);
    });

    // Schedule cleanup every 12 hours
    const cleanupRule = new events.Rule(this, 'CleanupScheduleRule', {
      schedule: events.Schedule.rate(cdk.Duration.hours(12)),
    });
    cleanupRule.addTarget(new targets.LambdaFunction(cleanupPineconeFn));

    // Retry Failed Indexing Lambda (scheduled)
    const retryIndexingFn = new lambda.Function(this, 'RetryIndexingFunction', {
      functionName: 'cognify-retry-indexing',
      runtime: lambda.Runtime.NODEJS_20_X,
      code: lambda.Code.fromAsset(path.join(__dirname, '../../functions-aws/retry-indexing')),
      handler: 'index.handler',
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      environment: lambdaEnvironment,
      layers: [sharedLayer],
    });

    [tasksTable, notesTable, documentsTable].forEach(table => {
      table.grantReadWriteData(retryIndexingFn);
    });

    // Schedule retry every 6 hours
    const retryRule = new events.Rule(this, 'RetryScheduleRule', {
      schedule: events.Schedule.rate(cdk.Duration.hours(6)),
    });
    retryRule.addTarget(new targets.LambdaFunction(retryIndexingFn));

    // ==================== API Gateway ====================
    const api = new apigateway.RestApi(this, 'CognifyAPI', {
      restApiName: 'Cognify API',
      description: 'API for Cognify Dashboard App',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    // Cognito authorizer
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'CognifyAuthorizer', {
      cognitoUserPools: [userPool],
    });

    // API routes
    const queryPineconeIntegration = new apigateway.LambdaIntegration(queryPineconeFn);
    const analyzeContentIntegration = new apigateway.LambdaIntegration(analyzeContentFn);
    const generateSuggestionsIntegration = new apigateway.LambdaIntegration(generateSuggestionsFn);
    const analyzeSynapseIntegration = new apigateway.LambdaIntegration(analyzeSynapseFn);
    const convertTasksIntegration = new apigateway.LambdaIntegration(convertTasksFn);

    api.root.addResource('query-pinecone').addMethod('POST', queryPineconeIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    api.root.addResource('analyze-content').addMethod('POST', analyzeContentIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    api.root.addResource('generate-suggestions').addMethod('POST', generateSuggestionsIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    api.root.addResource('analyze-synapse').addMethod('POST', analyzeSynapseIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    api.root.addResource('convert-tasks').addMethod('POST', convertTasksIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // ==================== S3 + CloudFront for Frontend ====================
    // S3 bucket for frontend hosting
    const websiteBucket = new s3.Bucket(this, 'WebsiteBucket', {
      bucketName: `cognify-frontend-${this.account}`,
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'index.html', // For SPA routing
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      autoDeleteObjects: false,
    });

    // CloudFront Origin Access Identity
    const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, 'OAI', {
      comment: 'OAI for Cognify website',
    });

    websiteBucket.grantRead(originAccessIdentity);

    // CloudFront distribution
    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(websiteBucket, {
          originAccessIdentity,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
      ],
    });

    // ==================== Outputs ====================
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
      description: 'Cognito User Pool ID',
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
    });

    new cdk.CfnOutput(this, 'IdentityPoolId', {
      value: identityPool.ref,
      description: 'Cognito Identity Pool ID',
    });

    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: api.url,
      description: 'API Gateway endpoint URL',
    });

    new cdk.CfnOutput(this, 'DistributionDomain', {
      value: distribution.distributionDomainName,
      description: 'CloudFront distribution domain name',
    });

    new cdk.CfnOutput(this, 'WebsiteBucketName', {
      value: websiteBucket.bucketName,
      description: 'S3 bucket name for website hosting',
    });
  }
}

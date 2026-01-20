// Lambda function to analyze synapse content using OpenAI
// Exposed via API Gateway

const { OpenAI } = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

exports.handler = async (event) => {
  console.log('Analyze synapse event:', JSON.stringify(event, null, 2));

  try {
    // Get userId from Cognito authorizer
    const userId = event.requestContext.authorizer.claims.sub;

    // Parse request body
    const body = JSON.parse(event.body);
    const {
      synapseContent,
      synapseName,
      analysisType = 'comprehensive',
      analysisMode = 'core',
      educationMode = false,
      projectType = 'general',
    } = body;

    if (!synapseContent || !synapseName) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'synapseContent and synapseName are required' }),
      };
    }

    // Organize content by type and truncate large content
    const MAX_CONTENT_LENGTH = 3000;

    const organizedContent = synapseContent.reduce((acc, item) => {
      if (!acc[item.type]) {
        acc[item.type] = [];
      }

      const truncatedItem = { ...item };
      if (truncatedItem.content && truncatedItem.content.length > MAX_CONTENT_LENGTH) {
        truncatedItem.content =
          truncatedItem.content.substring(0, MAX_CONTENT_LENGTH) +
          '\n\n[Content truncated due to length...]';
        truncatedItem.wasTruncated = true;
      }

      acc[item.type].push(truncatedItem);
      return acc;
    }, {});

    // Create context string
    const contextString = Object.entries(organizedContent)
      .map(
        ([type, items]) => `
${type.toUpperCase()}:
${items
  .map((item, index) => {
    const title = item.title || (item.content ? item.content.substring(0, 50) + '...' : 'Untitled');
    let fullContent = item.content || '';
    const url = item.url ? `\nURL: ${item.url}` : '';

    let itemDescription = '';
    if (type === 'bookmark') {
      let domain = '';
      try {
        domain = new URL(item.url).hostname;
      } catch (e) {
        domain = item.url;
      }

      itemDescription = `
SOURCE TYPE: Web resource / Article from ${domain}
TITLE: ${title}
${url}
`;

      if (!fullContent || fullContent === item.url) {
        itemDescription += `
NOTE: This is a bookmark to a web resource. The content hasn't been fully extracted,
but the title and URL suggest this is about "${title}".
`;
      }
    } else {
      itemDescription = `
SOURCE TYPE: ${type.charAt(0).toUpperCase() + type.slice(1)}
TITLE: ${title}
${url}
`;
    }

    return `SOURCE ${index + 1}: ${title}
${itemDescription}
FULL CONTENT:
${fullContent}
---
`;
  })
  .join('\n')}
`
      )
      .join('\n');

    // Helper functions for context-aware terminology
    const getTaskTerm = () => {
      if (!educationMode) return 'tasks';
      switch (projectType) {
        case 'course':
          return 'assignments';
        case 'research':
          return 'milestones';
        case 'thesis':
          return 'objectives';
        default:
          return 'tasks';
      }
    };

    const getSpaceContext = () => {
      if (!educationMode) return 'project';
      switch (projectType) {
        case 'course':
          return 'course';
        case 'research':
          return 'research project';
        case 'thesis':
          return 'thesis';
        case 'study-group':
          return 'study group';
        default:
          return 'academic project';
      }
    };

    const taskTerm = getTaskTerm();
    const spaceContext = getSpaceContext();

    // Configure analysis based on type and mode
    let specificFocus = '';
    let systemPrompt = educationMode
      ? `You are an AI assistant specializing in academic analysis and learning. You help students and educators find meaningful patterns and connections between different types of ${spaceContext} materials.`
      : 'You are an AI assistant specializing in finding meaningful patterns and connections between different types of project items.';
    let maxTokens = 2500;

    // Set focus based on analysis type (simplified version - full version in Firebase Functions)
    switch (analysisType) {
      case 'relationships':
        specificFocus = `Focus on detailed relationship mapping between all materials with concrete examples.`;
        break;
      case 'summary':
        specificFocus = `Provide a high-level summary of key themes with 3-5 important insights.`;
        systemPrompt = educationMode
          ? `You are an academic summarizer providing concise yet substantive summaries.`
          : 'You are an executive assistant providing concise yet substantive summaries.';
        break;
      case 'actionItems':
        specificFocus = `Extract and organize all ${taskTerm} with priorities and dependencies.`;
        systemPrompt = educationMode
          ? `You are an academic planning assistant specializing in ${taskTerm} extraction.`
          : 'You are a project management assistant specializing in action item extraction.';
        break;
      case 'timeline':
        specificFocus = `Analyze temporal relationships and create a detailed timeline.`;
        systemPrompt = educationMode
          ? `You are an academic timeline specialist.`
          : 'You are a timeline analysis specialist.';
        break;
      case 'learningPlan':
        specificFocus = `Create a comprehensive learning plan with core concepts, learning path, practical applications, resources, and assessments.`;
        systemPrompt = educationMode
          ? `You are an expert educational content designer.`
          : 'You are an expert educational content designer.';
        maxTokens = 4000;
        break;
      case 'comprehensive':
      default:
        specificFocus = `Provide deep, thorough analysis focusing on key themes, relationships, insights, and next ${taskTerm}.`;
        maxTokens = 3000;
        break;
    }

    // Configure temperature and model based on analysis mode
    let temperature = 0.7;
    let model = 'gpt-3.5-turbo';
    let includesBroaderAnalysis = false;

    if (analysisType === 'learningPlan') {
      model = 'gpt-4';
      temperature = 0.6;
    }

    switch (analysisMode) {
      case 'expanded':
        temperature = 0.7;
        model = 'gpt-4';
        includesBroaderAnalysis = true;
        break;
      case 'creative':
        temperature = 0.9;
        model = 'gpt-4';
        includesBroaderAnalysis = true;
        break;
      case 'core':
      default:
        if (analysisType === 'comprehensive') {
          model = 'gpt-4';
        }
        break;
    }

    const synapseAnalysisPrompt = `
You are analyzing a "synapse" named "${synapseName}" containing:

${contextString}

${specificFocus}

Be specific and substantive with direct references to source material.
`;

    let result;

    if (!includesBroaderAnalysis) {
      const analysis = await openai.chat.completions.create({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: synapseAnalysisPrompt },
        ],
        temperature: temperature,
        max_tokens: maxTokens,
      });

      result = `## Analysis of Your Synapse: ${synapseName}\n\n${analysis.choices[0].message.content.trim()}`;
    } else {
      // For expanded/creative modes, include broader analysis
      const broaderAnalysisPrompt = `
You're analyzing synapse "${synapseName}" with content types: ${Object.keys(organizedContent).join(', ')}.

Provide:
1. Broader concepts/theories relevant to these materials
2. Frameworks or methodologies that apply
3. High-quality additional resources
4. Potential applications

Be substantive and reference source content.
`;

      const [synapseAnalysis, broaderAnalysis] = await Promise.all([
        openai.chat.completions.create({
          model: model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: synapseAnalysisPrompt },
          ],
          temperature: temperature,
          max_tokens: maxTokens,
        }),
        openai.chat.completions.create({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'You provide in-depth, practical context and substantive connections.',
            },
            { role: 'user', content: broaderAnalysisPrompt },
          ],
          temperature: temperature,
          max_tokens: Math.min(2000, maxTokens),
        }),
      ]);

      result = `## Analysis of Your Synapse: ${synapseName}\n\n${synapseAnalysis.choices[0].message.content.trim()}\n\n## Broader Context & Practical Applications\n\n${broaderAnalysis.choices[0].message.content.trim()}`;
    }

    // Add creative section if in creative mode
    if (analysisMode === 'creative') {
      let sectionTitle = 'Creative Extensions';
      if (analysisType === 'comprehensive' || analysisType === 'relationships') {
        sectionTitle = 'Creative Applications & Future Directions';
      } else if (analysisType === 'actionItems') {
        sectionTitle = 'Innovation Opportunities';
      } else if (analysisType === 'learningPlan') {
        sectionTitle = 'Innovative Learning Approaches';
      }

      const creativePrompt = `Based on synapse "${synapseName}", provide creative, substantive innovations. Include detailed implementation strategies and concrete examples.`;

      try {
        const creativeResponse = await openai.chat.completions.create({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'You are a creative innovation consultant providing substantive, detailed suggestions.',
            },
            { role: 'user', content: creativePrompt },
          ],
          temperature: 0.9,
          max_tokens: 2000,
        });

        result += `\n\n## ${sectionTitle}\n\n${creativeResponse.choices[0].message.content.trim()}`;
      } catch (error) {
        console.error('Error generating creative section:', error);
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ content: result }),
    };
  } catch (error) {
    console.error('Error analyzing synapse content:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Error analyzing synapse content', details: error.message }),
    };
  }
};

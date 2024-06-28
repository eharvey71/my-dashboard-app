import axios from 'axios';

const EMBEDDING_API_KEY = 'sk-proj-xUOfPMkwm8qK7jbCsjtqT3BlbkFJaq5de3ZH8aHqo8DxyyNz'; // Replace with your actual API key
const ANALYSIS_API_KEY = 'sk-proj-xUOfPMkwm8qK7jbCsjtqT3BlbkFJaq5de3ZH8aHqo8DxyyNz'; // Same as EMBEDDING_API_KEY if you're using the same key

export const generateEmbedding = async (content) => {
  try {
    const response = await axios.post('https://api.openai.com/v1/embeddings', {
      input: content,
      model: 'text-embedding-ada-002',
    }, {
      headers: {
        'Authorization': `Bearer ${EMBEDDING_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    return response.data.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
};

export const analyzeContent = async (prompt) => {
  try {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: prompt },
      ],
      model: 'gpt-3.5-turbo', // Use the chat completion model
      max_tokens: 2000,
      temperature: 0.7,
    }, {
      headers: {
        'Authorization': `Bearer ${ANALYSIS_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });
    return response.data.choices[0].message.content.trim();
  } catch (error) {
    // Log detailed error information
    if (error.response) {
      console.error('Error response data:', error.response.data);
      console.error('Error response status:', error.response.status);
      console.error('Error response headers:', error.response.headers);
    } else if (error.request) {
      console.error('Error request:', error.request);
    } else {
      console.error('Error message:', error.message);
    }
    throw error;
  }
};

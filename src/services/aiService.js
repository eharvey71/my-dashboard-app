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

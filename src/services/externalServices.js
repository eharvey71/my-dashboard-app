import axios from 'axios';

const LINKPREVIEW_API_KEY = 'aedc1f8b83d606e8fe30c8c9a8669598';

export const fetchLinkMetadata = async (url) => {
  try {
    const response = await axios.post(
      'https://api.linkpreview.net',
      { q: url },
      {
        headers: {
          'X-Linkpreview-Api-Key': LINKPREVIEW_API_KEY,
        },
      }
    );
    return {
      title: response.data.title || url,
      image: response.data.image || '/api/placeholder/400/300',
      description: response.data.description || '',
    };
  } catch (error) {
    console.error('Error fetching link metadata:', error);
    return {
      title: url,
      image: '/api/placeholder/400/300',
      description: '',
    };
  }
};
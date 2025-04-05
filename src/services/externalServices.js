import axios from 'axios';

const LINKPREVIEW_API_KEY = 'aedc1f8b83d606e8fe30c8c9a8669598';
const LOCAL_PLACEHOLDER_IMAGE = '/images/cognify-logo.png';

// Extract domain from URL for favicon fallback
const getFaviconUrl = (url) => {
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
  } catch (error) {
    return null;
  }
};

export const fetchLinkMetadata = async (url) => {
  let title = url;
  let image = null;
  let description = '';
  
  try {
    // First attempt: use LinkPreview API
    const response = await axios.post(
      'https://api.linkpreview.net',
      { q: url },
      {
        headers: {
          'X-Linkpreview-Api-Key': LINKPREVIEW_API_KEY,
        },
      }
    );
    
    title = response.data.title || url;
    description = response.data.description || '';
    
    // Use image from API if available
    if (response.data.image) {
      image = response.data.image;
    }
  } catch (error) {
    console.error('Error fetching link metadata:', error);
  }
  
  // If no image from API, try favicon
  if (!image) {
    const faviconUrl = getFaviconUrl(url);
    if (faviconUrl) {
      image = faviconUrl;
    }
  }
  
  // If all else fails, use local placeholder
  if (!image) {
    image = LOCAL_PLACEHOLDER_IMAGE;
  }
  
  return {
    title,
    image,
    description,
  };
};
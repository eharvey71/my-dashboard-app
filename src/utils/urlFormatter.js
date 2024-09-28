const formatUrl = (url, currentDomain) => {

  // Remove current domain if it's prepended
  const cleanUrl = url.replace(new RegExp(`^https?://${currentDomain}/?`, 'i'), '');

  // Add https:// if no protocol is specified
  if (!/^https?:\/\//i.test(cleanUrl)) {
    return `https://${cleanUrl}`;
  }

  return cleanUrl;

};

export default formatUrl;
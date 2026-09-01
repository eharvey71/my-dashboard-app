// Bookmark link metadata.
//
// The LinkPreview key used to live in this file and shipped in the bundle.
// The lookup now runs in a Cloud Function; this module only handles the
// fallback chain (preview image -> favicon -> local placeholder).
import { httpsCallable } from "firebase/functions";
import { functions } from "./firebaseApp";

const LOCAL_PLACEHOLDER_IMAGE = "/images/cognify-logo.png";

const fetchLinkMetadataFn = httpsCallable(functions, "fetchLinkMetadata");

// Extract domain from URL for favicon fallback
const getFaviconUrl = (url) => {
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
  } catch {
    return null;
  }
};

export const fetchLinkMetadata = async (url) => {
  let title = url;
  let image = null;
  let description = "";

  try {
    const { data } = await fetchLinkMetadataFn({ url });
    title = data.title || url;
    description = data.description || "";
    image = data.image || null;
  } catch (error) {
    console.error("Error fetching link metadata:", error);
  }

  if (!image) {
    image = getFaviconUrl(url);
  }

  if (!image) {
    image = LOCAL_PLACEHOLDER_IMAGE;
  }

  return { title, image, description };
};

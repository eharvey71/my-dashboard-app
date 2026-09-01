import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebaseApp";

// The OAuth client ID is a public identifier and is safe in the bundle.
// It previously sat next to a GOCSPX- OAuth *client secret* that was passed to
// gapi.client.init as `apiKey`. That was both a leak and a category error: gapi
// wants a browser API key there, never a client secret. Authorized Drive calls
// are covered by the OAuth token from initTokenClient, so the API key is
// optional - set VITE_GOOGLE_API_KEY only if you have a referrer-restricted
// browser key.
const CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  '890654183832-nf837a379aq9nu8h0h4ugd6lqhi66m4e.apps.googleusercontent.com';
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || null;
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/drive.readonly';
const TOKEN_STORAGE_KEY = 'googleDriveToken';

let tokenClient;
let accessToken = null;
let initPromise = null;

const loadScript = (src) =>
  new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.body.appendChild(script);
  });

const loadGapiClient = () =>
  new Promise((resolve, reject) => {
    gapi.load('client', async () => {
      try {
        await gapi.client.init({
          ...(API_KEY ? { apiKey: API_KEY } : {}),
          discoveryDocs: [DISCOVERY_DOC],
        });
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  });

/**
 * Load the Google Drive APIs, at most once per page.
 *
 * This used to run at app startup with App.jsx refusing to render until it
 * resolved, so every user waited on Google's servers before seeing anything -
 * including users who never open a Drive file. It is now called on demand by
 * the functions below, and the two script loads run concurrently instead of
 * the second waiting on the first plus the discovery-document fetch.
 */
export const ensureGoogleDriveApi = () => {
  if (!initPromise) {
    initPromise = (async () => {
      // Independent downloads - no reason to serialise them.
      await Promise.all([
        loadScript('https://apis.google.com/js/api.js'),
        loadScript('https://accounts.google.com/gsi/client'),
      ]);

      await loadGapiClient();

      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: '', // defined per sign-in below
      });

      const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (storedToken) {
        accessToken = JSON.parse(storedToken);
        gapi.client.setToken({ access_token: accessToken });
      }
    })().catch((error) => {
      // Let the next caller retry rather than caching the failure forever.
      initPromise = null;
      throw error;
    });
  }

  return initPromise;
};

// Drop the Drive token when the Firebase user signs out. Registered at module
// load because it costs nothing and must not depend on whether the Drive API
// was ever initialised.
onAuthStateChanged(auth, (user) => {
  if (user) return;

  localStorage.removeItem(TOKEN_STORAGE_KEY);
  accessToken = null;
  if (typeof gapi !== 'undefined' && gapi.client) {
    gapi.client.setToken(null);
  }
});

export const signIn = async () => {
  await ensureGoogleDriveApi();

  return new Promise((resolve, reject) => {
    tokenClient.callback = async (resp) => {
      if (resp.error !== undefined) {
        reject(resp);
        return;
      }
      accessToken = resp.access_token;
      localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(accessToken));
      resolve(accessToken);
    };
    if (gapi.client.getToken() === null) {
      tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
      tokenClient.requestAccessToken({ prompt: '' });
    }
  });
};

export const signOut = () => {
  // Always clear local state, even if the Drive API was never loaded.
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  accessToken = null;

  if (typeof gapi === 'undefined' || !gapi.client) return;

  const token = gapi.client.getToken();
  if (token !== null) {
    google.accounts.oauth2.revoke(token.access_token);
    gapi.client.setToken('');
  }
};

// Synchronous, and callable before the Drive API has loaded - it only needs to
// know whether we hold a token, which survives in localStorage.
export const isSignedIn = () => {
  if (accessToken) return true;
  return localStorage.getItem(TOKEN_STORAGE_KEY) !== null;
};

export const getAccessToken = () => {
  return accessToken;
};

export const ensureValidToken = async () => {
  await ensureGoogleDriveApi();

  if (!accessToken) {
    const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (storedToken) {
      accessToken = JSON.parse(storedToken);
      gapi.client.setToken({ access_token: accessToken });
    } else {
      throw new Error('Not signed in to Google Drive');
    }
  }

  try {
    // Make a test API call
    await gapi.client.drive.files.list({ pageSize: 1 });
  } catch (error) {
    if (error.status === 401) {
      // Token is invalid or expired, try to refresh
      try {
        await signIn();
      } catch (refreshError) {
        // Unable to refresh, user needs to sign in again
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        accessToken = null;
        gapi.client.setToken(null);
        throw new Error('Google Drive session expired. Please sign in again.');
      }
    } else {
      throw error;
    }
  }
};

export const listFiles = async (folderId = 'root') => {
  await ensureValidToken();
  let response;
  try {
    response = await gapi.client.drive.files.list({
      'pageSize': 100,
      'fields': 'files(id, name, mimeType)',
      'q': `'${folderId}' in parents and trashed = false`,
    });
  } catch (err) {
    console.error('Error listing files:', err);
    return [];
  }
  const files = response.result.files;
  if (!files || files.length == 0) {
    console.log('No files found.');
    return [];
  }
  return files;
};

export const getFileContent = async (fileId, mimeType) => {
  await ensureValidToken();
  try {
    let response;
    if (mimeType === 'application/vnd.google-apps.document') {
      response = await gapi.client.drive.files.export({
        fileId: fileId,
        mimeType: 'text/plain',
      });
    } else if (mimeType === 'application/vnd.google-apps.spreadsheet') {
      response = await gapi.client.drive.files.export({
        fileId: fileId,
        mimeType: 'text/csv',
      });
    } else if (mimeType === 'application/vnd.google-apps.presentation') {
      response = await gapi.client.drive.files.export({
        fileId: fileId,
        mimeType: 'text/plain',
      });
    } else {
      throw new Error('Unsupported file type');
    }
    return response.body;
  } catch (err) {
    console.error('Error getting file content:', err);
    throw err;
  }
};

export const openGoogleDriveDocument = (fileId) => {
  window.open(`https://drive.google.com/file/d/${fileId}/view`, '_blank');
};
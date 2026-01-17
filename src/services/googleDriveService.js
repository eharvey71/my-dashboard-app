import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged } from "firebase/auth";

const CLIENT_ID = '890654183832-nf837a379aq9nu8h0h4ugd6lqhi66m4e.apps.googleusercontent.com';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/drive.readonly';

let tokenClient;
let gapiInited = false;
let gisInited = false;
let accessToken = null;
let initPromise = null; // Track initialization promise

export const initializeGoogleDriveApi = () => {
  // Return existing promise if initialization is already in progress
  if (initPromise) {
    return initPromise;
  }

  initPromise = new Promise((resolve, reject) => {
    const script1 = document.createElement('script');
    script1.src = 'https://apis.google.com/js/api.js';
    script1.onload = () => {
      gapiLoaded()
        .then(() => {
          const script2 = document.createElement('script');
          script2.src = 'https://accounts.google.com/gsi/client';
          script2.onload = () => {
            gisLoaded()
              .then(() => {
                // Check for existing token in storage
                const storedToken = localStorage.getItem('googleDriveToken');
                if (storedToken) {
                  accessToken = JSON.parse(storedToken);
                  gapi.client.setToken({ access_token: accessToken });
                }
                resolve();
              })
              .catch(reject);
          };
          document.body.appendChild(script2);
        })
        .catch(reject);
    };
    document.body.appendChild(script1);

    // Set up Firebase Auth listener
    const auth = getAuth();
    onAuthStateChanged(auth, (user) => {
      if (!user) {
        // User logged out, clear the token
        localStorage.removeItem('googleDriveToken');
        accessToken = null;
        gapi.client.setToken(null);
      }
    });
  });

  return initPromise;
};

function gapiLoaded() {
  return new Promise((resolve, reject) => {
    gapi.load('client', async () => {
      try {
        await gapi.client.init({
          discoveryDocs: [DISCOVERY_DOC],
        });
        gapiInited = true;
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  });
}

function gisLoaded() {
  return new Promise((resolve) => {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: '', // defined later
    });
    gisInited = true;
    resolve();
  });
}

export const signIn = async () => {
  // Wait for initialization if not ready yet
  if (!gapiInited || !gisInited) {
    if (initPromise) {
      try {
        await initPromise;
      } catch (error) {
        throw new Error('Google API initialization failed: ' + error.message);
      }
    } else {
      throw new Error('Google API not initialized. Please refresh the page.');
    }
  }

  return new Promise((resolve, reject) => {
    tokenClient.callback = async (resp) => {
      if (resp.error !== undefined) {
        reject(resp);
        return;
      }
      accessToken = resp.access_token;
      localStorage.setItem('googleDriveToken', JSON.stringify(accessToken));
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
  const token = gapi.client.getToken();
  if (token !== null) {
    google.accounts.oauth2.revoke(token.access_token);
    gapi.client.setToken('');
    localStorage.removeItem('googleDriveToken');
    accessToken = null;
  }
};

export const isSignedIn = () => {
  return accessToken !== null;
};

export const getAccessToken = () => {
  return accessToken;
};

export const ensureValidToken = async () => {
  if (!accessToken) {
    const storedToken = localStorage.getItem('googleDriveToken');
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
        localStorage.removeItem('googleDriveToken');
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

    // Google Workspace files need to be exported
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
    }
    // Regular files (txt, pdf, docx, etc.) can be downloaded directly
    else if (
      mimeType === 'text/plain' ||
      mimeType === 'text/markdown' ||
      mimeType === 'application/pdf' ||
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimeType === 'application/msword' ||
      mimeType.startsWith('text/')
    ) {
      response = await gapi.client.drive.files.get({
        fileId: fileId,
        alt: 'media',
      });
    } else {
      throw new Error(`Unsupported file type: ${mimeType}`);
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
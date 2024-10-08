// googleDriveService.js

const CLIENT_ID = '890654183832-nf837a379aq9nu8h0h4ugd6lqhi66m4e.apps.googleusercontent.com';
const API_KEY = 'GOCSPX-4oswFz1IjIcZuNDil-4NdEKRnGG';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/drive.readonly';

let tokenClient;
let gapiInited = false;
let gisInited = false;

export const initializeGoogleDriveApi = () => {
  const gapiScript = document.createElement('script');
  gapiScript.src = 'https://apis.google.com/js/api.js';
  
  const gisScript = document.createElement('script');
  gisScript.src = 'https://accounts.google.com/gsi/client';

  return new Promise((resolve, reject) => {
    gapiScript.onload = () => {
      gapi.load('client', async () => {
        try {
          await gapi.client.init({
            apiKey: API_KEY,
            discoveryDocs: [DISCOVERY_DOC],
          });
          gapiInited = true;
          maybeResolve();
        } catch (err) {
          reject(err);
        }
      });
    };

    gisScript.onload = () => {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: '', // defined later
      });
      gisInited = true;
      maybeResolve();
    };

    function maybeResolve() {
      if (gapiInited && gisInited) {
        resolve();
      }
    }

    document.head.appendChild(gapiScript);
    document.head.appendChild(gisScript);
  });
};

export const signIn = () => {
  return new Promise((resolve, reject) => {
    tokenClient.callback = async (resp) => {
      if (resp.error !== undefined) {
        reject(resp);
      }
      await listFiles();
      resolve();
    };
    if (gapi.client.getToken() === null) {
      tokenClient.requestAccessToken({prompt: 'consent'});
    } else {
      tokenClient.requestAccessToken({prompt: ''});
    }
  });
};

export const signOut = () => {
  const token = gapi.client.getToken();
  if (token !== null) {
    google.accounts.oauth2.revoke(token.access_token);
    gapi.client.setToken('');
  }
};

export const isSignedIn = () => {
  return gapi.client.getToken() !== null;
};

export const listFiles = async () => {
  let response;
  try {
    response = await gapi.client.drive.files.list({
      'pageSize': 30,
      'fields': 'files(id, name, mimeType)',
      'q': "mimeType='application/vnd.google-apps.document' or mimeType='application/vnd.google-apps.spreadsheet' or mimeType='application/vnd.google-apps.presentation'"
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
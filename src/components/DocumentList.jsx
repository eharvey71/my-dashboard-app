import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getDocuments, deleteDocument, addDocumentFromGoogleDrive } from '../services/firebaseConfig';
import { indexContent, deleteVector } from '../services/pineconeService';
import { Trash2, Edit2, PlusCircle, FileText } from 'lucide-react';
import { initializeGoogleDriveApi, signIn, signOut, isSignedIn, listFiles, getFileContent } from '../services/googleDriveService';
import styles from './DocumentList.module.css';

const DocumentList = ({ user }) => {
  const { projectId } = useParams();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [googleDriveSignedIn, setGoogleDriveSignedIn] = useState(false);
  const [googleDriveFiles, setGoogleDriveFiles] = useState([]);
  const [showGoogleDriveFiles, setShowGoogleDriveFiles] = useState(false);

  useEffect(() => {
    fetchDocuments();
    initializeGoogleDrive();
  }, [user, projectId]);

  const initializeGoogleDrive = async () => {
    try {
      await initializeGoogleDriveApi();
      const signedIn = isSignedIn();
      setGoogleDriveSignedIn(signedIn);
      if (signedIn) {
        await fetchGoogleDriveFiles();
      }
    } catch (error) {
      console.error('Error initializing Google Drive:', error);
    }
  };

  const fetchDocuments = async () => {
    try {
      const docs = await getDocuments(user.uid, projectId);
      const sortedDocs = docs.sort((a, b) => b.updatedAt.seconds - a.updatedAt.seconds);
      setDocuments(sortedDocs);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching documents:', error);
      setLoading(false);
    }
  };

  const fetchGoogleDriveFiles = async () => {
    try {
      const files = await listFiles();
      setGoogleDriveFiles(files);
    } catch (error) {
      console.error('Error fetching Google Drive files:', error);
      setGoogleDriveFiles([]);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this document?')) {
      try {
        await deleteDocument(id);
        await deleteVector(user.uid, id, 'document');
        setDocuments(documents.filter(doc => doc.id !== id));
      } catch (error) {
        console.error('Error deleting document:', error);
      }
    }
  };

  const handleGoogleDriveSignIn = async () => {
    try {
      await signIn();
      setGoogleDriveSignedIn(true);
      await fetchGoogleDriveFiles();
      setShowGoogleDriveFiles(true);
    } catch (error) {
      console.error('Error signing in to Google Drive:', error);
    }
  };

  const handleGoogleDriveSignOut = async () => {
    try {
      signOut();
      setGoogleDriveSignedIn(false);
      setGoogleDriveFiles([]);
      setShowGoogleDriveFiles(false);
    } catch (error) {
      console.error('Error signing out from Google Drive:', error);
    }
  };

  const handleAddFromGoogleDrive = async (file) => {
    try {
      const content = await getFileContent(file.id, file.mimeType);
      const newDoc = await addDocumentFromGoogleDrive(user.uid, projectId, {
        name: file.name,
        id: file.id,
        mimeType: file.mimeType,
        content: content
      });
      
      // Ensure that newDoc has all required properties before adding it to the state
      if (newDoc && newDoc.id && newDoc.updatedAt) {
        setDocuments(prevDocuments => [newDoc, ...prevDocuments]);
        await indexContent(user.uid, content, 'document', newDoc.id, `Google Drive Document: ${file.name}`, 'Google Drive');
        alert(`Document "${file.name}" has been added to your project and indexed for AI processing.`);
      } else {
        throw new Error('Invalid document structure returned from addDocumentFromGoogleDrive');
      }
    } catch (error) {
      console.error('Error adding document from Google Drive:', error);
      alert('Failed to add document from Google Drive. Please try again.');
    }
  };

  if (loading) {
    return <div className={styles.loading}>Loading documents...</div>;
  }

  return (
    <div className={styles.documentList}>
      <h2 className={styles.title}>My Documents</h2>
      <Link to={`/project/${projectId}/documents/new`} className={styles.newDocButton}>
        <PlusCircle size={20} />
        New Document
      </Link>
      
      <div className={styles.googleDriveSection}>
        {googleDriveSignedIn ? (
          <>
            <button onClick={handleGoogleDriveSignOut} className={styles.googleDriveButton}>
              Sign Out from Google Drive
            </button>
            <button onClick={() => setShowGoogleDriveFiles(!showGoogleDriveFiles)} className={styles.toggleGoogleDriveButton}>
              {showGoogleDriveFiles ? 'Hide Google Drive Files' : 'Show Google Drive Files'}
            </button>
            {showGoogleDriveFiles && (
              <>
                <h3>Google Drive Documents</h3>
                <div className={styles.documentGrid}>
                  {googleDriveFiles.length > 0 ? (
                    googleDriveFiles.map(file => (
                      <div key={file.id} className={styles.documentCard}>
                        <h3 className={styles.documentTitle}>{file.name}</h3>
                        <button onClick={() => handleAddFromGoogleDrive(file)} className={styles.addButton}>
                          <FileText size={18} />
                          Add to Project
                        </button>
                      </div>
                    ))
                  ) : (
                    <p>No Google Drive files found.</p>
                  )}
                </div>
              </>
            )}
          </>
        ) : (
          <button onClick={handleGoogleDriveSignIn} className={styles.googleDriveButton}>
            Sign In to Google Drive
          </button>
        )}
      </div>

      <h3>Project Documents</h3>
      <div className={styles.documentGrid}>
        {documents.map(doc => (
          <div key={doc.id} className={styles.documentCard}>
            <h3 className={styles.documentTitle}>{doc.title || 'Untitled Document'}</h3>
            <p className={styles.documentDate}>
              Last updated: {new Date(doc.updatedAt.seconds * 1000).toLocaleDateString()}
            </p>
            <p className={styles.documentSource}>
              Source: {doc.source || 'Native'}
            </p>
            <div className={styles.documentActions}>
              {doc.source !== 'Google Drive' && (
                <Link to={`/project/${projectId}/documents/${doc.id}`} className={styles.editButton}>
                  <Edit2 size={18} />
                  Edit
                </Link>
              )}
              <button onClick={() => handleDelete(doc.id)} className={styles.deleteButton}>
                <Trash2 size={18} />
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DocumentList;
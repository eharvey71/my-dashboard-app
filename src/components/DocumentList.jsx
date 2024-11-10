import React, { useState, useEffect, useContext } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getDocuments, deleteDocument, addDocumentFromGoogleDrive } from '../services/firebaseConfig';
import { indexContent, deleteVector } from '../services/pineconeService';
import { Trash2, Edit2, PlusCircle, FileText, ExternalLink } from 'lucide-react';
import { signIn, signOut, isSignedIn, openGoogleDriveDocument, ensureValidToken } from '../services/googleDriveService';
import styles from './DocumentList.module.css';
import GoogleDrivePicker from './GoogleDrivePicker';
import { AppContext } from '../App'; // We'll create this context in App.js

const DocumentList = ({ user }) => {
  const { projectId } = useParams();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isGoogleDrivePickerOpen, setIsGoogleDrivePickerOpen] = useState(false);
  const { googleDriveSignedIn, setGoogleDriveSignedIn } = useContext(AppContext);

  useEffect(() => {
    fetchDocuments();
    if (localStorage.getItem('googleDriveToken')) {
      checkGoogleDriveSignIn();
    } else {
      setGoogleDriveSignedIn(false);
    } 
  }, [user, projectId]);

  const checkGoogleDriveSignIn = async () => {
    try {
      if (!isSignedIn()) {
        setGoogleDriveSignedIn(false);
        return;
      }
      await ensureValidToken();
      setGoogleDriveSignedIn(true);
    } catch (error) {
      console.error('Not connected to Google Drive:', error);
      setGoogleDriveSignedIn(false);
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
    } catch (error) {
      console.error('Error signing in to Google Drive:', error);
      setGoogleDriveSignedIn(false);
    }
  };

  const handleGoogleDriveSignOut = async () => {
    try {
      signOut();
      setGoogleDriveSignedIn(false);
    } catch (error) {
      console.error('Error signing out from Google Drive:', error);
    }
  };

  const handleAddFromGoogleDrive = async (file) => {
    try {
      await ensureValidToken();
      const newDoc = await addDocumentFromGoogleDrive(user.uid, projectId, file);
      
      if (newDoc && newDoc.id && newDoc.updatedAt) {
        setDocuments(prevDocuments => [newDoc, ...prevDocuments]);
        await indexContent(user.uid, projectId, file.content, 'document', newDoc.id, `Google Drive Document: ${file.name}`, 'Google Drive');
        //alert(`Document "${file.name}" has been added to your project and indexed for AI processing.`);
      } else {
        throw new Error('Invalid document structure returned from addDocumentFromGoogleDrive');
      }
    } catch (error) {
      console.error('Error adding document from Google Drive:', error);
      alert('Failed to add document from Google Drive. Please try again.');
      if (error.message === 'Google Drive session expired. Please sign in again.') {
        setGoogleDriveSignedIn(false);
      }
    }
  };

  const handleOpenDocument = (doc) => {
    if (doc.source === 'Google Drive' && doc.originalId) {
      openGoogleDriveDocument(doc.originalId);
    } else {
      // For native documents, use the existing route
      window.location.href = `/project/${projectId}/documents/${doc.id}`;
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
            <button onClick={() => setIsGoogleDrivePickerOpen(true)} className={styles.googleDriveButton}>
              <FileText size={18} />
              Import from Google Drive
            </button>
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
              <button onClick={() => handleOpenDocument(doc)} className={styles.openButton}>
                {doc.source === 'Google Drive' ? <ExternalLink size={18} /> : <Edit2 size={18} />}
                {doc.source === 'Google Drive' ? 'Open in Drive' : 'Edit'}
              </button>
              <button onClick={() => handleDelete(doc.id)} className={styles.deleteButton}>
                <Trash2 size={18} />
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      <GoogleDrivePicker
        isOpen={isGoogleDrivePickerOpen}
        onClose={() => setIsGoogleDrivePickerOpen(false)}
        onSelect={handleAddFromGoogleDrive}
      />
    </div>
  );
};

export default DocumentList;
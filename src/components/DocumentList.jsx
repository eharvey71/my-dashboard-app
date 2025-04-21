import React, { useState, useEffect, useContext } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getDocuments, deleteDocument, addDocumentFromGoogleDrive } from '../services/firebaseConfig';
import { indexContent, deleteVector } from '../services/pineconeService';
import { Trash2, Edit, PlusCircle, File, ExternalLink, LogIn, LogOut, Eye, Check, X } from 'lucide-react';
import { signIn, signOut, isSignedIn, openGoogleDriveDocument, ensureValidToken } from '../services/googleDriveService';
import moduleStyles from './DashboardModule.module.css';
import styles from './DocumentList.module.css';
import GoogleDrivePicker from './GoogleDrivePicker';
import { AppContext } from '../App';

const DocumentCard = ({ document, onDelete, onOpen, onView }) => {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  
  const handleDeleteClick = (e) => {
    e.stopPropagation(); // Prevent card click
    setIsConfirmingDelete(true);
  };
  
  const handleConfirmDelete = (e) => {
    e.stopPropagation(); // Prevent card click
    onDelete(document.id);
    setIsConfirmingDelete(false);
  };
  
  const handleCancelDelete = (e) => {
    e.stopPropagation(); // Prevent card click
    setIsConfirmingDelete(false);
  };
  
  const handleEditClick = (e) => {
    e.stopPropagation(); // Prevent card click
    onOpen(document);
  };
  
  const handleViewClick = (e) => {
    e.stopPropagation(); // Prevent card click
    onView(document);
  };
  
  const handleCardClick = () => {
    // Card click always goes to view mode
    onView(document);
  };
  
  // Google Drive documents open externally, so they don't have view/edit distinction
  const isGoogleDriveDoc = document.source === 'Google Drive';
  
  return (
    <div 
      className={styles.documentCard} 
      onClick={isGoogleDriveDoc ? null : handleCardClick}
      style={{ cursor: isGoogleDriveDoc ? 'default' : 'pointer' }}
    >
      <h3 className={styles.documentTitle}>{document.title || 'Untitled Document'}</h3>
      <p className={styles.documentDate}>
        Last updated: {new Date(document.updatedAt.seconds * 1000).toLocaleDateString()}
      </p>
      <p className={styles.documentSource}>
        Source: {document.source || 'Native'}
        {document.isMarkdown && <span className={styles.mdBadge}>MD</span>}
      </p>
      <div className={styles.documentActions} onClick={e => e.stopPropagation()}>
        {!isGoogleDriveDoc && (
          <button 
            className={`${moduleStyles.iconButton} ${moduleStyles.viewButton}`}
            onClick={handleViewClick}
            title="View document"
          >
            <Eye size={16} />
          </button>
        )}
        
        <button 
          className={`${moduleStyles.iconButton} ${moduleStyles.editButton}`}
          onClick={handleEditClick}
          title={isGoogleDriveDoc ? "Open in Google Drive" : "Edit document"}
        >
          {isGoogleDriveDoc ? <ExternalLink size={16} /> : <Edit size={16} />}
        </button>
        
        <button 
          className={`${moduleStyles.iconButton} ${moduleStyles.deleteButton}`}
          onClick={handleDeleteClick}
          title="Delete document"
        >
          <Trash2 size={16} />
        </button>
      </div>
      
      {isConfirmingDelete && (
        <div className={moduleStyles.deleteConfirmationOverlay} onClick={e => e.stopPropagation()}>
          <div className={moduleStyles.deleteConfirmation}>
            <span>Delete this document?</span>
            <button
              className={moduleStyles.actionButton}
              style={{ backgroundColor: '#4ade80', color: 'white', padding: '0.25rem 0.5rem', margin: '0 0.25rem' }}
              onClick={handleConfirmDelete}
              title="Yes, delete document"
            >
              <Check size={14} />
            </button>
            <button
              className={moduleStyles.actionButton}
              style={{ backgroundColor: '#f87171', color: 'white', padding: '0.25rem 0.5rem', margin: '0 0.25rem' }}
              onClick={handleCancelDelete}
              title="No, cancel"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

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
    try {
      await deleteDocument(id);
      await deleteVector(user.uid, id, 'document');
      setDocuments(documents.filter(doc => doc.id !== id));
    } catch (error) {
      console.error('Error deleting document:', error);
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

  const handleEditDocument = (doc) => {
    if (doc.source === 'Google Drive' && doc.originalId) {
      openGoogleDriveDocument(doc.originalId);
    } else {
      // For native documents, use the existing route to edit mode
      window.location.href = `/project/${projectId}/documents/${doc.id}`;
    }
  };
  
  const handleViewDocument = (doc) => {
    if (doc.source === 'Google Drive' && doc.originalId) {
      // Google Drive docs just open in Google Drive
      openGoogleDriveDocument(doc.originalId);
    } else {
      // For native documents, go to the same route but add view=true param
      window.location.href = `/project/${projectId}/documents/${doc.id}?view=true`;
    }
  };

  if (loading) {
    return <div className={moduleStyles.loading}>Loading documents...</div>;
  }

  return (
    <div className="container mt-4">
      <div className={moduleStyles.container}>
        <div className={moduleStyles.header}>
          <h2 className={moduleStyles.title}>
            <File size={20} />
            <span>My Documents</span>
          </h2>
          
          <Link 
            to={`/project/${projectId}/documents/new`} 
            className={`${moduleStyles.actionButton} ${moduleStyles.primaryButton}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <PlusCircle size={16} />
            New Document
          </Link>
        </div>
        
        <div className={styles.googleDriveSection}>
          {googleDriveSignedIn ? (
            <>
              <button 
                onClick={handleGoogleDriveSignOut} 
                className={styles.googleDriveButton}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <LogOut size={16} />
                Sign Out from Google Drive
              </button>
              <button 
                onClick={() => setIsGoogleDrivePickerOpen(true)} 
                className={styles.googleDriveImportButton}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <File size={16} />
                Import from Google Drive
              </button>
            </>
          ) : (
            <button 
              onClick={handleGoogleDriveSignIn} 
              className={styles.googleDriveButton}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <LogIn size={16} />
              Sign In to Google Drive
            </button>
          )}
        </div>
        
        {documents.length > 0 ? (
          <div className={styles.documentGrid}>
            {documents.map(doc => (
              <DocumentCard 
                key={doc.id} 
                document={doc} 
                onDelete={handleDelete}
                onOpen={handleEditDocument}
                onView={handleViewDocument}
              />
            ))}
          </div>
        ) : (
          <div className={moduleStyles.emptyState}>
            No documents yet. Create one using the "New Document" button or import from Google Drive.
          </div>
        )}
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
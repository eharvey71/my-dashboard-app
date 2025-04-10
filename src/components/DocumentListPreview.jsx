import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getDocuments } from '../services/firebaseConfig';
import moduleStyles from './DashboardModule.module.css';
import styles from './DocumentListPreview.module.css';
import { FileText, ExternalLink, Plus, FileUp, File } from 'lucide-react';
import QuickNoteSelector from './QuickNoteSelector';

const DocumentListPreview = ({ user, projectId, limit = 5, onDocumentClick }) => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isQuickNoteModalOpen, setIsQuickNoteModalOpen] = useState(false);

  useEffect(() => {
    const fetchDocuments = async () => {
      if (user && projectId) {
        try {
          const fetchedDocuments = await getDocuments(user.uid, projectId);
          // Sort documents by updatedAt in descending order
          const sortedDocs = fetchedDocuments.sort((a, b) => {
            const dateA = a.updatedAt?.seconds ? new Date(a.updatedAt.seconds * 1000) : new Date(0);
            const dateB = b.updatedAt?.seconds ? new Date(b.updatedAt.seconds * 1000) : new Date(0);
            return dateB - dateA;
          });
          setDocuments(sortedDocs.slice(0, limit));
        } catch (error) {
          console.error("Error fetching documents:", error);
        } finally {
          setLoading(false);
        }
      }
    };

    fetchDocuments();
  }, [user, projectId, limit]);

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Unknown date';
    if (timestamp.seconds) {
      return new Date(timestamp.seconds * 1000).toLocaleDateString();
    }
    if (timestamp instanceof Date) {
      return timestamp.toLocaleDateString();
    }
    return 'Invalid date';
  };

  if (loading) {
    return <div className={moduleStyles.loading}>Loading documents...</div>;
  }

  const hasMoreDocuments = documents.length === limit;

  return (
    <div className={moduleStyles.container}>
      <div className={moduleStyles.header}>
        <h2 className={moduleStyles.title}>
          <File size={20} />
          <span>Recent Documents</span>
        </h2>
        <Link to={`/project/${projectId}/documents`} className={moduleStyles.viewAllButton}>
          View All Documents
        </Link>
      </div>

      <div className={styles.documentButtons}>
        <Link 
          to={`/project/${projectId}/documents/new`} 
          className={`${moduleStyles.actionButton} ${moduleStyles.primaryButton} ${styles.documentButton}`}
        >
          <Plus size={16} /> New Document
        </Link>
        <button 
          className={`${moduleStyles.actionButton} ${moduleStyles.secondaryButton} ${styles.documentButton}`}
          onClick={() => setIsQuickNoteModalOpen(true)}
        >
          <FileUp size={16} /> From Note
        </button>
      </div>

      <ul className={moduleStyles.list}>
        {documents.length > 0 ? (
          documents.map((document) => (
            <li 
              key={document.id} 
              className={`${moduleStyles.listItem} ${moduleStyles.documentItem}`}
            >
              <div 
                className={moduleStyles.listItemContent}
                style={{ cursor: 'pointer' }}
                onClick={() => onDocumentClick(document)}
              >
                {document.source === 'Google Drive' ? (
                  <ExternalLink size={18} className={styles.documentIcon} />
                ) : (
                  <FileText size={18} className={styles.documentIcon} />
                )}
                <span>{document.title || 'Untitled Document'}</span>
              </div>
              
              <div className={moduleStyles.listItemActions}>
                <span className={moduleStyles.timestamp}>
                  {formatDate(document.updatedAt)}
                </span>
              </div>
            </li>
          ))
        ) : (
          <div className={moduleStyles.emptyState}>
            No documents yet. Create one using the buttons above.
          </div>
        )}
      </ul>

      {/* Quick Note Selector Modal */}
      {isQuickNoteModalOpen && (
        <QuickNoteSelector
          user={user}
          projectId={projectId}
          onClose={() => setIsQuickNoteModalOpen(false)}
        />
      )}
    </div>
  );
};

export default DocumentListPreview;
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getDocuments } from '../services/firebaseConfig';
import styles from './DocumentListPreview.module.css';
import { FileText, ExternalLink, Plus, FileUp } from 'lucide-react';
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

  if (loading) {
    return <div>Loading documents...</div>;
  }

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

  return (
    <div className="card">
      <div className="card-body">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-3">
          <h2 className="card-title mb-md-0">Recent Documents</h2>
          <div className={styles.documentButtons}>
            <Link 
              to={`/project/${projectId}/documents/new`} 
              className={`btn btn-sm btn-outline-primary me-2 ${styles.documentButton}`}
            >
              <Plus size={16} className="me-1" /> New Document
            </Link>
            <button 
              className={`btn btn-sm btn-outline-secondary ${styles.documentButton}`}
              onClick={() => setIsQuickNoteModalOpen(true)}
            >
              <FileUp size={16} className="me-1" /> Create from Quick Note
            </button>
          </div>
        </div>

        <ul className={`list-group ${styles.documentList}`}>
          {documents.map((document) => (
            <li key={document.id} className={`list-group-item ${styles.documentItem}`}>
              <a 
                href="#" 
                onClick={(e) => {
                  e.preventDefault();
                  onDocumentClick(document);
                }} 
                className={styles.documentLink}
              >
                <span className={styles.documentTitle}>
                  {document.source === 'Google Drive' ? <ExternalLink size={16} /> : <FileText size={16} />}
                  {document.title || 'Untitled Document'}
                </span>
                <small className={styles.documentDate}>
                  Last updated: {formatDate(document.updatedAt)}
                </small>
              </a>
            </li>
          ))}
        </ul>
        
        {documents.length === limit && (
          <div className={`${styles.viewMoreContainer} mt-3`}>
            <Link to={`/project/${projectId}/documents`} className={`btn btn-link ${styles.viewMoreLink}`}>View More</Link>
          </div>
        )}

        {/* Quick Note Selector Modal */}
        {isQuickNoteModalOpen && (
          <QuickNoteSelector
            user={user}
            projectId={projectId}
            onClose={() => setIsQuickNoteModalOpen(false)}
          />
        )}
      </div>
    </div>
  );
};

export default DocumentListPreview;
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getDocuments } from '../services/firebaseConfig';
import styles from './DocumentListPreview.module.css';

const DocumentListPreview = ({ user, projectId, limit = 5 }) => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

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
        <h2 className="card-title">Recent Documents</h2>
        <ul className={`list-group ${styles.documentList}`}>
          {documents.map((document) => (
            <li key={document.id} className={`list-group-item ${styles.documentItem}`}>
              <Link to={`/project/${projectId}/documents/${document.id}`} className={styles.documentLink}>
                <span className={styles.documentTitle}>{document.title || 'Untitled Document'}</span>
                <small className={styles.documentDate}>
                  Last updated: {formatDate(document.updatedAt)}
                </small>
              </Link>
            </li>
          ))}
        </ul>
        {documents.length === limit && (
          <div className={`${styles.viewMoreContainer} mt-3`}>
            <Link to={`/project/${projectId}/documents`} className={`btn btn-link ${styles.viewMoreLink}`}>View More</Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentListPreview;
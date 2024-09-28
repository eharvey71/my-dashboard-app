import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getDocuments, deleteDocument } from '../services/firebaseConfig';
import { Trash2, Edit2, PlusCircle } from 'lucide-react';
import styles from './DocumentList.module.css';

const DocumentList = ({ user }) => {
  const { projectId } = useParams();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDocuments();
  }, [user, projectId]);

  const fetchDocuments = async () => {
    try {
      const docs = await getDocuments(user.uid, projectId);
      // Sort documents by updatedAt in descending order
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
        setDocuments(documents.filter(doc => doc.id !== id));
      } catch (error) {
        console.error('Error deleting document:', error);
      }
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
      <div className={styles.documentGrid}>
        {documents.map(doc => (
          <div key={doc.id} className={styles.documentCard}>
            <h3 className={styles.documentTitle}>{doc.title || 'Untitled Document'}</h3>
            <p className={styles.documentDate}>
              Last updated: {new Date(doc.updatedAt.seconds * 1000).toLocaleDateString()}
            </p>
            <div className={styles.documentActions}>
              <Link to={`/project/${projectId}/documents/${doc.id}`} className={styles.editButton}>
                <Edit2 size={18} />
                Edit
              </Link>
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
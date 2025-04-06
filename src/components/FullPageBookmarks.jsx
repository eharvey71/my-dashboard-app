import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getBookmarks, deleteBookmark } from '../services/firebaseConfig';
import { Trash2, Check, X, Globe, Bookmark } from 'lucide-react';
import moduleStyles from './DashboardModule.module.css';
import styles from './FullPageBookmarks.module.css';

const BookmarkCard = ({ bookmark, onDelete }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [imageError, setImageError] = useState(false);

  const handleDeleteClick = () => {
    setIsConfirmingDelete(true);
  };

  const handleConfirmDelete = () => {
    onDelete(bookmark.id);
    setIsConfirmingDelete(false);
  };

  const handleCancelDelete = () => {
    setIsConfirmingDelete(false);
  };

  return (
    <div 
      className={styles.bookmarkCard}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        if (!isConfirmingDelete) {
          setIsConfirmingDelete(false);
        }
      }}
    >
      <a href={bookmark.url} target="_blank" rel="noopener noreferrer" className={styles.bookmarkLink}>
        {imageError ? (
          <div className={styles.bookmarkImageFallback}>
            <Globe size={40} />
            <span className={styles.bookmarkInitial}>
              {(bookmark.title || bookmark.url || 'B').charAt(0).toUpperCase()}
            </span>
          </div>
        ) : (
          <img 
            src={bookmark.image} 
            alt={bookmark.title} 
            className={styles.bookmarkImage} 
            onError={() => setImageError(true)}
          />
        )}
        <h3 className={styles.bookmarkTitle}>{bookmark.title}</h3>
      </a>
      
      <div className={styles.bookmarkActions}>
        <button
          className={`${moduleStyles.iconButton} ${moduleStyles.deleteButton}`}
          onClick={handleDeleteClick}
          title="Delete bookmark"
        >
          <Trash2 size={16} />
        </button>
      </div>
      
      {isConfirmingDelete && (
        <div className={moduleStyles.deleteConfirmationOverlay}>
          <div className={moduleStyles.deleteConfirmation}>
            <span>Confirm delete?</span>
            <button
              className={moduleStyles.actionButton}
              style={{ backgroundColor: '#4ade80', color: 'white', padding: '0.25rem 0.5rem', margin: '0 0.25rem' }}
              onClick={handleConfirmDelete}
              title="Yes, delete bookmark"
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

const FullPageBookmarks = ({ user }) => {
  const { projectId } = useParams();
  const [bookmarks, setBookmarks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBookmarks = async () => {
      try {
        const fetchedBookmarks = await getBookmarks(user.uid, projectId);
        setBookmarks(fetchedBookmarks);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching bookmarks:", error);
        setLoading(false);
      }
    };

    if (user && projectId) {
      fetchBookmarks();
    }
  }, [user, projectId]);

  const handleDelete = async (id) => {
    try {
      await deleteBookmark(id);
      setBookmarks(bookmarks.filter(bookmark => bookmark.id !== id));
    } catch (error) {
      console.error("Error deleting bookmark:", error);
    }
  };

  if (loading) {
    return <div className={moduleStyles.loading}>Loading bookmarks...</div>;
  }

  return (
    <div className="container mt-4">
      <div className={moduleStyles.container}>
        <div className={moduleStyles.header}>
          <h2 className={moduleStyles.title}>
            <Bookmark size={20} />
            <span>All Bookmarks</span>
          </h2>
        </div>
        
        {bookmarks.length > 0 ? (
          <div className={styles.bookmarkGrid}>
            {bookmarks.map((bookmark) => (
              <BookmarkCard
                key={bookmark.id}
                bookmark={bookmark}
                onDelete={handleDelete}
              />
            ))}
          </div>
        ) : (
          <div className={moduleStyles.emptyState}>
            No bookmarks added yet. Add some bookmarks to get started!
          </div>
        )}
      </div>
    </div>
  );
};

export default FullPageBookmarks;
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getBookmarks, deleteBookmark } from '../services/firebaseConfig';
import { Trash2, Check, X } from 'lucide-react';
import './FullPageBookmarks.css';

const BookmarkCard = ({ bookmark, onDelete }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

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
      className="bookmark-card"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setIsConfirmingDelete(false);
      }}
    >
      <a href={bookmark.url} target="_blank" rel="noopener noreferrer" className="bookmark-link">
        <img src={bookmark.image} alt={bookmark.title} className="bookmark-image-large" />
        <h3 className="bookmark-title">{bookmark.title}</h3>
      </a>
      <div className="bookmark-actions">
        <button
          className="btn btn-sm btn-link text-danger delete-btn"
          onClick={handleDeleteClick}
          title="Delete bookmark"
        >
          <Trash2 size={18} />
        </button>
      </div>
      {isConfirmingDelete && (
        <div className="delete-confirmation-overlay">
          <div className="delete-confirmation d-flex align-items-center justify-content-center">
            <span className="me-2">Confirm delete?</span>
            <button
              className="btn btn-sm btn-success me-1"
              onClick={handleConfirmDelete}
              title="Confirm delete"
            >
              <Check size={14} />
            </button>
            <button
              className="btn btn-sm btn-danger"
              onClick={handleCancelDelete}
              title="Cancel delete"
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
    return <div>Loading bookmarks...</div>;
  }

  return (
    <div className="container mt-4">
      <h1>All Bookmarks</h1>
      <div className="bookmark-grid">
        {bookmarks.map((bookmark) => (
          <BookmarkCard
            key={bookmark.id}
            bookmark={bookmark}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </div>
  );
};

export default FullPageBookmarks;
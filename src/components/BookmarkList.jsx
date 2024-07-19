import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getBookmarks, deleteBookmark, updateBookmark, addBookmark } from '../services/firebaseConfig';
import { Trash2, ArrowUpRight, Check, X } from 'lucide-react';
import styles from './BookmarkList.module.css';

const BookmarkList = ({ user, bookmarks, setBookmarks, limit = 5, showAddBookmark = false }) => {
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [isHovered, setIsHovered] = useState(null);
  const [newBookmarkUrl, setNewBookmarkUrl] = useState('');

  useEffect(() => {
    if (user) {
      const fetchBookmarks = async () => {
        const fetchedBookmarks = await getBookmarks(user.uid);
        setBookmarks(fetchedBookmarks);
      };

      fetchBookmarks();
    }
  }, [user, setBookmarks]);

  const handleEdit = (bookmark) => {
    setEditingId(bookmark.id);
    setEditTitle(bookmark.title);
  };

  const handleSave = async (id) => {
    await updateBookmark(id, { title: editTitle });
    setBookmarks(bookmarks.map(b => b.id === id ? { ...b, title: editTitle } : b));
    setEditingId(null);
  };

  const handleDelete = async (id) => {
    if (deletingId === id) {
      await deleteBookmark(id);
      setBookmarks(bookmarks.filter(bookmark => bookmark.id !== id));
      setDeletingId(null);
    } else {
      setDeletingId(id);
    }
  };

  const cancelDelete = () => {
    setDeletingId(null);
  };

  const handleAddBookmark = async () => {
    if (newBookmarkUrl.trim() === '') return;

    try {
      const newBookmark = await addBookmark(newBookmarkUrl, newBookmarkUrl, '/api/placeholder/400/300', user.uid);
      setBookmarks([newBookmark, ...bookmarks]);
      setNewBookmarkUrl('');
    } catch (error) {
      console.error('Error adding bookmark:', error);
    }
  };

  const displayedBookmarks = bookmarks.slice(0, limit);
  const hasMoreBookmarks = bookmarks.length > limit;

  return (
    <div className="card">
      <div className="card-body">
        <h2 className="card-title">My Bookmarks</h2>
        {showAddBookmark && (
          <div className={`input-group mb-3 ${styles.inputGroup}`}>
            <input
              type="text"
              className="form-control"
              placeholder="Enter URL"
              value={newBookmarkUrl}
              onChange={(e) => setNewBookmarkUrl(e.target.value)}
            />
            <button
              className="btn btn-outline-secondary"
              onClick={handleAddBookmark}
            >
              Add Bookmark
            </button>
          </div>
        )}
        <ul className={styles.listGroup}>
          {displayedBookmarks.map((bookmark) => (
            <li 
              key={bookmark.id} 
              className={`${styles.listItem} position-relative`}
              onMouseEnter={() => setIsHovered(bookmark.id)}
              onMouseLeave={() => {
                setIsHovered(null);
                setDeletingId(null);
              }}
            >
              <img src={bookmark.image} alt={bookmark.title} className={styles.bookmarkImage} />
              <div className={styles.bookmarkContent}>
                {editingId === bookmark.id ? (
                  <input
                    type="text"
                    className={`form-control ${styles.formControl}`}
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onBlur={() => handleSave(bookmark.id)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSave(bookmark.id)}
                  />
                ) : (
                  <span onClick={() => handleEdit(bookmark)} className={styles.bookmarkTitle}>
                    {bookmark.title}
                  </span>
                )}
              </div>
              <div className={styles.bookmarkActions}>
                <a href={bookmark.url} target="_blank" rel="noopener noreferrer" className={`btn btn-sm btn-link ${styles.actionButton}`}>
                  <ArrowUpRight size={18} />
                </a>
                <button 
                  className={`btn btn-sm btn-link text-danger ${styles.actionButton}`}
                  onClick={() => handleDelete(bookmark.id)}
                  title="Delete bookmark"
                >
                  <Trash2 size={18} />
                </button>
              </div>
              {deletingId === bookmark.id && (
                <div className={styles.deleteConfirmationOverlay}>
                  <div className={`${styles.deleteConfirmation} d-flex align-items-center justify-content-center`}>
                    <span className="me-2">Confirm delete?</span>
                    <button
                      className={`btn btn-sm btn-success me-1 ${styles.deleteConfirmationButton}`}
                      onClick={() => handleDelete(bookmark.id)}
                      title="Confirm delete"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      className={`btn btn-sm btn-danger ${styles.deleteConfirmationButton}`}
                      onClick={cancelDelete}
                      title="Cancel delete"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
          {hasMoreBookmarks && (
            <li className={`${styles.listItem} text-center`}>
              <Link to="/bookmarks">View More</Link>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
};

export default BookmarkList;
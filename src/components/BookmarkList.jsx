import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getBookmarks, deleteBookmark, updateBookmark, addBookmark } from '../services/firebaseConfig';
import { fetchLinkMetadata } from "../services/externalServices";
import { Trash2, ArrowUpRight, Check, X, Globe, Bookmark } from 'lucide-react';
import styles from './BookmarkList.module.css';
import moduleStyles from './DashboardModule.module.css';
import formatUrl from '../utils/urlFormatter';

const BookmarkList = ({ user, projectId, bookmarks, setBookmarks, limit = 5 }) => {
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [isHovered, setIsHovered] = useState(null);
  const [newBookmarkUrl, setNewBookmarkUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [brokenImages, setBrokenImages] = useState({});

  useEffect(() => {
    if (user && projectId) {
      const fetchBookmarks = async () => {
        const fetchedBookmarks = await getBookmarks(user.uid, projectId);
        setBookmarks(fetchedBookmarks);
      };

      fetchBookmarks();
    }
  }, [user, projectId, setBookmarks]);

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
    if (!newBookmarkUrl.trim()) return;
    
    setLoading(true);
    setError(null);
  
    try {
      const formattedUrl = formatUrl(newBookmarkUrl, window.location.hostname);
      const metadata = await fetchLinkMetadata(formattedUrl);
      const newBookmark = await addBookmark(formattedUrl, metadata.title, metadata.image, user.uid, projectId);
      setBookmarks((prev) => [newBookmark, ...prev]);
      setNewBookmarkUrl('');
    } catch (err) {
      console.error("Error adding bookmark:", err);
      setError("Failed to add bookmark");
    }
  
    setLoading(false);
  };

  const displayedBookmarks = bookmarks.slice(0, limit);
  const hasMoreBookmarks = bookmarks.length > limit;

  return (
    <div className={moduleStyles.container}>
      <div className={moduleStyles.header}>
        <h2 className={moduleStyles.title}>
          <Bookmark size={20} />
          <span>My Bookmarks</span>
        </h2>
        {hasMoreBookmarks && (
          <Link to={`/project/${projectId}/bookmarks`} className={moduleStyles.viewAllButton}>
            View All
          </Link>
        )}
      </div>

      <div className={moduleStyles.inputGroup}>
        <input
          type="text"
          className={moduleStyles.input}
          placeholder="Enter URL"
          value={newBookmarkUrl}
          onChange={(e) => setNewBookmarkUrl(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === "Enter") {
              handleAddBookmark();
            }
          }}
        />
        <button
          className={`${moduleStyles.actionButton} ${moduleStyles.primaryButton}`}
          onClick={handleAddBookmark}
          disabled={loading}
        >
          {loading ? "Adding..." : "Add Bookmark"}
        </button>
      </div>
      
      {error && <p className={moduleStyles.error}>{error}</p>}
      
      <ul className={moduleStyles.list}>
        {displayedBookmarks.map((bookmark) => (
          <li 
            key={bookmark.id} 
            className={`${moduleStyles.listItem} ${moduleStyles.bookmarkItem}`}
            onMouseEnter={() => setIsHovered(bookmark.id)}
            onMouseLeave={() => {
              setIsHovered(null);
              setDeletingId(null);
            }}
          >
            <div className={moduleStyles.listItemContent}>
              {bookmark.image ? (
                <img 
                  src={bookmark.image} 
                  alt="" 
                  className={moduleStyles.thumbnail}
                  onError={() => setBrokenImages(prev => ({ ...prev, [bookmark.id]: true }))}
                />
              ) : (
                <div className={moduleStyles.fallbackThumbnail}>
                  <Globe size={14} />
                </div>
              )}
              
              {editingId === bookmark.id ? (
                <input
                  type="text"
                  className={moduleStyles.input}
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onBlur={() => handleSave(bookmark.id)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSave(bookmark.id)}
                />
              ) : (
                <span onClick={() => handleEdit(bookmark)}>
                  {bookmark.title}
                </span>
              )}
            </div>
            
            <div className={moduleStyles.listItemActions}>
              <a 
                href={bookmark.url} 
                target="_blank" 
                rel="noopener noreferrer" 
                className={moduleStyles.iconButton}
              >
                <ArrowUpRight size={18} />
              </a>
              <button 
                className={`${moduleStyles.iconButton} ${moduleStyles.deleteButton}`}
                onClick={() => handleDelete(bookmark.id)}
                title="Delete bookmark"
              >
                <Trash2 size={18} />
              </button>
            </div>
            
            {deletingId === bookmark.id && (
              <div className={moduleStyles.deleteConfirmationOverlay}>
                <div className={moduleStyles.deleteConfirmation}>
                  <span>Confirm delete?</span>
                  <button
                    className={`${moduleStyles.iconButton} ${moduleStyles.primaryButton}`}
                    onClick={() => handleDelete(bookmark.id)}
                    title="Confirm delete"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    className={`${moduleStyles.iconButton} ${moduleStyles.dangerButton}`}
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
        
        {displayedBookmarks.length === 0 && (
          <div className={moduleStyles.emptyState}>
            No bookmarks yet. Add one above!
          </div>
        )}
      </ul>
    </div>
  );
};

export default BookmarkList;
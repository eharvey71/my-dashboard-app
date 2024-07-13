import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getBookmarks, deleteBookmark, updateBookmark } from '../services/firebaseConfig';
import { Trash2, ArrowUpRight, Check, X } from 'lucide-react';
import './BookmarkList.css';

const BookmarkList = ({ user, bookmarks, setBookmarks, limit = 5 }) => {
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [isHovered, setIsHovered] = useState(null);

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

  const displayedBookmarks = bookmarks.slice(0, limit);
  const hasMoreBookmarks = bookmarks.length > limit;

  return (
    <div className="card">
      <div className="card-body">
        <h2 className="card-title">My Bookmarks</h2>
        <ul className="list-group">
          {displayedBookmarks.map((bookmark) => (
            <li 
              key={bookmark.id} 
              className="list-group-item d-flex justify-content-between align-items-center position-relative"
              onMouseEnter={() => setIsHovered(bookmark.id)}
              onMouseLeave={() => {
                setIsHovered(null);
                setDeletingId(null);
              }}
            >
              <img src={bookmark.image} alt={bookmark.title} className="bookmark-image" />
              <div className="bookmark-content">
                {editingId === bookmark.id ? (
                  <input
                    type="text"
                    className="form-control"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onBlur={() => handleSave(bookmark.id)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSave(bookmark.id)}
                  />
                ) : (
                  <span onClick={() => handleEdit(bookmark)} className="bookmark-title">
                    {bookmark.title}
                  </span>
                )}
              </div>
              <div className="bookmark-actions">
                <a href={bookmark.url} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-link">
                  <ArrowUpRight size={18} />
                </a>
                <button 
                  className="btn btn-sm btn-link text-danger" 
                  onClick={() => handleDelete(bookmark.id)}
                  title="Delete bookmark"
                >
                  <Trash2 size={18} />
                </button>
              </div>
              {deletingId === bookmark.id && (
                <div className="delete-confirmation-overlay">
                  <div className="delete-confirmation d-flex align-items-center justify-content-center">
                    <span className="me-2">Confirm delete?</span>
                    <button
                      className="btn btn-sm btn-success me-1"
                      onClick={() => handleDelete(bookmark.id)}
                      title="Confirm delete"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
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
            <li className="list-group-item text-center">
              <Link to="/bookmarks">View More</Link>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
};

export default BookmarkList;
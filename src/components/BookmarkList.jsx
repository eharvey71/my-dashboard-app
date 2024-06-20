import React, { useEffect } from 'react';
import { getBookmarks, deleteBookmark } from '../services/firebaseConfig';
import './BookmarkList.css';

const BookmarkList = ({ user, bookmarks, setBookmarks }) => {
  useEffect(() => {
    if (user) {
      const fetchBookmarks = async () => {
        const fetchedBookmarks = await getBookmarks(user.uid);
        setBookmarks(fetchedBookmarks);
      };

      fetchBookmarks();
    }
  }, [user, setBookmarks]);

  const handleDelete = async (id) => {
    await deleteBookmark(id);
    setBookmarks(bookmarks.filter(bookmark => bookmark.id !== id));
  };

  return (
    <div className="card">
      <div className="card-body">
        <h2 className="card-title">My Bookmarks</h2>
        <ul className="list-group">
          {bookmarks.map((bookmark) => (
            <li key={bookmark.id} className="list-group-item d-flex justify-content-between align-items-center">
              <a href={bookmark.url} target="_blank" rel="noopener noreferrer" className="d-flex align-items-center">
                <img src={bookmark.image} alt={bookmark.title} className="bookmark-image" />
                <span>{bookmark.title}</span>
              </a>
              <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(bookmark.id)}>Delete</button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default BookmarkList;

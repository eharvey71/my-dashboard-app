import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebaseConfig';
import './BookmarkList.css';

const BookmarkList = ({ user }) => {
  const [bookmarks, setBookmarks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      const fetchBookmarks = async () => {
        const bookmarksCollection = collection(db, 'bookmarks');
        const q = query(bookmarksCollection, where('userId', '==', user.uid));
        const querySnapshot = await getDocs(q);
        const fetchedBookmarks = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setBookmarks(fetchedBookmarks);
        setLoading(false);
      };

      fetchBookmarks();
    }
  }, [user]);

  if (loading) {
    return <div>Loading bookmarks...</div>;
  }

  return (
    <div className="bookmark-list">
      <h2>My Bookmarks</h2>
      <ul className="list-group">
        {bookmarks.map((bookmark) => (
          <li key={bookmark.id} className="list-group-item">
            <a href={bookmark.url} target="_blank" rel="noopener noreferrer">
              <img src={bookmark.image} alt={bookmark.title} className="bookmark-image" />
              <span>{bookmark.title}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default BookmarkList;

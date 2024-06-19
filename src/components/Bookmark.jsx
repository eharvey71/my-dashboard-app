import React, { useState } from 'react';
import axios from 'axios';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '../services/firebaseConfig'; // Ensure this points to your Firebase config
import './Bookmark.css';

const Bookmark = ({ user }) => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchMetadata = async (url) => {
    try {
      const response = await axios.get(`https://api.linkpreview.net/?key=YOUR_API_KEY&q=${url}`);
      return response.data;
    } catch (err) {
      console.error('Error fetching metadata:', err);
      return null;
    }
  };

  const handleAddBookmark = async () => {
    setLoading(true);
    setError(null);
    const metadata = await fetchMetadata(url);

    if (metadata) {
      try {
        const bookmarksCollection = collection(db, 'bookmarks');
        await addDoc(bookmarksCollection, {
          url,
          title: metadata.title,
          image: metadata.image,
          userId: user.uid,
        });
        setUrl('');
      } catch (err) {
        console.error('Error adding bookmark:', err);
        setError('Failed to add bookmark');
      }
    } else {
      setError('Failed to fetch metadata');
    }

    setLoading(false);
  };

  return (
    <div className="bookmark-container">
      <h2>Add Bookmark</h2>
      <div className="input-group mb-3">
        <input
          type="text"
          className="form-control"
          placeholder="Enter URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button
          className="btn btn-outline-secondary"
          onClick={handleAddBookmark}
          disabled={loading}
        >
          {loading ? 'Adding...' : 'Add Bookmark'}
        </button>
      </div>
      {error && <p className="text-danger">{error}</p>}
    </div>
  );
};

export default Bookmark;

import React, { useState } from 'react';
import axios from 'axios';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '../services/firebaseConfig';
import './Bookmark.css';

const Bookmark = ({ user, setBookmarks }) => { // Accept setBookmarks as a prop
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchMetadata = async (url) => {
    try {
      const response = await axios.get(`https://api.linkpreview.net/?key=aedc1f8b83d606e8fe30c8c9a8669598&q=${url}`);
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
        const docRef = await addDoc(bookmarksCollection, {
          url,
          title: metadata.title,
          image: metadata.image,
          userId: user.uid,
        });
        setBookmarks(prev => [...prev, { id: docRef.id, url, title: metadata.title, image: metadata.image, userId: user.uid }]); // Update state
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
    <div className="card mb-4">
      <div className="card-body">
        <h2 className="card-title">Add Bookmark</h2>
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
    </div>
  );
};

export default Bookmark;

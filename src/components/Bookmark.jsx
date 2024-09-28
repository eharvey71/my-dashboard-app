import React, { useState } from "react";
import { addBookmark } from "../services/firebaseConfig";
import { fetchLinkMetadata } from "../services/externalServices";
import styles from "./Bookmark.module.css";
import formatUrl from '../utils/urlFormatter';

const Bookmark = ({ user, projectId, setBookmarks }) => {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleAddBookmark = async () => {
    if (!url.trim()) return;
    
    setLoading(true);
    setError(null);
  
    try {
      const formattedUrl = formatUrl(url, window.location.hostname);
      const metadata = await fetchLinkMetadata(formattedUrl);
      const newBookmark = await addBookmark(formattedUrl, metadata.title, metadata.image, user.uid, projectId);
      setBookmarks((prev) => [newBookmark, ...prev]);
      setUrl("");
    } catch (err) {
      console.error("Error adding bookmark:", err);
      setError("Failed to add bookmark");
    }
  
    setLoading(false);
  };

  return (
    <div className={`card mb-4 ${styles.bookmarkContainer}`}>
      <div className="card-body">
        <h2 className="card-title">Add Bookmark</h2>
        <div className={`input-group mb-3 ${styles.inputGroup}`}>
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
            {loading ? "Adding..." : "Add Bookmark"}
          </button>
        </div>
        {error && <p className="text-danger">{error}</p>}
      </div>
    </div>
  );
};

export default Bookmark;
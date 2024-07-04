import React, { useState } from "react";
import axios from "axios";
import { addDoc, collection, updateDoc, doc } from "firebase/firestore";
import { db } from "../services/firebaseConfig";
import "./Bookmark.css";

const Bookmark = ({ user, setBookmarks }) => {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchMetadata = async (url) => {
    try {
      const response = await axios.post(
        "https://api.linkpreview.net",
        {
          q: url,
        },
        {
          headers: {
            "X-Linkpreview-Api-Key": "aedc1f8b83d606e8fe30c8c9a8669598",
          },
        }
      );
      return response.data;
    } catch (err) {
      console.error("Error fetching metadata:", err);
      return null;
    }
  };

  const handleAddBookmark = async () => {
    setLoading(true);
    setError(null);

    try {
      // Add bookmark with initial data
      const bookmarksCollection = collection(db, "bookmarks");
      const initialBookmarkData = {
        url,
        title: url,
        image: "/api/placeholder/400/300",
        userId: user.uid,
        indexed: false,
      };

      const docRef = await addDoc(bookmarksCollection, initialBookmarkData);
      const newBookmark = { id: docRef.id, ...initialBookmarkData };

      // Update state immediately
      setBookmarks((prev) => [...prev, newBookmark]);
      setUrl("");

      // Attempt to fetch metadata
      const metadata = await fetchMetadata(url);

      if (metadata) {
        // Update the bookmark with metadata if available
        const updatedData = {
          title: metadata.title || url,
          image: metadata.image || "/api/placeholder/400/300",
        };
        await updateDoc(doc(db, "bookmarks", docRef.id), updatedData);

        // Update state with metadata
        setBookmarks((prev) =>
          prev.map((bookmark) =>
            bookmark.id === docRef.id
              ? { ...bookmark, ...updatedData }
              : bookmark
          )
        );
      }
    } catch (err) {
      console.error("Error adding bookmark:", err);
      setError("Failed to add bookmark");
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
            {loading ? "Adding..." : "Add Bookmark"}
          </button>
        </div>
        {error && <p className="text-danger">{error}</p>}
      </div>
    </div>
  );
};

export default Bookmark;

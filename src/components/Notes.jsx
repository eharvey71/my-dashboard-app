import React, { useState, useEffect } from "react";
import { Link } from 'react-router-dom';
import { getNotes, addNote, deleteNote } from "../services/firebaseConfig";
import { indexContent } from "../services/pineconeService";
import "./Notes.css";

const Notes = ({ user, limit }) => {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState("");
  const [error, setError] = useState(null);
  const maxChars = 200;

  useEffect(() => {
    if (user) {
      fetchNotes();
    }
  }, [user]);

  const fetchNotes = async () => {
    try {
      const fetchedNotes = await getNotes(user.uid);
      setNotes(fetchedNotes);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching notes:", error);
      setLoading(false);
      setError("Failed to fetch notes");
    }
  };

  const handleAddNote = async () => {
    if (newNote.trim() === '') return;
    setError(null);
    try {
      const addedNote = await addNote(newNote, user.uid);

      setNotes((prevNotes) => [addedNote, ...prevNotes]);
      setNewNote('');

      if (!addedNote.indexedInPinecone) {
        setError('Note added, but not indexed in Pinecone. Retrying...');

        try {
          await indexContent(user.uid, addedNote.content, 'note', addedNote.id);
          setNotes(prevNotes => prevNotes.map(note =>
            note.id === addedNote.id ? { ...note, indexedInPinecone: true } : note
          ));
          setError(null);
        } catch (pineconeError) {
          console.error("Error re-indexing note in Pinecone:", pineconeError);
          setError("Failed to index note in Pinecone. Some features may be limited.");
        }
      }
    } catch (error) {
      console.error("Error adding note:", error);
      setError("Failed to add note");
    }
  };

  const handleDeleteNote = async (id) => {
    setError(null);
    try {
      await deleteNote(id);
      setNotes((prevNotes) => prevNotes.filter((note) => note.id !== id));
    } catch (error) {
      console.error("Error deleting note:", error);
      setError("Failed to delete note");
    }
  };

  const formatTimestamp = (timestamp) => {
    const date =
      timestamp instanceof Date
        ? timestamp
        : new Date(timestamp.seconds * 1000);
    return date.toLocaleString();
  };

  if (loading) {
    return <div>Loading notes...</div>;
  }

  const displayedNotes = limit ? notes.slice(0, limit) : notes;
  const hasMoreNotes = limit && notes.length > limit;

  return (
    <div className="card">
      <div className="card-body">
        <h2 className="card-title">Quick Notes</h2>
        <div className="mb-3">
          <textarea
            className="form-control"
            placeholder="New Note"
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            maxLength={maxChars}
            rows="3"
          />
          <div className="character-count">
            {maxChars - newNote.length} characters remaining
          </div>
        </div>
        <button
          className="btn btn-outline-secondary mb-3"
          onClick={handleAddNote}
        >
          Add Note
        </button>
        <ul className="list-group">
          {displayedNotes.map((note) => (
            <li key={note.id} className="list-group-item">
              <span>{note.content}</span>
              {!note.indexedInPinecone && <span className="text-warning"> (Not indexed in Pinecone)</span>}
              <div className="float-end">
                <small className="text-muted">
                  {formatTimestamp(note.createdAt)}
                </small>
                <button
                  className="btn btn-sm btn-outline-danger ms-2"
                  onClick={() => handleDeleteNote(note.id)}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
        {hasMoreNotes && (
          <div className="text-center mt-3">
            <Link to="/notes" className="btn btn-link">View More</Link>
          </div>
        )}
        {error && <p className="text-danger">{error}</p>}
      </div>
    </div>
  );
};

export default Notes;
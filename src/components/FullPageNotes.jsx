import React, { useState, useEffect } from 'react';
import { getNotes, addNote, deleteNote } from "../services/firebaseConfig";
import { indexContent } from "../services/pineconeService";
import { Trash2, Check, X } from 'lucide-react';
import './FullPageNotes.css';

const Note = ({ note, onDeleteNote }) => {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const handleDeleteClick = () => {
    setIsConfirmingDelete(true);
  };

  const handleConfirmDelete = async () => {
    await onDeleteNote(note.id);
    setIsConfirmingDelete(false);
  };

  const handleCancelDelete = () => {
    setIsConfirmingDelete(false);
  };

  return (
    <div className="note-card position-relative">
      <p>{note.content.trim()}</p>
      {!note.indexedInPinecone && <span className="text-warning"> (Not indexed in Pinecone)</span>}
      <div className="note-footer">
        <small className="text-muted">
          {note.createdAt instanceof Date ? note.createdAt.toLocaleString() : 'Invalid Date'}
        </small>
        <button
          className="btn btn-sm btn-link text-danger"
          onClick={handleDeleteClick}
          title="Delete note"
        >
          <Trash2 size={18} />
        </button>
      </div>
      {isConfirmingDelete && (
        <div className="delete-confirmation-overlay">
          <div className="delete-confirmation d-flex align-items-center justify-content-center">
            <span className="me-2">Confirm delete?</span>
            <button
              className="btn btn-sm btn-success me-1"
              onClick={handleConfirmDelete}
              title="Confirm delete"
            >
              <Check size={14} />
            </button>
            <button
              className="btn btn-sm btn-danger"
              onClick={handleCancelDelete}
              title="Cancel delete"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const FullPageNotes = ({ user }) => {
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
      const notesWithValidDates = fetchedNotes.map(note => ({
        ...note,
        createdAt: note.createdAt instanceof Date ? note.createdAt : new Date(note.createdAt.seconds * 1000)
      }));
      setNotes(notesWithValidDates);
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
  
      // Ensure the createdAt field is a Date object
      const noteWithValidDate = {
        ...addedNote,
        createdAt: addedNote.createdAt instanceof Date ? addedNote.createdAt : new Date(addedNote.createdAt.seconds * 1000)
      };
  
      setNotes((prevNotes) => [noteWithValidDate, ...prevNotes]);
      setNewNote('');
  
      if (!noteWithValidDate.indexedInPinecone) {
        setError('Note added, but not indexed in Pinecone. Retrying...');
  
        try {
          await indexContent(user.uid, noteWithValidDate.content, 'note', noteWithValidDate.id);
          setNotes(prevNotes => prevNotes.map(note =>
            note.id === noteWithValidDate.id ? { ...note, indexedInPinecone: true } : note
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

  if (loading) {
    return <div>Loading notes...</div>;
  }

  return (
    <div className="container mt-4">
      <h1>All Notes</h1>
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
      {error && <p className="text-danger">{error}</p>}
      <div className="notes-grid">
        {notes.map((note) => (
          <Note key={note.id} note={note} onDeleteNote={handleDeleteNote} />
        ))}
      </div>
    </div>
  );
};

export default FullPageNotes;
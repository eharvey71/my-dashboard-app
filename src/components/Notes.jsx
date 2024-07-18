import React, { useState, useEffect } from "react";
import { Link } from 'react-router-dom';
import { getNotes, addNote, deleteNote } from "../services/firebaseConfig";
import { indexContent } from "../services/pineconeService";
import { Trash2, Check, X } from 'lucide-react';
import styles from "./Notes.module.css";

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
    <li className={`${styles.listGroupItem} list-group-item position-relative`}>
      <div className={styles.content}>
        {note.content.trim()}
        {!note.indexedInPinecone && <span className={styles.warningText}> (Indexing for AI might be delayed)</span>}
      </div>
      <div className={styles.floatEnd}>
        <small className={`${styles.timestamp} text-muted`}>
          {note.createdAt instanceof Date ? note.createdAt.toLocaleString() : 'Invalid Date'}
        </small>
        <button
          className={`${styles.deleteButton} ${styles.buttonSmall} btn btn-link text-danger ms-2`}
          onClick={handleDeleteClick}
          title="Delete note"
        >
          <Trash2 size={18} />
        </button>
      </div>
      {isConfirmingDelete && (
        <div className={styles.deleteConfirmationOverlay}>
          <div className={`${styles.deleteConfirmation} d-flex align-items-center justify-content-center`}>
            <span className="me-2">Confirm delete?</span>
            <button
              className={`${styles.buttonSmall} btn btn-success me-1`}
              onClick={handleConfirmDelete}
              title="Confirm delete"
            >
              <Check size={14} />
            </button>
            <button
              className={`${styles.buttonSmall} btn btn-danger`}
              onClick={handleCancelDelete}
              title="Cancel delete"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </li>
  );
};

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

  const displayedNotes = limit ? notes.slice(0, limit) : notes;
  const hasMoreNotes = limit && notes.length > limit;

  return (
    <div className="card">
      <div className="card-body">
        <h2 className="card-title">Quick Notes</h2>
        <div className={styles.inputGroup}>
          <textarea
            className={`${styles.formControl} form-control`}
            placeholder="New Note"
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            maxLength={maxChars}
            rows="3"
          />
          <div className={styles.charCounter}>
            {maxChars - newNote.length} characters remaining
          </div>
        </div>
        <button
          className={`${styles.addButton} btn btn-outline-secondary mb-3`}
          onClick={handleAddNote}
        >
          Add Note
        </button>
        <ul className={`${styles.listGroup} list-group`}>
          {displayedNotes.map((note) => (
            <Note key={note.id} note={note} onDeleteNote={handleDeleteNote} />
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
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getNotes, addNote, deleteNote, addDocument } from "../services/firebaseConfig";
import { indexContent } from "../services/pineconeService";
import { Trash2, Check, X, ArrowUpRight } from 'lucide-react';
import styles from './FullPageNotes.module.css';

const Note = ({ note, onDeleteNote, onExpandNote }) => {
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
    <div className={styles.noteCard}>
      <p>{note.content.trim()}</p>
      {!note.indexedInPinecone && <span className={styles.textWarning}> (Indexing for AI might be delayed)</span>}
      <div className={styles.noteFooter}>
        <small className={styles.textMuted}>
          {note.createdAt instanceof Date ? note.createdAt.toLocaleString() : 'Invalid Date'}
        </small>
        <div className={styles.noteActions}>
          <button
            className={`${styles.expandButton} btn btn-sm btn-link`}
            onClick={() => onExpandNote(note)}
            title="Expand to document"
          >
            <ArrowUpRight size={18} />
          </button>
          <button
            className="btn btn-sm btn-link text-danger"
            onClick={handleDeleteClick}
            title="Delete note"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
      {isConfirmingDelete && (
        <div className={styles.deleteConfirmationOverlay}>
          <div className={`${styles.deleteConfirmation} d-flex align-items-center justify-content-center`}>
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
  const { projectId } = useParams();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState("");
  const [error, setError] = useState(null);
  const maxChars = 200;
  const navigate = useNavigate();

  useEffect(() => {
    if (user && projectId) {
      fetchNotes();
    }
  }, [user, projectId]);

  const fetchNotes = async () => {
    try {
      const fetchedNotes = await getNotes(user.uid, projectId);
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
      const addedNote = await addNote(newNote, user.uid, projectId);
  
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

  const handleExpandNote = async (note) => {
    try {
      const title = note.content.substring(0, 50) + (note.content.length > 50 ? "..." : "");
      const newDoc = await addDocument(title, note.content, user.uid, projectId);
      navigate(`/project/${projectId}/documents/${newDoc.id}`, { state: { initialContent: note.content, initialTitle: title } });
    } catch (error) {
      console.error("Error expanding note to document:", error);
      setError("Failed to expand note to document");
    }
  };

  if (loading) {
    return <div>Loading notes...</div>;
  }

  return (
    <div className="container">
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
        <div className={styles.characterCount}>
          {maxChars - newNote.length} characters remaining
        </div>
      </div>
      <button
        className="btn btn-outline-secondary mb-3"
        onClick={handleAddNote}
      >
        Add Note
      </button>
      {error && <p className={styles.textDanger}>{error}</p>}
      <div className={styles.notesGrid}>
        {notes.map((note) => (
          <Note 
            key={note.id} 
            note={note} 
            onDeleteNote={handleDeleteNote} 
            onExpandNote={handleExpandNote}
          />
        ))}
      </div>
    </div>
  );
};

export default FullPageNotes;
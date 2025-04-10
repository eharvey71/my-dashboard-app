import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getNotes, addNote, deleteNote, addDocument } from "../services/firebaseConfig";
import { indexContent } from "../services/pineconeService";
import { Trash2, Check, X, ArrowUpRight, Clipboard } from 'lucide-react';
import moduleStyles from './DashboardModule.module.css';
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
      <p className={styles.noteContent}>{note.content.trim()}</p>
      {!note.indexedInPinecone && <span className={styles.notIndexed}>(Indexing for AI might be delayed)</span>}
      <div className={styles.noteFooter}>
        <small className={styles.noteDate}>
          {note.createdAt instanceof Date ? note.createdAt.toLocaleString() : 'Invalid Date'}
        </small>
        <div className={styles.noteActions}>
          <button
            className={`${moduleStyles.iconButton} ${moduleStyles.editButton}`}
            onClick={() => onExpandNote(note)}
            title="Expand to document"
          >
            <ArrowUpRight size={16} />
          </button>
          <button
            className={`${moduleStyles.iconButton} ${moduleStyles.deleteButton}`}
            onClick={handleDeleteClick}
            title="Delete note"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      {isConfirmingDelete && (
        <div className={moduleStyles.deleteConfirmationOverlay}>
          <div className={moduleStyles.deleteConfirmation}>
            <span>Confirm delete?</span>
            <button
              className={moduleStyles.actionButton}
              style={{ backgroundColor: '#4ade80', color: 'white', padding: '0.25rem 0.5rem', margin: '0 0.25rem' }}
              onClick={handleConfirmDelete}
              title="Yes, delete note"
            >
              <Check size={14} />
            </button>
            <button
              className={moduleStyles.actionButton}
              style={{ backgroundColor: '#f87171', color: 'white', padding: '0.25rem 0.5rem', margin: '0 0.25rem' }}
              onClick={handleCancelDelete}
              title="No, cancel"
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
          await indexContent(user.uid, projectId, noteWithValidDate.content, 'note', noteWithValidDate.id);
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
    return <div className={moduleStyles.loading}>Loading notes...</div>;
  }

  return (
    <div className="container mt-4">
      <div className={moduleStyles.container}>
        <div className={moduleStyles.header}>
          <h2 className={moduleStyles.title}>
            <Clipboard size={20} />
            <span>Quick Notes</span>
          </h2>
        </div>
        
        <div className={moduleStyles.inputGroup} style={{ flexDirection: 'column' }}>
          <textarea
            className={moduleStyles.input}
            placeholder="New Note"
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            maxLength={maxChars}
            rows="3"
            style={{ resize: 'vertical', minHeight: '3rem', marginBottom: '0' }}
          />
          <div className={styles.characterCount}>
            {maxChars - newNote.length} characters remaining
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button
              className={`${moduleStyles.actionButton} ${moduleStyles.primaryButton}`}
              onClick={handleAddNote}
            >
              Add Note
            </button>
          </div>
        </div>
        
        {error && <div className={moduleStyles.error}>{error}</div>}
        
        {notes.length > 0 ? (
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
        ) : (
          <div className={moduleStyles.emptyState}>
            No notes added yet. Add a note above to get started!
          </div>
        )}
      </div>
    </div>
  );
};

export default FullPageNotes;
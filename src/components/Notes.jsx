import React, { useState, useEffect } from "react";
import { Link, useNavigate } from 'react-router-dom';
import { getNotes, addNote, deleteNote, addDocument } from "../services/firebaseConfig";
import { Trash2, Check, X, ArrowUpRight, FileText, Clipboard, Clock } from 'lucide-react';
import styles from "./Notes.module.css";
import moduleStyles from "./DashboardModule.module.css";

const Notes = ({ user, projectId, limit = 5 }) => {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState("");
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
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
        createdAt: note.createdAt instanceof Date ? note.createdAt : 
                   note.createdAt?.seconds ? new Date(note.createdAt.seconds * 1000) : 
                   new Date()
      }));
      const sortedNotes = notesWithValidDates.sort((a, b) => b.createdAt - a.createdAt);
      setNotes(sortedNotes);
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
        createdAt: addedNote.createdAt instanceof Date ? addedNote.createdAt : 
                   addedNote.createdAt?.seconds ? new Date(addedNote.createdAt.seconds * 1000) : 
                   new Date()
      };

      setNotes((prevNotes) => [noteWithValidDate, ...prevNotes]);
      setNewNote('');

      // Indexing is handled by the indexTaskOrNote Firestore trigger.
    } catch (error) {
      console.error("Error adding note:", error);
      setError("Failed to add note");
    }
  };

  const handleDeleteNote = async (id) => {
    try {
      await deleteNote(id);
      setNotes((prevNotes) => prevNotes.filter((note) => note.id !== id));
      setDeletingId(null);
    } catch (error) {
      console.error("Error deleting note:", error);
      setError("Failed to delete note");
    }
  };

  const handleExpandNote = async (note) => {
    try {
      const title = note.content.substring(0, 50) + (note.content.length > 50 ? "..." : "");
      
      // First create the document
      const newDoc = await addDocument(title, note.content, user.uid, projectId);
      
      // Then navigate with state and initialContent explicitly set
      const navigationState = { 
        initialContent: note.content, 
        initialTitle: title,
        createdAt: new Date().toISOString() // Add a timestamp to ensure state is always unique
      };
      
      navigate(`/project/${projectId}/documents/${newDoc.id}`, { 
        state: navigationState,
        replace: true // Use replace to ensure history is clean
      });
    } catch (error) {
      console.error("Error expanding note to document:", error);
      setError("Failed to expand note to document");
    }
  };

  if (loading) {
    return <div className={moduleStyles.loading}>Loading notes...</div>;
  }

  const displayedNotes = limit ? notes.slice(0, limit) : notes;
  const hasMoreNotes = limit && notes.length > limit;

  return (
    <div className={moduleStyles.container}>
      <div className={moduleStyles.header}>
        <h2 className={moduleStyles.title}>
          <Clipboard size={20} />
          <span>Quick Notes</span>
        </h2>
        <Link to={`/project/${projectId}/notes`} className={moduleStyles.viewAllButton}>
          View All Notes
        </Link>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '1rem' }}>
        <textarea
          className={moduleStyles.input}
          placeholder="New Note"
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          maxLength={maxChars}
          rows="3"
          style={{ marginBottom: '0.25rem' }}
        />
        <div className={moduleStyles.charCounter} style={{ alignSelf: 'flex-start', marginBottom: '0.5rem', fontSize: '0.75rem' }}>
          {maxChars - newNote.length} characters remaining
        </div>
        <button
          className={`${moduleStyles.actionButton} ${moduleStyles.primaryButton}`}
          onClick={handleAddNote}
          style={{ alignSelf: 'flex-start', padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
        >
          Add
        </button>
      </div>

      <ul className={moduleStyles.list}>
        {displayedNotes.length > 0 ? (
          displayedNotes.map((note) => (
            <li 
              key={note.id} 
              className={`${moduleStyles.listItem} ${moduleStyles.noteItem}`}
            >
              <div className={moduleStyles.listItemContent} style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                <div style={{ width: '100%' }}>
                  <div>{note.content.trim()}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <span className={moduleStyles.timestamp}>
                        {note.createdAt.toLocaleString()}
                      </span>
                      {!note.embedded && (
                        <small style={{ color: '#f59e0b', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Clock size={12} /> Indexing for AI might be delayed
                        </small>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        className={`${moduleStyles.iconButton} ${moduleStyles.editButton}`}
                        onClick={() => handleExpandNote(note)}
                        title="Expand to document"
                      >
                        <ArrowUpRight size={16} />
                      </button>
                      
                      <button
                        className={`${moduleStyles.iconButton} ${moduleStyles.deleteButton}`}
                        onClick={() => setDeletingId(note.id)}
                        title="Delete note"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              
              {deletingId === note.id && (
                <div className={moduleStyles.deleteConfirmationOverlay}>
                  <div className={moduleStyles.deleteConfirmation}>
                    <span>Confirm delete?</span>
                    <button
                      className={`${moduleStyles.iconButton} ${moduleStyles.primaryButton}`}
                      onClick={() => handleDeleteNote(note.id)}
                      title="Confirm delete"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      className={`${moduleStyles.iconButton} ${moduleStyles.dangerButton}`}
                      onClick={() => setDeletingId(null)}
                      title="Cancel delete"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))
        ) : (
          <div className={moduleStyles.emptyState}>
            No notes yet. Add one above!
          </div>
        )}
      </ul>
      
      {error && <p className={moduleStyles.error}>{error}</p>}
    </div>
  );
};

export default Notes;
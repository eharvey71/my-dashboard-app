import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getNotes, addDocument } from '../services/firebaseConfig';
import { X, FileText } from 'lucide-react';
import styles from './QuickNoteSelector.module.css';

const QuickNoteSelector = ({ user, projectId, onClose }) => {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
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

    fetchNotes();
  }, [user, projectId]);

  const handleCreateDocument = async (note) => {
    try {
      console.log('Creating document from note with content:', note.content); // Debug log
      const title = note.content.substring(0, 50) + (note.content.length > 50 ? "..." : "");
      
      // First create the document
      const newDoc = await addDocument(title, note.content, user.uid, projectId);
      
      // Then navigate with state and initialContent explicitly set
      const navigationState = { 
        initialContent: note.content, 
        initialTitle: title,
        createdAt: new Date().toISOString() // Add a timestamp to ensure state is always unique
      };
      
      console.log('Navigating with state:', navigationState); // Debug log
      navigate(`/project/${projectId}/documents/${newDoc.id}`, { 
        state: navigationState,
        replace: true // Use replace to ensure history is clean
      });
      
      if (onClose) onClose();
    } catch (error) {
      console.error("Error creating document from note:", error);
      setError("Failed to create document from note");
    }
  };

  if (loading) {
    return (
      <div className={styles.modal}>
        <div className={styles.modalContent}>
          <div className={styles.modalHeader}>
            <h5>Loading notes...</h5>
            <button className={styles.closeButton} onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.modal}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h5>Select a Quick Note</h5>
          <button className={styles.closeButton} onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className={styles.modalBody}>
          {error && <p className="text-danger">{error}</p>}
          {notes.length === 0 ? (
            <p className="text-center text-muted">No notes found. Create a quick note first.</p>
          ) : (
            <ul className={styles.notesList}>
              {notes.map((note) => (
                <li 
                  key={note.id} 
                  className={styles.noteItem}
                  onClick={() => handleCreateDocument(note)}
                >
                  <FileText size={16} className={styles.noteIcon} />
                  <div className={styles.noteContent}>
                    <p className={styles.noteText}>{note.content}</p>
                    <small className={styles.noteDate}>
                      {note.createdAt.toLocaleDateString()} - {note.createdAt.toLocaleTimeString()}
                    </small>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuickNoteSelector;
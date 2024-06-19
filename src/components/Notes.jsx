import React, { useState, useEffect } from 'react';
import { getNotes, addNote, deleteNote } from '../services/firebaseConfig';
import './Notes.css';

const Notes = ({ user }) => {
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [charCount, setCharCount] = useState(0);

  useEffect(() => {
    if (user) {
      const fetchNotes = async () => {
        try {
          const notes = await getNotes(user.uid);
          setNotes(notes);
          setLoading(false);
        } catch (error) {
          console.error("Error fetching notes:", error);
          setLoading(false);
        }
      };

      fetchNotes();
    }
  }, [user]);

  const handleAddNote = async () => {
    if (newNote.trim() === '' || newNote.length > 200) return;
    try {
      await addNote(newNote, user.uid);
      const notes = await getNotes(user.uid);
      setNotes(notes);
      setNewNote('');
      setCharCount(0);
    } catch (error) {
      console.error("Error adding note:", error);
    }
  };

  const handleDeleteNote = async (id) => {
    try {
      await deleteNote(id);
      const notes = await getNotes(user.uid);
      setNotes(notes);
    } catch (error) {
      console.error("Error deleting note:", error);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="notes-container">
      <h2>Notes</h2>
      <div className="notes-input-group mb-3">
        <textarea
          className="notes-form-control"
          placeholder="New Note"
          value={newNote}
          onChange={(e) => {
            setNewNote(e.target.value);
            setCharCount(e.target.value.length);
          }}
          maxLength="200"
        />
        <div className="notes-char-counter">{200 - charCount} characters remaining</div>
        <button className="btn btn-sm btn-outline-secondary notes-add-button" onClick={handleAddNote}>Add Note</button>
      </div>
      <ul className="notes-list-group">
        {notes.sort((a, b) => b.createdAt.seconds - a.createdAt.seconds).map(note => (
          <li key={note.id} className="notes-list-group-item">
            <div className="notes-content">
              <p>{note.content}</p>
              <small>{new Date(note.createdAt.seconds * 1000).toLocaleString()}</small>
            </div>
            <button className="btn btn-sm btn-outline-danger" onClick={() => handleDeleteNote(note.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Notes;

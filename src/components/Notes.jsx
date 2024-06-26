import React, { useState, useEffect } from 'react';
import { getNotes, addNote, deleteNote } from '../services/firebaseConfig';
import { indexContent } from '../services/pineconeService';
import './Notes.css';

const Notes = ({ user }) => {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState('');
  const [error, setError] = useState(null);
  const maxChars = 200;

  useEffect(() => {
    if (user) {
      const fetchNotes = async () => {
        try {
          const notes = await getNotes(user.uid);
          setNotes(notes);
          setLoading(false);

          // Index existing notes in Pinecone
          notes.forEach(note => {
            indexContent(user.uid, note.content, 'note');
          });
        } catch (error) {
          console.error("Error fetching notes:", error);
          setLoading(false);
        }
      };

      fetchNotes();
    }
  }, [user]);

  const handleAddNote = async () => {
    if (newNote.trim() === '') return;
    try {
      await addNote(newNote, user.uid);
      const notes = await getNotes(user.uid);
      setNotes(notes);
      setNewNote('');

      // Index the new note in Pinecone
      indexContent(user.uid, newNote, 'note');
    } catch (error) {
      console.error("Error adding note:", error);
      setError('Failed to add note');
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

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp.seconds * 1000);
    return date.toLocaleString();
  };

  if (loading) {
    return <div>Loading notes...</div>;
  }

  return (
    <div className="card">
      <div className="card-body">
        <h2 className="card-title">Notes</h2>
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
        <button className="btn btn-outline-secondary mb-3" onClick={handleAddNote}>Add Note</button>
        <ul className="list-group">
          {notes.map((note) => (
            <li key={note.id} className="list-group-item">
              <span>{note.content}</span>
              <div className="float-end">
                <small className="text-muted">{formatTimestamp(note.createdAt)}</small>
                <button className="btn btn-sm btn-outline-danger ms-2" onClick={() => handleDeleteNote(note.id)}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
        {error && <p className="text-danger">{error}</p>}
      </div>
    </div>
  );
};

export default Notes;

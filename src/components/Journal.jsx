import React, { useState, useEffect } from 'react';
import { getJournalEntries } from '../services/firebaseConfig';

const Journal = () => {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEntries = async () => {
      try {
        const entries = await getJournalEntries();
        setEntries(entries);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching journal entries:", error);
        setLoading(false);
      }
    };

    fetchEntries();
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container">
      <h2>Journal</h2>
      <ul className="list-group">
        {entries.map(entry => (
          <li key={entry.id} className="list-group-item">
            {entry.content}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Journal;

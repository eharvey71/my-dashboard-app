import React from 'react';
import Notes from './Notes';

const FullPageNotes = ({ user }) => {
  return (
    <div className="container mt-4">
      <h1>All Notes</h1>
      <Notes user={user} />
    </div>
  );
};

export default FullPageNotes;
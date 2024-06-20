import React, { useState } from 'react';
import TaskList from './TaskList';
import Notes from './Notes';
import Bookmark from './Bookmark';
import BookmarkList from './BookmarkList';

const Dashboard = ({ user }) => {
  const [bookmarks, setBookmarks] = useState([]);

  return (
    <div className="container">
      <div className="row">
        <div className="col-md-6 mb-4">
          <TaskList user={user} />
        </div>
        <div className="col-md-6 mb-4">
          <Notes user={user} />
        </div>
        <div className="col-md-6 mb-4">
          <Bookmark user={user} setBookmarks={setBookmarks} /> {/* Pass setBookmarks */}
        </div>
        <div className="col-md-6 mb-4">
          <BookmarkList user={user} bookmarks={bookmarks} setBookmarks={setBookmarks} /> {/* Pass bookmarks and setBookmarks */}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

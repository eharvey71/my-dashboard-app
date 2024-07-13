import React, { useState } from 'react';
import TaskList from './TaskList';
import Notes from './Notes';
import Bookmark from './Bookmark';
import BookmarkList from './BookmarkList';
import AIAssistant from './AIAssistant';

const Dashboard = ({ user }) => {
  const [bookmarks, setBookmarks] = useState([]);

  return (
    <div className="container">
      <div className="row">
        <div className="col-md-6 mb-4">
          <TaskList user={user} />
        </div>
        <div className="col-md-6 mb-4">
          <Notes user={user} limit={5} />
        </div>
        <div className="col-md-6 mb-4">
          <Bookmark user={user} setBookmarks={setBookmarks} />
        </div>
        <div className="col-md-6 mb-4">
          <BookmarkList user={user} bookmarks={bookmarks} setBookmarks={setBookmarks} limit={5} />
        </div>
        <div className="col-md-12 mb-4">
          <AIAssistant user={user} />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
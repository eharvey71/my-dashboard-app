import React, { useState } from 'react';
import TaskList from './TaskList';
import Notes from './Notes';
import BookmarkList from './BookmarkList';
import AIAssistant from './AIAssistant';
import CustomAPIModule from './CustomAPIModule';
import DocumentListPreview from './DocumentListPreview';

const Dashboard = ({ user }) => {
  const [bookmarks, setBookmarks] = useState([]);

  return (
    <div className="container">
      <div className="row">
        {/* Left Column */}
        <div className="col-md-6">
          <div className="mb-4">
            <TaskList user={user} />
          </div>
          <div className="mb-4">
            <Notes user={user} limit={5} />
          </div>
        </div>

        {/* Right Column */}
        <div className="col-md-6">
          <div className="mb-4">
            <DocumentListPreview user={user} limit={5} />
          </div>
          <div className="mb-4">
            <BookmarkList 
              user={user} 
              bookmarks={bookmarks} 
              setBookmarks={setBookmarks} 
              limit={5} 
              showAddBookmark={true} 
            />
          </div>
          <div className="mb-4">
            <AIAssistant user={user} />
          </div>
          <div className="mb-4">
            <CustomAPIModule />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
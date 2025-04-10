import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { setLastAccessedProject } from '../services/firebaseConfig';
import TaskList from './TaskList';
import Notes from './Notes';
import BookmarkList from './BookmarkList';
import FocusMetrics from './FocusMetrics';
// These components are temporarily removed from the dashboard but code is retained
// import AIAssistant from './AIAssistant';
// import CustomAPIModule from './CustomAPIModule';
import DocumentListPreview from './DocumentListPreview';
import SynapseListPreview from './SynapseListPreview';
import { openGoogleDriveDocument } from '../services/googleDriveService';

const Dashboard = ({ user }) => {
  const { projectId } = useParams();

  useEffect(() => {
    if (user && projectId) {
      setLastAccessedProject(user.uid, projectId);
    }
  }, [user, projectId]);

  const [bookmarks, setBookmarks] = useState([]);

  if (!projectId) {
    return <div>Error: No project selected</div>;
  }

  const handleDocumentClick = (document) => {
    if (document.source === 'Google Drive' && document.originalId) {
      openGoogleDriveDocument(document.originalId);
    } else {
      // Handle native document opening (you might want to use React Router here)
      window.location.href = `/project/${projectId}/documents/${document.id}`;
    }
  };

  return (
    <div className="container">
      <div className="row">
        {/* Left Column */}
        <div className="col-md-6">
          <div className="mb-4">
            <TaskList user={user} projectId={projectId} />
          </div>
          <div className="mb-4">
            <Notes user={user} projectId={projectId} limit={5} />
          </div>
          <div className="mb-4">
            <FocusMetrics user={user} projectId={projectId} limit={3} />
          </div>
        </div>

        {/* Right Column */}
        <div className="col-md-6">
          <div className="mb-4">
            <DocumentListPreview 
              user={user} 
              projectId={projectId} 
              limit={5} 
              onDocumentClick={handleDocumentClick}
            />
          </div>
          <div className="mb-4">
            <BookmarkList 
              user={user} 
              projectId={projectId}
              bookmarks={bookmarks} 
              setBookmarks={setBookmarks} 
              limit={5} 
              showAddBookmark={true} 
            />
          </div>
          <div className="mb-4">
            <SynapseListPreview
              user={user}
              projectId={projectId}
              limit={3}
            />
          </div>
          {/* AIAssistant and CustomAPIModule removed from the dashboard but code retained */}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
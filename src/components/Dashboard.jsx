import React, { useState } from 'react';
import TaskList from './TaskList';
import Notes from './Notes';
import Bookmark from './Bookmark';
import BookmarkList from './BookmarkList';
import { analyzeContent } from '../services/aiService';
import { queryPinecone } from '../services/pineconeService';

const Dashboard = ({ user }) => {
  const [bookmarks, setBookmarks] = useState([]);
  const [input, setInput] = useState('');
  const [response, setResponse] = useState('');

  const handleAnalyze = async () => {
    const userContent = await queryPinecone(user.uid);
    const prompt = `${userContent}\n\nUser: ${input}\nAssistant:`;
    const aiResponse = await analyzeContent(prompt);
    setResponse(aiResponse);
  };

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
        <div className="col-md-12 mb-4">
          <h3>AI Assistant</h3>
          <textarea
            className="form-control mb-3"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask the AI for advice about your tasks and notes..."
          />
          <button className="btn btn-outline-secondary mb-3" onClick={handleAnalyze}>Ask GPT</button>
          <div>
            <h4>Response</h4>
            <p>{response}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

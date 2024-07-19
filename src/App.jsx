import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import NavBar from './components/NavBar';
import Signup from './components/Signup';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import FullPageNotes from './components/FullPageNotes';
import FullPageTasks from './components/FullPageTasks';
import FullPageBookmarks from './components/FullPageBookmarks';
import FocusTimer from './components/FocusTimer';
import { auth, onAuthStateChanged, db } from './services/firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';

const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setDisplayName(userDoc.data().displayName || '');
        }
      } else {
        setDisplayName('');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <Router>
      <NavBar user={user} displayName={displayName} />
      <div className="main-container">
        <Routes>
          <Route path="/" element={user ? <Dashboard user={user} /> : <Navigate to="/login" />} />
          <Route path="/signup" element={user ? <Navigate to="/" /> : <Signup />} />
          <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
          <Route 
            path="/notes" 
            element={user ? <FullPageNotes user={user} /> : <Navigate to="/login" />} 
          />
          <Route 
            path="/tasks" 
            element={user ? <FullPageTasks user={user} /> : <Navigate to="/login" />} 
          />
          <Route 
            path="/bookmarks" 
            element={user ? <FullPageBookmarks user={user} /> : <Navigate to="/login" />} 
          />
          <Route 
            path="/focus-timer" 
            element={user ? <FocusTimer user={user} /> : <Navigate to="/login" />} 
          />
        </Routes>
      </div>
    </Router>
  );
};

export default App;
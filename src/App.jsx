import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import TaskList from './components/TaskList';
import Notes from './components/Notes';
import NavBar from './components/NavBar';
import Signup from './components/Signup';
import Login from './components/Login';
import { auth, onAuthStateChanged } from './services/firebaseConfig';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <Router>
      <NavBar />
      <div className="container mt-5">
        <Routes>
          <Route path="/" element={user ? <Dashboard user={user} /> : <Navigate to="/login" />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/login" element={<Login />} />
        </Routes>
      </div>
    </Router>
  );
}

const Dashboard = ({ user }) => (
  <div className="row">
    <div className="col-md-6">
      <TaskList user={user} />
    </div>
    <div className="col-md-6">
      <Notes user={user} />
    </div>
  </div>
);

export default App;

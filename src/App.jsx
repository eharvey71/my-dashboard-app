import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ProjectProvider } from './contexts/ProjectContext';
import NavBar from './components/NavBar';
import Signup from './components/Signup';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import EmailVerification from './components/EmailVerification';
import FullPageNotes from './components/FullPageNotes';
import FullPageTasks from './components/FullPageTasks';
import FullPageBookmarks from './components/FullPageBookmarks';
import DocumentEditor from './components/DocumentEditor';
import DocumentList from './components/DocumentList';
import FocusTimer from './components/FocusTimer';
import ProjectList from './components/ProjectList';
import { db } from './services/firebaseConfig';
import { auth, onAuthStateChanged } from './services/firebaseAuth';
import { doc, getDoc } from 'firebase/firestore';
import { getUserProjects, getLastAccessedProject } from './services/firebaseConfig';

const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [hasProjects, setHasProjects] = useState(false);
  const [lastAccessedProject, setLastAccessedProject] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setDisplayName(userDoc.data().displayName || '');
        }
        if (!user.emailVerified) {
          setUser(null);
        } else {
          setUser(user);
          const projects = await getUserProjects(user.uid);
          setHasProjects(projects.length > 0);
          if (projects.length > 0) {
            const lastProject = await getLastAccessedProject(user.uid);
            setLastAccessedProject(lastProject);
          }
        }
      } else {
        setUser(null);
        setDisplayName('');
        setHasProjects(false);
        setLastAccessedProject(null);
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
      <ProjectProvider user={user}>
        <NavBar user={user} displayName={displayName} />
        <div className="main-container">
          <Routes>
            <Route path="/" element={
              user ? (
                hasProjects ? (
                  lastAccessedProject ? (
                    <Navigate to={`/project/${lastAccessedProject}`} />
                  ) : (
                    <Navigate to="/projects" />
                  )
                ) : (
                  <Navigate to="/projects" />
                )
              ) : (
                <Navigate to="/login" />
              )
            } />
            <Route path="/projects" element={
              user ? <ProjectList user={user} onProjectsUpdate={(projects) => setHasProjects(projects.length > 0)} /> : <Navigate to="/login" />
            } />
            <Route path="/signup" element={user ? <Navigate to="/" /> : <Signup />} />
            <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
            <Route path="/email-verification" element={<EmailVerification />} />
            <Route 
              path="/project/:projectId" 
              element={user ? <Dashboard user={user} /> : <Navigate to="/login" />} 
            />
            <Route 
              path="/project/:projectId/notes" 
              element={user ? <FullPageNotes user={user} /> : <Navigate to="/login" />} 
            />
            <Route 
              path="/project/:projectId/tasks" 
              element={user ? <FullPageTasks user={user} /> : <Navigate to="/login" />} 
            />
            <Route 
              path="/project/:projectId/bookmarks" 
              element={user ? <FullPageBookmarks user={user} /> : <Navigate to="/login" />} 
            />
            <Route 
              path="/project/:projectId/documents" 
              element={user ? <DocumentList user={user} /> : <Navigate to="/login" />} 
            />
            <Route 
              path="/project/:projectId/documents/new" 
              element={user ? <DocumentEditor user={user} /> : <Navigate to="/login" />} 
            />
            <Route 
              path="/project/:projectId/documents/:id" 
              element={user ? <DocumentEditor user={user} /> : <Navigate to="/login" />} 
            />
            <Route 
              path="/project/:projectId/focus" 
              element={user ? <FocusTimer user={user} /> : <Navigate to="/login" />} 
            />
          </Routes>
        </div>
      </ProjectProvider>
    </Router>
  );
};

export default App;
import React, { useEffect, useState, useCallback } from 'react';
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
import FullPageAIAssistant from './components/FullPageAIAssistant'; 
import DocumentEditor from './components/DocumentEditor';
import DocumentList from './components/DocumentList';
import FocusTimer from './components/FocusTimer';
import ProjectList from './components/ProjectList';
import { db } from './services/firebaseConfig';
import { auth, onAuthStateChanged } from './services/firebaseAuth';
import { doc, getDoc } from 'firebase/firestore';
import { getUserProjects, getLastAccessedProject } from './services/firebaseConfig';

const initialState = {
  user: null,
  displayName: '',
  hasProjects: false,
  lastAccessedProject: null,
  loading: true,
  initialized: false
};

const App = () => {
  const [state, setState] = useState(initialState);

  const initializeUserData = useCallback(async (user) => {
    if (user) {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const displayName = userDoc.exists() ? (userDoc.data().displayName || 'My Cognify') : '';
      
      const projects = await getUserProjects(user.uid);
      console.log('User projects:', projects);
      
      const hasProjects = projects.length > 0;
      
      let lastAccessedProject = null;
      if (hasProjects) {
        lastAccessedProject = await getLastAccessedProject(user.uid);
        console.log('Last accessed project:', lastAccessedProject);
        lastAccessedProject = lastAccessedProject || projects[0].id;
      }

      setState(prevState => ({
        ...prevState,
        user,
        displayName,
        hasProjects,
        lastAccessedProject,
        loading: false,
        initialized: true
      }));
    } else {
      setState({
        ...initialState,
        loading: false,
        initialized: true
      });
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('Auth state changed. User:', user);
      setState(prevState => ({ ...prevState, user, loading: true }));
      await initializeUserData(user);
    });

    return () => unsubscribe();
  }, [initializeUserData]);

  useEffect(() => {
    console.log('State updated:', state);
  }, [state]);

  if (state.loading) {
    console.log('App is loading');
    return <div>Loading...</div>;
  }

  console.log('Rendering App component');

  const getRedirectPath = () => {
    if (!state.user) return '/login';
    if (!state.hasProjects) return '/projects';
    if (state.lastAccessedProject) return `/project/${state.lastAccessedProject}`;
    return '/projects';
  };

  return (
    <Router>
      <ProjectProvider user={state.user}>
        <NavBar user={state.user} displayName={state.displayName} />
        <div className="main-container">
          <Routes>
            <Route 
              path="/" 
              element={
                state.initialized ? (
                  <Navigate to={getRedirectPath()} />
                ) : (
                  <div>Initializing...</div>
                )
              } 
            />
            <Route path="/projects" element={
              state.user ? <ProjectList user={state.user} onProjectsUpdate={(projects) => setState(prev => ({ ...prev, hasProjects: projects.length > 0 }))} /> : <Navigate to="/login" />
            } />
            <Route path="/signup" element={state.user ? <Navigate to="/" /> : <Signup />} />
            <Route path="/login" element={state.user ? <Navigate to="/" /> : <Login />} />
            <Route path="/email-verification" element={<EmailVerification />} />
            <Route 
              path="/project/:projectId" 
              element={state.user ? <Dashboard user={state.user} /> : <Navigate to="/login" />} 
            />
            <Route 
              path="/project/:projectId/notes" 
              element={state.user ? <FullPageNotes user={state.user} /> : <Navigate to="/login" />} 
            />
            <Route 
              path="/project/:projectId/tasks" 
              element={state.user ? <FullPageTasks user={state.user} /> : <Navigate to="/login" />} 
            />
            <Route 
              path="/project/:projectId/bookmarks" 
              element={state.user ? <FullPageBookmarks user={state.user} /> : <Navigate to="/login" />} 
            />
            <Route 
              path="/project/:projectId/documents" 
              element={state.user ? <DocumentList user={state.user} /> : <Navigate to="/login" />} 
            />
            <Route 
              path="/project/:projectId/ai-assistant" 
              element={state.user ? <FullPageAIAssistant user={state.user} /> : <Navigate to="/login" />} 
            />
            <Route 
              path="/project/:projectId/documents/new" 
              element={state.user ? <DocumentEditor user={state.user} /> : <Navigate to="/login" />} 
            />
            <Route 
              path="/project/:projectId/documents/:id" 
              element={state.user ? <DocumentEditor user={state.user} /> : <Navigate to="/login" />} 
            />
            <Route 
              path="/project/:projectId/focus" 
              element={state.user ? <FocusTimer user={state.user} /> : <Navigate to="/login" />} 
            />
          </Routes>
        </div>
      </ProjectProvider>
    </Router>
  );
};

export default App;
import React, { useEffect, useState, useCallback, createContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ProjectProvider } from './contexts/ProjectContext';
import { initializeGoogleDriveApi } from './services/googleDriveService';
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

export const AppContext = createContext();

const initialState = {
  user: null,
  displayName: '',
  hasProjects: false,
  lastAccessedProject: null,
  loading: true,
  initialized: false,
  googleDriveSignedIn: false,
  googleDriveInitialized: false,
  authInProgress: false  // New state to track auth state changes
};

const App = () => {
  const [state, setState] = useState(initialState);

  const initializeUserData = useCallback(async (user) => {
    if (user) {
      try {
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
          initialized: true,
          authInProgress: false
        }));
      } catch (error) {
        console.error('Error initializing user data:', error);
        setState(prevState => ({
          ...prevState,
          loading: false,
          initialized: true,
          authInProgress: false
        }));
      }
    } else {
      setState(prevState => ({
        ...initialState,
        loading: false,
        initialized: true,
        googleDriveInitialized: prevState.googleDriveInitialized,
        authInProgress: false
      }));
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('Auth state changed. User:', user);
      setState(prevState => ({ 
        ...prevState, 
        user, 
        loading: true,
        authInProgress: true 
      }));
      await initializeUserData(user);
    });

    return () => {
      unsubscribe();
    };
  }, [initializeUserData]);

  useEffect(() => {
    const initGoogleDrive = async () => {
      try {
        await initializeGoogleDriveApi();
        setState(prevState => ({ ...prevState, googleDriveInitialized: true }));
      } catch (error) {
        console.error('Failed to initialize Google Drive API:', error);
        setState(prevState => ({ ...prevState, googleDriveInitialized: true }));
      }
    };

    initGoogleDrive();
  }, []);

  useEffect(() => {
    console.log('State updated:', state);
  }, [state]);

  if (state.loading || !state.googleDriveInitialized) {
    console.log('App is loading');
    return <div>Loading...</div>;
  }

  const getRedirectPath = () => {
    if (!state.user) return '/login';
    if (!state.hasProjects) return '/projects';
    if (state.lastAccessedProject) return `/project/${state.lastAccessedProject}`;
    return '/projects';
  };

  const setGoogleDriveSignedIn = useCallback((signedIn) => {
    setState(prevState => ({ ...prevState, googleDriveSignedIn: signedIn }));
  }, []);

  // Don't render routes until authentication state is settled
  if (state.authInProgress) {
    return <div>Loading...</div>;
  }

  return (
    <Router>
      <AppContext.Provider value={{
        googleDriveSignedIn: state.googleDriveSignedIn,
        setGoogleDriveSignedIn,
        isInitialized: state.initialized,
        user: state.user
      }}>
        <ProjectProvider user={state.user}>
          <NavBar user={state.user} displayName={state.displayName} />
          <div className="main-container">
            <Routes>
              <Route 
                path="/" 
                element={
                  state.initialized ? (
                    <Navigate to={getRedirectPath()} replace />
                  ) : (
                    <div>Initializing...</div>
                  )
                } 
              />
              <Route path="/projects" element={
                state.user ? (
                  <ProjectList 
                    user={state.user} 
                    onProjectsUpdate={(projects) => 
                      setState(prev => ({ ...prev, hasProjects: projects.length > 0 }))
                    } 
                  />
                ) : (
                  <Navigate to="/login" replace />
                )
              } />
              <Route path="/signup" element={state.user ? <Navigate to="/" replace /> : <Signup />} />
              <Route path="/login" element={state.user ? <Navigate to="/" replace /> : <Login />} />
              <Route path="/email-verification" element={<EmailVerification />} />
              <Route 
                path="/project/:projectId" 
                element={state.user ? <Dashboard user={state.user} /> : <Navigate to="/login" replace />} 
              />
              <Route 
                path="/project/:projectId/notes" 
                element={state.user ? <FullPageNotes user={state.user} /> : <Navigate to="/login" replace />} 
              />
              <Route 
                path="/project/:projectId/tasks" 
                element={state.user ? <FullPageTasks user={state.user} /> : <Navigate to="/login" replace />} 
              />
              <Route 
                path="/project/:projectId/bookmarks" 
                element={state.user ? <FullPageBookmarks user={state.user} /> : <Navigate to="/login" replace />} 
              />
              <Route 
                path="/project/:projectId/documents" 
                element={state.user ? <DocumentList user={state.user} /> : <Navigate to="/login" replace />} 
              />
              <Route 
                path="/project/:projectId/ai-assistant" 
                element={state.user ? <FullPageAIAssistant user={state.user} /> : <Navigate to="/login" replace />} 
              />
              <Route 
                path="/project/:projectId/documents/new" 
                element={state.user ? <DocumentEditor user={state.user} /> : <Navigate to="/login" replace />} 
              />
              <Route 
                path="/project/:projectId/documents/:id" 
                element={state.user ? <DocumentEditor user={state.user} /> : <Navigate to="/login" replace />} 
              />
              <Route 
                path="/project/:projectId/focus" 
                element={state.user ? <FocusTimer user={state.user} /> : <Navigate to="/login" replace />} 
              />
            </Routes>
          </div>
        </ProjectProvider>
      </AppContext.Provider>
    </Router>
  );
};

export default App;
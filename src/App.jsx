import React, { useEffect, useState, useCallback, createContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ProjectProvider } from './contexts/ProjectContext';
import { initializeGoogleDriveApi } from './services/googleDriveService';
import NavBar from './components/NavBar';
//import Signup from './components/Signup';
//import Login from './components/Login';
import EmailLinkHandler from './components/EmailLinkHandler';
import SetupProfile from './components/SetupProfile';
import Dashboard from './components/Dashboard';
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
import AuthEntry from './components/AuthEntry';

export const AppContext = createContext();

const initialState = {
  user: null,
  displayName: '',
  hasProjects: false,
  lastAccessedProject: null,
  loading: true,
  initialized: false,
  googleDriveSignedIn: false,
  googleDriveInitialized: false
};

const App = () => {
  const [state, setState] = useState(initialState);

  const setGoogleDriveSignedIn = useCallback((signedIn) => {
    setState(prevState => ({ ...prevState, googleDriveSignedIn: signedIn }));
  }, []);

  const initializeUserData = useCallback(async (user) => {
    if (user) {
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const userData = userDoc.exists() ? userDoc.data() : {};
        const displayName = userData.displayName || '';
        const displayNameSet = userData.displayNameSet || false;
        
        const projects = await getUserProjects(user.uid);
        const hasProjects = projects.length > 0;
        
        let lastAccessedProject = null;
        if (hasProjects) {
          lastAccessedProject = await getLastAccessedProject(user.uid);
          lastAccessedProject = lastAccessedProject || projects[0].id;
        }

        setState(prevState => ({
          ...prevState,
          user,
          displayName,
          displayNameSet,
          hasProjects,
          lastAccessedProject,
          loading: false,
          initialized: true
        }));

        // Redirect to profile setup if display name not set
        if (user && !displayNameSet && window.location.pathname !== '/setup-profile') {
          window.location.href = '/setup-profile';
        }
      } catch (error) {
        console.error('Error initializing user data:', error);
        setState(prevState => ({
          ...prevState,
          loading: false,
          initialized: true
        }));
      }
    } else {
      setState(prevState => ({
        ...initialState,
        loading: false,
        initialized: true,
        googleDriveInitialized: prevState.googleDriveInitialized
      }));
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('Auth state changed. User:', user);
      setState(prevState => ({ ...prevState, loading: true }));
      await initializeUserData(user);
    });

    return () => unsubscribe();
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

  const getRedirectPath = () => {
    if (!state.user) return '/login';
    if (!state.displayNameSet) return '/setup-profile';
    if (!state.hasProjects) return '/projects';
    if (state.lastAccessedProject) return `/project/${state.lastAccessedProject}`;
    return '/projects';
  };

  if (state.loading || !state.googleDriveInitialized) {
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
              <Route path="/login" element={state.user ? <Navigate to="/" replace /> : <AuthEntry />} />
              <Route path="/auth/email-link" element={<EmailLinkHandler />} />
              <Route path="/setup-profile" element={<SetupProfile />} />
              
              {/* Protected Routes */}
              {state.user && state.displayNameSet ? (
                <>
                  <Route path="/projects" element={<ProjectList user={state.user} onProjectsUpdate={(projects) => setState(prev => ({ ...prev, hasProjects: projects.length > 0 }))} />} />
                  <Route path="/project/:projectId" element={<Dashboard user={state.user} />} />
                  <Route path="/project/:projectId/notes" element={<FullPageNotes user={state.user} />} />
                  <Route path="/project/:projectId/tasks" element={<FullPageTasks user={state.user} />} />
                  <Route path="/project/:projectId/bookmarks" element={<FullPageBookmarks user={state.user} />} />
                  <Route path="/project/:projectId/documents" element={<DocumentList user={state.user} />} />
                  <Route path="/project/:projectId/ai-assistant" element={<FullPageAIAssistant user={state.user} />} />
                  <Route path="/project/:projectId/documents/new" element={<DocumentEditor user={state.user} />} />
                  <Route path="/project/:projectId/documents/:id" element={<DocumentEditor user={state.user} />} />
                  <Route path="/project/:projectId/focus" element={<FocusTimer user={state.user} />} />
                </>
              ) : null}
            </Routes>
          </div>
        </ProjectProvider>
      </AppContext.Provider>
    </Router>
  );
};

export default App;
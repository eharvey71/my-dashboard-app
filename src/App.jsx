import React, { useEffect, useState, useCallback, createContext, Suspense } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { ProjectProvider } from "./contexts/ProjectContext";
import TimerProviderWithOverlay from "./components/TimerProviderWithOverlay";
import NavBar from "./components/NavBar";
// Route components are loaded on demand. The Suspense boundaries below have
// always been here; until these imports became dynamic there was simply never
// anything pending for them to catch, and every route shipped in the initial
// bundle whether or not it was ever visited.
import {
  EmailLinkHandler,
  SetupProfile,
  Dashboard,
  FullPageNotes,
  FullPageTasks,
  FullPageBookmarks,
  FullPageAIAssistant,
  DocumentEditor,
  DocumentList,
  FocusTimer,
  ProjectList,
  Synapse,
  AuthEntry,
  UserAccount,
} from "./lazyComponents";
import { db } from "./services/firebaseConfig";
import { auth, onAuthStateChanged } from "./services/firebaseAuth";
import { doc, getDoc } from "firebase/firestore";
import { getUserProjects } from "./services/firebaseConfig";
import LoadingComponent from "./components/LoadingComponent";
import ErrorBoundary from "./components/ErrorBoundary";

export const AppContext = createContext();

const initialState = {
  user: null,
  hasProjects: false,
  lastAccessedProject: null,
  loading: true,
  initialized: false,
  googleDriveSignedIn: false,
  displayNameSet: false,
};

const App = () => {
  const [state, setState] = useState(initialState);

  const setGoogleDriveSignedIn = useCallback((signedIn) => {
    setState((prevState) => ({ ...prevState, googleDriveSignedIn: signedIn }));
  }, []);

  const initializeUserData = useCallback(async (user) => {
    if (user) {
      try {
        // Independent reads - issue them together rather than in series.
        const [userDoc, projects] = await Promise.all([
          getDoc(doc(db, "users", user.uid)),
          getUserProjects(user.uid),
        ]);

        const userData = userDoc.exists() ? userDoc.data() : {};
        const displayNameSet = userData.displayNameSet || false;
        const hasProjects = projects.length > 0;

        // lastAccessedProject lives on the user document already fetched above.
        // This used to be a third round trip that re-read the same document.
        const lastAccessedProject = hasProjects
          ? userData.lastAccessedProject || projects[0].id
          : null;

        setState((prevState) => ({
          ...prevState,
          user: {
            ...user,
            city: userData.city,
            timezone: userData.timezone,
            unit: userData.unit || "imperial",
          },
          displayNameSet,
          hasProjects,
          lastAccessedProject,
          loading: false,
          initialized: true,
        }));
      } catch (error) {
        console.error("Error initializing user data:", error);
        setState((prevState) => ({
          ...prevState,
          loading: false,
          initialized: true,
        }));
      }
    } else {
      setState({
        ...initialState,
        loading: false,
        initialized: true,
      });
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log("Auth state changed. User:", user);
      setState((prevState) => ({ ...prevState, loading: true }));
      await initializeUserData(user);
    });

    return () => unsubscribe();
  }, [initializeUserData]);

  const getRedirectPath = () => {
    if (!state.user) return "/login";
    if (!state.displayNameSet) return "/setup-profile";
    if (!state.hasProjects) return "/projects";
    if (state.lastAccessedProject)
      return `/project/${state.lastAccessedProject}`;
    return "/projects";
  };

  if (state.loading) {
    // Use LoadingComponent with fullHeight for better mobile experience
    return <React.Suspense fallback={<div>Loading...</div>}>
      <LoadingComponent message="Loading application..." fullHeight={true} />
    </React.Suspense>;
  }

  return (
    <Router>
      <AppContext.Provider
        value={{
          googleDriveSignedIn: state.googleDriveSignedIn,
          setGoogleDriveSignedIn,
          isInitialized: state.initialized,
          user: state.user,
        }}
      >
        <ProjectProvider user={state.user}>
          <TimerProviderWithOverlay>
            <ErrorBoundary>
              <NavBar user={state.user} />
              <div className="main-container">
                <Routes>
                  <Route
                    path="/"
                    element={
                      state.initialized ? (
                        <Navigate to={getRedirectPath()} replace />
                      ) : (
                        <LoadingComponent message="Initializing application..." fullHeight={true} />
                      )
                    }
                  />
                  <Route
                    path="/login"
                    element={
                      state.user ? (
                        <Navigate to="/" replace />
                      ) : (
                        <Suspense fallback={<LoadingComponent message="Loading login..." fullHeight={true} />}>
                          <AuthEntry />
                        </Suspense>
                      )
                    }
                  />
                  <Route 
                    path="/auth/email-link" 
                    element={
                      <Suspense fallback={<LoadingComponent message="Processing link..." fullHeight={true} />}>
                        <EmailLinkHandler />
                      </Suspense>
                    } 
                  />
                  <Route 
                    path="/setup-profile" 
                    element={
                      <Suspense fallback={<LoadingComponent message="Loading profile setup..." fullHeight={true} />}>
                        <SetupProfile />
                      </Suspense>
                    } 
                  />
                  <Route
                    path="/projects"
                    element={
                      state.user && !state.displayNameSet ? (
                        <Navigate to="/setup-profile" replace />
                      ) : state.user ? (
                        <Suspense fallback={<LoadingComponent message="Loading projects..." fullHeight={true} />}>
                          <ProjectList
                            user={state.user}
                            onProjectsUpdate={(projects) =>
                              setState((prev) => ({
                                ...prev,
                                hasProjects: projects.length > 0,
                              }))
                            }
                          />
                        </Suspense>
                      ) : (
                        <Navigate to="/login" replace />
                      )
                    }
                  />
                  <Route
                    path="/account"
                    element={
                      state.user && !state.displayNameSet ? (
                        <Navigate to="/setup-profile" replace />
                      ) : state.user ? (
                        <Suspense fallback={<LoadingComponent message="Loading account..." fullHeight={true} />}>
                          <UserAccount user={state.user} />
                        </Suspense>
                      ) : (
                        <Navigate to="/login" replace />
                      )
                    }
                  />

                  {/* Protected Routes */}
                  {state.user && state.displayNameSet ? (
                    <>
                      <Route
                        path="/project/:projectId"
                        element={
                          <Suspense fallback={<LoadingComponent message="Loading dashboard..." fullHeight={true} />}>
                            <Dashboard user={state.user} />
                          </Suspense>
                        }
                      />
                      <Route
                        path="/project/:projectId/notes"
                        element={
                          <Suspense fallback={<LoadingComponent message="Loading notes..." fullHeight={true} />}>
                            <FullPageNotes user={state.user} />
                          </Suspense>
                        }
                      />
                      <Route
                        path="/project/:projectId/tasks"
                        element={
                          <Suspense fallback={<LoadingComponent message="Loading tasks..." fullHeight={true} />}>
                            <FullPageTasks user={state.user} />
                          </Suspense>
                        }
                      />
                      <Route
                        path="/project/:projectId/bookmarks"
                        element={
                          <Suspense fallback={<LoadingComponent message="Loading bookmarks..." fullHeight={true} />}>
                            <FullPageBookmarks user={state.user} />
                          </Suspense>
                        }
                      />
                      <Route
                        path="/project/:projectId/documents"
                        element={
                          <Suspense fallback={<LoadingComponent message="Loading documents..." fullHeight={true} />}>
                            <DocumentList user={state.user} />
                          </Suspense>
                        }
                      />
                      <Route
                        path="/project/:projectId/ai-assistant"
                        element={
                          <Suspense fallback={<LoadingComponent message="Loading AI assistant..." fullHeight={true} />}>
                            <FullPageAIAssistant user={state.user} />
                          </Suspense>
                        }
                      />
                      <Route
                        path="/project/:projectId/ai-assistant/:synapseId"
                        element={
                          <Suspense fallback={<LoadingComponent message="Loading AI assistant..." fullHeight={true} />}>
                            <FullPageAIAssistant user={state.user} />
                          </Suspense>
                        }
                      />
                      <Route
                        path="/project/:projectId/documents/new"
                        element={
                          <Suspense fallback={<LoadingComponent message="Loading document editor..." fullHeight={true} />}>
                            <DocumentEditor user={state.user} />
                          </Suspense>
                        }
                      />
                      <Route
                        path="/project/:projectId/documents/:id"
                        element={
                          <Suspense fallback={<LoadingComponent message="Loading document..." fullHeight={true} />}>
                            <DocumentEditor user={state.user} />
                          </Suspense>
                        }
                      />
                      <Route
                        path="/project/:projectId/focus"
                        element={
                          <Suspense fallback={<LoadingComponent message="Loading focus timer..." fullHeight={true} />}>
                            <FocusTimer user={state.user} />
                          </Suspense>
                        }
                      />
                      <Route
                        path="/project/:projectId/synapses"
                        element={
                          <Suspense fallback={<LoadingComponent message="Loading synapses..." fullHeight={true} />}>
                            <Synapse user={state.user} />
                          </Suspense>
                        }
                      />
                    </>
                  ) : null}
                  <Route
                    path="*"
                    element={<Navigate to={getRedirectPath()} replace />}
                  />
                </Routes>
              </div>
            </ErrorBoundary>
          </TimerProviderWithOverlay>
        </ProjectProvider>
      </AppContext.Provider>
    </Router>
  );
};

export default App;

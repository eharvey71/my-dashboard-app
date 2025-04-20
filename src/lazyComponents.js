import React from 'react';

// Simple error handling wrapper for lazy components
const withErrorHandling = (importFn) => {
  return React.lazy(() => 
    importFn().catch(error => {
      console.error("Error loading component:", error);
      return { 
        default: () => React.createElement("div", { 
          style: {
            padding: '1rem',
            margin: '1rem',
            textAlign: 'center',
            border: '1px solid #f5c6cb',
            borderRadius: '4px',
            backgroundColor: '#f8d7da',
            color: '#721c24'
          }
        }, "Failed to load component. Please refresh the page.")
      };
    })
  );
};

// Export lazy-loaded components
export const EmailLinkHandler = withErrorHandling(() => import('./components/EmailLinkHandler'));
export const SetupProfile = withErrorHandling(() => import('./components/SetupProfile'));
export const Dashboard = withErrorHandling(() => import('./components/Dashboard'));
export const FullPageNotes = withErrorHandling(() => import('./components/FullPageNotes'));
export const FullPageTasks = withErrorHandling(() => import('./components/FullPageTasks'));
export const FullPageBookmarks = withErrorHandling(() => import('./components/FullPageBookmarks'));
export const FullPageAIAssistant = withErrorHandling(() => import('./components/FullPageAIAssistant'));
export const DocumentEditor = withErrorHandling(() => import('./components/DocumentEditor'));
export const DocumentList = withErrorHandling(() => import('./components/DocumentList'));
export const FocusTimer = withErrorHandling(() => import('./components/FocusTimer'));
export const ProjectList = withErrorHandling(() => import('./components/ProjectList'));
export const Synapse = withErrorHandling(() => import('./components/Synapse'));
export const AuthEntry = withErrorHandling(() => import('./components/AuthEntry'));
export const UserAccount = withErrorHandling(() => import('./components/UserAccount'));
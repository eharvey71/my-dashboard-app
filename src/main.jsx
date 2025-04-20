import React, { Suspense } from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min'; // Include Bootstrap JS
import './index.css';
import ErrorBoundary from './components/ErrorBoundary';
import { injectVersionInfo, isMobileDevice } from './utils/versionManager';
import LoadingComponent from './components/LoadingComponent';

// Initialize version info to help with caching issues
// This also sets up error detection and stuck loading recovery
injectVersionInfo();

// Log environment information for troubleshooting
console.log('Environment:', {
  isMobile: isMobileDevice(),
  userAgent: navigator.userAgent,
  timestamp: new Date().toISOString(),
  buildTime: import.meta.env.VITE_BUILD_TIME || 'not set'
});

ReactDOM.render(
  <React.StrictMode>
    <ErrorBoundary>
      <Suspense fallback={<LoadingComponent message="Loading application..." fullHeight={true} />}>
        <App />
      </Suspense>
    </ErrorBoundary>
  </React.StrictMode>,
  document.getElementById('root')
);

import React, { Component } from 'react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      errorInfo: null,
      errorType: null
    };
  }

  static getDerivedStateFromError(error) {
    // Categorize the error to provide more helpful guidance
    let errorType = 'unknown';
    
    if (error.message && error.message.includes('Cannot read properties of undefined (reading \'Component\')')) {
      errorType = 'component-loading';
    } else if (error.message && error.message.includes('Failed to fetch dynamically imported module')) {
      errorType = 'chunk-loading';
    } else if (error.message && error.message.includes('NetworkError')) {
      errorType = 'network';
    } else if (error.message && error.message.includes('ChunkLoadError')) {
      errorType = 'chunk-loading';
    }
    
    // Update state so the next render will show the fallback UI
    return { hasError: true, error, errorType };
  }

  componentDidCatch(error, errorInfo) {
    // Log error details for debugging
    console.error("Error caught by ErrorBoundary:", error, errorInfo);
    
    // Record additional error metadata
    this.setState({ 
      errorInfo,
      errorDetails: {
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
        pathname: window.location.pathname
      }
    });
    
    // Log to analytics or error tracking service if available
    if (window.gtag) {
      window.gtag('event', 'error', {
        'event_category': 'Error Boundary',
        'event_label': error.toString(),
        'error_type': this.state.errorType || 'unknown',
        'value': 1
      });
    }
    
    // For component loading errors, we could try to recover
    if (error.message && error.message.includes('Component')) {
      // Allow a second before attempting recovery
      setTimeout(() => {
        // Check if we're still mounted before updating state
        if (this._isMounted) {
          try {
            // Force reload of just the current route, not the full page
            const currentPath = window.location.pathname;
            window.history.replaceState({}, '', '/');
            setTimeout(() => {
              window.history.replaceState({}, '', currentPath);
            }, 100);
          } catch (e) {
            console.error("Failed recovery attempt:", e);
          }
        }
      }, 1000);
    }
  }
  
  componentDidMount() {
    this._isMounted = true;
  }
  
  componentWillUnmount() {
    this._isMounted = false;
  }

  getErrorGuidance() {
    const { errorType, error } = this.state;
    
    switch (errorType) {
      case 'component-loading':
        return (
          <div>
            <h4>Component Loading Error</h4>
            <p>There was a problem loading a React component. This is often caused by:</p>
            <ul>
              <li>A network issue preventing code chunks from loading</li>
              <li>A cached or outdated build that needs to be cleared</li>
            </ul>
            <p>Try clearing your browser cache and reloading the page.</p>
          </div>
        );
      case 'chunk-loading':
        return (
          <div>
            <h4>Code Chunk Loading Error</h4>
            <p>A JavaScript code chunk failed to load. This is often caused by:</p>
            <ul>
              <li>Network connectivity issues</li>
              <li>A deployment problem where files are missing</li>
              <li>A cached version that doesn't match the current deployment</li>
            </ul>
            <p>Try clearing your browser cache and reloading the page.</p>
          </div>
        );
      case 'network':
        return (
          <div>
            <h4>Network Error</h4>
            <p>There was a problem connecting to the server. This might be due to:</p>
            <ul>
              <li>Your internet connection</li>
              <li>The server being temporarily unavailable</li>
            </ul>
            <p>Please check your connection and try again.</p>
          </div>
        );
      default:
        return (
          <div>
            <h4>Unexpected Error</h4>
            <p>An unexpected error occurred while rendering this component.</p>
            <p>Please try reloading the page.</p>
          </div>
        );
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary" style={{ 
          padding: '2rem', 
          textAlign: 'center',
          backgroundColor: '#f8d7da',
          border: '1px solid #f5c6cb',
          borderRadius: '4px',
          margin: '1rem',
          color: '#721c24'
        }}>
          <h2>Something went wrong</h2>
          <p>We're sorry, but there was an error loading this component.</p>
          
          {/* Error guidance based on error type */}
          <div style={{
            backgroundColor: '#fff',
            padding: '1rem',
            borderRadius: '4px',
            margin: '1rem 0',
            textAlign: 'left'
          }}>
            {this.getErrorGuidance()}
          </div>
          
          {/* Technical error details for developers */}
          <div style={{ 
            marginTop: '1rem', 
            textAlign: 'left', 
            backgroundColor: '#f8f9fa',
            padding: '1rem',
            borderRadius: '4px',
            fontSize: '14px',
            fontFamily: 'monospace',
            maxHeight: '200px',
            overflow: 'auto'
          }}>
            <details>
              <summary>Error details (for developers)</summary>
              <p><strong>Error:</strong> {this.state.error && this.state.error.toString()}</p>
              <p><strong>Type:</strong> {this.state.errorType || 'unknown'}</p>
              <p><strong>URL:</strong> {window.location.href}</p>
              <p><strong>User Agent:</strong> {navigator.userAgent}</p>
              <p><strong>Time:</strong> {new Date().toLocaleString()}</p>
              {this.state.errorInfo && (
                <div>
                  <p><strong>Component Stack:</strong></p>
                  <pre>{this.state.errorInfo.componentStack}</pre>
                </div>
              )}
            </details>
          </div>
          
          {/* Action buttons */}
          <div style={{ marginTop: '1.5rem' }}>
            <button 
              onClick={() => window.location.reload()}
              style={{
                backgroundColor: '#007bff',
                border: 'none',
                color: 'white',
                padding: '0.5rem 1rem',
                borderRadius: '4px',
                cursor: 'pointer',
                marginRight: '1rem'
              }}
            >
              Reload Page
            </button>
            
            <button
              onClick={() => {
                // Clear cache by forcing a reload from server rather than cache
                window.location.href = window.location.href + 
                  (window.location.href.includes('?') ? '&' : '?') + 
                  'clearcache=' + new Date().getTime();
              }}
              style={{
                backgroundColor: '#6c757d',
                border: 'none',
                color: 'white',
                padding: '0.5rem 1rem',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Clear Cache & Reload
            </button>
          </div>
        </div>
      );
    }

    // Render children if there's no error
    return this.props.children;
  }
}

export default ErrorBoundary;
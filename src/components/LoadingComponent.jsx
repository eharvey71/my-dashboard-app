import React from 'react';

// A standalone loading component that can be used throughout the app
const LoadingComponent = ({ message = 'Loading...', fullHeight = false }) => {
  const containerStyle = {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    height: fullHeight ? '100vh' : '300px',
    padding: '2rem',
    textAlign: 'center'
  };

  const spinnerStyle = {
    border: '4px solid rgba(0, 123, 255, 0.1)',
    borderRadius: '50%',
    borderTop: '4px solid #007bff',
    width: '40px',
    height: '40px',
    animation: 'spin 1s linear infinite',
    marginBottom: '1rem'
  };

  // Add the keyframes animation to the document
  React.useEffect(() => {
    // Only add the style if it doesn't already exist
    if (!document.getElementById('loading-spinner-style')) {
      const style = document.createElement('style');
      style.id = 'loading-spinner-style';
      style.innerHTML = `
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);

      // Clean up on unmount
      return () => {
        const styleElement = document.getElementById('loading-spinner-style');
        if (styleElement) {
          document.head.removeChild(styleElement);
        }
      };
    }
  }, []);

  return (
    <div style={containerStyle} className="loading-container">
      <div style={spinnerStyle} className="loading-spinner" role="status" />
      <p style={{ margin: '0.5rem 0', color: '#6c757d' }}>{message}</p>
      <div className="loading-dots" style={{ color: '#6c757d' }}>
        <span className="visually-hidden">Loading...</span>
      </div>
    </div>
  );
};

export default LoadingComponent;
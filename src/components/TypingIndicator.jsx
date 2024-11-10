import React from 'react';

const TypingIndicator = () => {
  return (
    <div 
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        height: '24px'
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: '8px',
              height: '8px',
              backgroundColor: '#3b82f6',
              borderRadius: '50%',
              animation: 'bounce 1.4s infinite ease-in-out',
              animationDelay: `${i * 0.16}s`
            }}
          />
        ))}
      </div>
      <style>
        {`
          @keyframes bounce {
            0%, 80%, 100% { 
              transform: translateY(0);
            }
            40% { 
              transform: translateY(-6px);
            }
          }
        `}
      </style>
      <span style={{ fontSize: '14px', color: '#666' }}>
        AI is thinking...
      </span>
    </div>
  );
};

export default TypingIndicator;
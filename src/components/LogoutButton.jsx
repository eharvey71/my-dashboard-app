import React from 'react';
import { useNavigate } from 'react-router-dom';
import { logout } from '../services/firebaseAuth';
import { signOut as googleDriveSignOut } from '../services/googleDriveService';
import { useProjectContext } from '../contexts/ProjectContext';
import { useContext } from 'react';
import { AppContext } from '../App';

const LogoutButton = () => {
  const navigate = useNavigate();
  const { setActiveProject } = useProjectContext();
  const { setGoogleDriveSignedIn } = useContext(AppContext);

  const handleLogout = async () => {
    try {
      // Clear project context first
      if (setActiveProject) {
        setActiveProject(null);
      }
      
      // Sign out of Google Drive
      try {
        await googleDriveSignOut();
        if (setGoogleDriveSignedIn) {
          setGoogleDriveSignedIn(false);
        }
      } catch (error) {
        console.warn('Google Drive sign out error:', error);
      }

      // Clear any local storage
      localStorage.clear(); // Clear all local storage
      sessionStorage.clear(); // Clear all session storage

      // Sign out of Firebase
      await logout();
      
      // Force navigation to login page
      navigate('/login', { replace: true });
      
      // Reload the page to ensure clean state
      window.location.reload();
      
    } catch (error) {
      console.error('Logout error:', error);
      // Even if there's an error, try to force navigation
      navigate('/login', { replace: true });
      window.location.reload();
    }
  };

  return (
    <button 
      className="btn btn-link nav-link" 
      onClick={handleLogout}
    >
      Logout
    </button>
  );
};

export default LogoutButton;
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { logout } from '../services/firebaseAuth';
import { signOut as googleDriveSignOut } from '../services/googleDriveService';
import { useProjectContext } from '../contexts/ProjectContext';
import { useContext } from 'react';
import { AppContext } from '../App';  // Changed this import

const LogoutButton = () => {
  const navigate = useNavigate();
  const { setActiveProject } = useProjectContext();
  const { setGoogleDriveSignedIn } = useContext(AppContext);

  const handleLogout = async () => {
    try {
      // Clear project context
      setActiveProject(null);
      
      // Sign out of Google Drive if integrated
      try {
        await googleDriveSignOut();
        setGoogleDriveSignedIn(false);
      } catch (error) {
        console.warn('Google Drive sign out error:', error);
      }

      // Sign out of Firebase
      await logout();

      // Clear any local storage items
      localStorage.removeItem('googleDriveToken');
      
      // Force navigation to login page
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Logout error:', error);
      // Force navigation to login page even if there's an error
      navigate('/login', { replace: true });
    }
  };

  return (
    <button className="btn btn-link nav-link" onClick={handleLogout}>
      Logout
    </button>
  );
};

export default LogoutButton;
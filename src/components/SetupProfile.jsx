import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, updateUserDisplayName } from '../services/firebaseAuth';
import styles from './AuthForms.module.css';

const SetupProfile = () => {
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  
  useEffect(() => {
    // Redirect if no user is logged in
    if (!auth.currentUser) {
      console.log('No user found, redirecting to login');
      navigate('/login');
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!displayName.trim()) {
      setError('Display name is required');
      setLoading(false);
      return;
    }

    try {
      console.log('Updating display name for user:', auth.currentUser?.uid);
      const result = await updateUserDisplayName(auth.currentUser.uid, displayName.trim());
      if (result.success) {
        console.log('Display name updated successfully');
        navigate('/projects');
      } else {
        console.error('Failed to update display name:', result.error);
        setError(result.error || 'Failed to update display name');
      }
    } catch (error) {
      console.error('Error in display name update:', error);
      setError(error.message);
    }
    
    setLoading(false);
  };

  if (!auth.currentUser) {
    return null;
  }

  return (
    <div className={`${styles.authContainer} container mt-5`}>
      <div className="row justify-content-center">
        <div className="col-md-6">
          <div className="card">
            <div className="card-body">
              <h2 className="card-title text-center mb-4">Complete Your Profile</h2>
              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label htmlFor="displayName" className="form-label">Display Name:</label>
                  <input
                    type="text"
                    id="displayName"
                    className="form-control"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required
                  />
                </div>
                {error && <p className="text-danger">{error}</p>}
                <button 
                  type="submit" 
                  className="btn btn-primary w-100" 
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Complete Setup'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SetupProfile;
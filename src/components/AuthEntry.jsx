import React, { useState } from 'react';
import { sendSignInLink } from '../services/firebaseAuth';
import styles from './AuthForms.module.css';

const AuthEntry = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setLoading(true);

    const result = await sendSignInLink(email);
    
    if (result.success) {
      setSuccess(true);
      setError('');
    } else {
      setError(result.error);
      setSuccess(false);
    }
    
    setLoading(false);
  };

  return (
    <div className={`${styles.authContainer} container mt-5`}>
      <div className="row justify-content-center">
        <div className="col-md-6">
          <div className="card">
            <div className="card-body">
              <h2 className="card-title text-center mb-4">Sign In / Sign Up</h2>
              {success ? (
                <div className="text-center">
                  <div className="alert alert-success">
                    <p>A sign-in link has been sent to {email}</p>
                    <p>Please check your email to continue.</p>
                  </div>
                  <button 
                    className="btn btn-primary"
                    onClick={(e) => {
                      e.preventDefault();
                      setEmail('');
                      setSuccess(false);
                    }}
                  >
                    Use a different email
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit}>
                  <div className="mb-3">
                    <label htmlFor="email" className="form-label">Email:</label>
                    <input
                      type="email"
                      id="email"
                      className="form-control"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  {error && <p className="text-danger">{error}</p>}
                  <button 
                    type="submit" 
                    className="btn btn-primary w-100" 
                    disabled={loading}
                  >
                    {loading ? 'Sending link...' : 'Send Sign-in Link'}
                  </button>
                  <p className="mt-3 text-center text-muted">
                    Enter your email to receive a sign-in link.
                    <br />
                    Works for both new and existing users.
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthEntry;
import React, { useState } from 'react';
import { getAuth, createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { useNavigate, Link } from 'react-router-dom';
import styles from './AuthForms.module.css';
import { doc, setDoc, getFirestore } from "firebase/firestore";

function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [displayName, setDisplayName] = useState('');
  const auth = getAuth();
  const db = getFirestore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Save user information in Firestore
      await setDoc(doc(db, "users", user.uid), {
        email: user.email,
        displayName: displayName,
        emailVerified: false,
      });

      // Send verification email
      await sendEmailVerification(user);

      // Redirect to verification page
      navigate('/email-verification');
    } catch (error) {
      setError(error.message);
    }
  };

  return (
    <div className={`${styles.authContainer} container mt-5`}>
      <div className="row justify-content-center">
        <div className="col-md-6">
          <div className="card">
            <div className="card-body">
              <h2 className="card-title text-center mb-4">Sign Up</h2>
              {message && <div className="alert alert-success">{message}</div>}
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
                <div className="mb-3">
                  <label htmlFor="password" className="form-label">Password:</label>
                  <input
                    type="password"
                    id="password"
                    className="form-control"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="mb-3">
                  <label htmlFor="confirmPassword" className="form-label">Confirm Password:</label>
                  <input
                    type="password"
                    id="confirmPassword"
                    className="form-control"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
                {error && <p className="text-danger">{error}</p>}
                {message && <p className="text-success">{message}</p>}
                <button type="submit" className="btn btn-primary w-100" disabled={loading}>
                  {loading ? 'Signing up...' : 'Sign Up'}
                </button>
              </form>
              <p className="mt-3 text-center">
                Already have an account? <Link to="/login">Login</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Signup;
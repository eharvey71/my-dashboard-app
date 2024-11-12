import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  auth,
  isSignInWithEmailLink,
  completeSignInWithEmailLink,
} from "../services/firebaseAuth";
import { useProjectContext } from "../contexts/ProjectContext";
import styles from "./AuthForms.module.css";

const EmailLinkHandler = () => {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(true);
  const navigate = useNavigate();
  const { updateDisplayName } = useProjectContext();

  useEffect(() => {
    const completeSignIn = async () => {
      if (!isSignInWithEmailLink(auth, window.location.href)) {
        setError("Invalid sign-in link.");
        setProcessing(false);
        return;
      }

      let emailForSignIn = window.localStorage.getItem("emailForSignIn");

      if (!emailForSignIn) {
        setProcessing(false);
        return;
      }

      try {
        const result = await completeSignInWithEmailLink(
          emailForSignIn,
          window.location.href
        );
        if (result.success) {
          if (result.userData && result.userData.displayName) {
            updateDisplayName(result.userData.displayName);
            console.log(
              "Existing user with display name, redirecting to dashboard"
            );
            navigate("/");
          } else {
            console.log("User needs display name setup");
            navigate("/setup-profile");
          }
        } else {
          setError(result.error);
          setProcessing(false);
        }
      } catch (error) {
        setError(error.message);
        setProcessing(false);
      }
    };

    completeSignIn();
  }, [navigate, updateDisplayName]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setProcessing(true);

    try {
      const result = await completeSignInWithEmailLink(
        email,
        window.location.href
      );
      if (result.success) {
        if (result.userData && result.userData.displayName) {
          updateDisplayName(result.userData.displayName);
          console.log(
            "Existing user with display name, redirecting to dashboard"
          );
          navigate("/");
        } else {
          console.log("User needs display name setup");
          navigate("/setup-profile");
        }
      } else {
        setError(result.error);
        setProcessing(false);
      }
    } catch (error) {
      setError(error.message);
      setProcessing(false);
    }
  };

  if (processing) {
    return (
      <div className={`${styles.authContainer} container mt-5`}>
        <div className="text-center">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3">Completing sign in...</p>
        </div>
      </div>
    );
  }

  if (error && !email) {
    return (
      <div className={`${styles.authContainer} container mt-5`}>
        <div className="row justify-content-center">
          <div className="col-md-6">
            <div className="card">
              <div className="card-body">
                <h2 className="card-title text-center mb-4">
                  Confirm Your Email
                </h2>
                <p className="text-center">
                  Please enter your email to complete the sign-in process.
                </p>
                <form onSubmit={handleSubmit}>
                  <div className="mb-3">
                    <label htmlFor="email" className="form-label">
                      Email:
                    </label>
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
                  <button type="submit" className="btn btn-primary w-100">
                    Complete Sign In
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default EmailLinkHandler;

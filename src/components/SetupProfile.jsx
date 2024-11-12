import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  auth,
  updateUserDisplayName,
  onAuthStateChanged,
} from "../services/firebaseAuth";
import { db } from "../services/firebaseConfig"; // Make sure this import exists
import { doc, getDoc } from "firebase/firestore"; // Add this import
import styles from "./AuthForms.module.css";

const SetupProfile = () => {
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        console.log("No user found, redirecting to login");
        navigate("/login");
      } else {
        console.log("Auth state ready, user found:", user.uid);
        setAuthReady(true);
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!authReady) {
      console.log("Waiting for auth state to settle...");
      return;
    }

    setError("");
    setLoading(true);

    if (!displayName.trim()) {
      setError("Display name is required");
      setLoading(false);
      return;
    }

    try {
      console.log(
        "Auth ready, updating display name for user:",
        auth.currentUser?.uid
      );
      const result = await updateUserDisplayName(
        auth.currentUser.uid,
        displayName.trim()
      );

      if (result.success) {
        console.log("Display name updated successfully");

        // Verify user document exists before navigation
        const userRef = doc(db, "users", auth.currentUser.uid);
        let verificationAttempts = 0;
        const maxAttempts = 3;

        while (verificationAttempts < maxAttempts) {
          const userDoc = await getDoc(userRef);
          if (userDoc.exists() && userDoc.data().displayNameSet) {
            console.log("User document verified, proceeding with navigation");
            navigate("/projects");
            return;
          }
          await new Promise((resolve) => setTimeout(resolve, 1000));
          verificationAttempts++;
        }

        // If we get here, we couldn't verify the document
        throw new Error(
          "Could not verify user document creation after multiple attempts"
        );
      } else {
        console.error("Failed to update display name:", result.error);
        setError(result.error || "Failed to update display name");
      }
    } catch (error) {
      console.error("Error in display name update:", error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!authReady || !auth.currentUser) {
    return (
      <div className={`${styles.authContainer} container mt-5`}>
        <div className="text-center">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3">Preparing your profile setup...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.authContainer} container mt-5`}>
      <div className="row justify-content-center">
        <div className="col-md-6">
          <div className="card">
            <div className="card-body">
              <h2 className="card-title text-center mb-4">
                Complete Your Profile
              </h2>
              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label htmlFor="displayName" className="form-label">
                    Display Name:
                  </label>
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
                  disabled={loading || !authReady}
                >
                  {loading ? "Saving..." : "Complete Setup"}
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

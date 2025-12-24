import React, { useState, useEffect } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../services/firebaseConfig";
import { auth } from "../services/firebaseAuth";
import styles from "./UserAccount.module.css";

const UserAccount = () => {
  const [displayName, setDisplayName] = useState("");
  const [city, setCity] = useState("");
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone
  );
  const [unit, setUnit] = useState("imperial"); // Add unit state
  const [educationMode, setEducationMode] = useState(false); // Add education mode state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const loadUserData = async () => {
      try {
        const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
        const userData = userDoc.data();
        setDisplayName(userData.displayName || "");
        setCity(userData.city || "");
        setTimezone(
          userData.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
        );
        setUnit(userData.unit || "imperial"); // Load unit from user data
        setEducationMode(userData.educationMode || false); // Load education mode from user data
      } catch (err) {
        setError("Failed to load user data");
      }
      setLoading(false);
    };
    loadUserData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      await updateDoc(doc(db, "users", auth.currentUser.uid), {
        displayName: displayName.trim(),
        city: city.trim(),
        timezone,
        unit,
        educationMode,
      });

      // Force a refresh of the parent component
      if (window.location.pathname === "/account") {
        // Optionally refresh the page to ensure all components update
        window.location.reload();
      }

      setSuccess("Profile updated successfully");
    } catch (err) {
      setError("Failed to update profile");
    }
    setLoading(false);
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="container mt-5">
      <div className="row justify-content-center">
        <div className="col-md-6">
          <div className="card">
            <div className="card-body">
              <h2 className="card-title text-center mb-4">Account Settings</h2>
              <form onSubmit={handleSubmit}>
                <div className={`mb-3 ${styles.formGroup}`}>
                  <label className="form-label">Display Name</label>
                  <input
                    type="text"
                    className={`form-control ${styles.formControl}`}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required
                  />
                </div>
                <div className={`mb-3 ${styles.formGroup}`}>
                  <label className="form-label">City</label>
                  <input
                    type="text"
                    className={`form-control ${styles.formControl}`}
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. London, UK"
                  />
                </div>
                <div className={`mb-3 ${styles.formGroup}`}>
                  <label className="form-label">Timezone</label>
                  <select
                    className={`form-select ${styles.formControl}`}
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                  >
                    {Intl.supportedValuesOf("timeZone").map((tz) => (
                      <option key={tz} value={tz}>
                        {tz}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={`mb-3 ${styles.formGroup}`}>
                  <label className="form-label">Temperature Unit</label>
                  <select
                    className={`form-select ${styles.formControl}`}
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                  >
                    <option value="metric">Celsius (°C)</option>
                    <option value="imperial">Fahrenheit (°F)</option>
                  </select>
                </div>
                <div className={`mb-3 ${styles.formGroup}`}>
                  <label className="form-label">Application Mode</label>
                  <select
                    className={`form-select ${styles.formControl}`}
                    value={educationMode ? "education" : "standard"}
                    onChange={(e) => setEducationMode(e.target.value === "education")}
                  >
                    <option value="standard">Standard Mode</option>
                    <option value="education">Education Mode</option>
                  </select>
                  <small className="form-text text-muted">
                    Education Mode adapts the interface for academic use (courses, assignments, study materials)
                  </small>
                </div>
                {error && <div className="alert alert-danger">{error}</div>}
                {success && (
                  <div className="alert alert-success">{success}</div>
                )}
                <button
                  type="submit"
                  className={`btn btn-primary w-100 ${styles.saveButton}`}
                  disabled={loading}
                >
                  {loading ? "Saving..." : "Save Changes"}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserAccount;

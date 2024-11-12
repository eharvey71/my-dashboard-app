import { initializeApp } from "firebase/app";
import {
  getAuth,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBfYQ8Heb8C3tEzeKhGnEvRga-KEHj326g",
  authDomain: "mydashboard-ff9ae.firebaseapp.com",
  databaseURL: "https://mydashboard-ff9ae-default-rtdb.firebaseio.com",
  projectId: "mydashboard-ff9ae",
  storageBucket: "mydashboard-ff9ae.appspot.com",
  messagingSenderId: "856197649644",
  appId: "1:856197649644:web:48150da4f5db80617b41c9",
  measurementId: "G-NPL3YL1MBE",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
export const db = getFirestore(app);

const actionCodeSettings = {
  url: `${window.location.origin}/auth/email-link`,
  handleCodeInApp: true,
};

export const sendSignInLink = async (email) => {
  try {
    await sendSignInLinkToEmail(auth, email, actionCodeSettings);
    window.localStorage.setItem("emailForSignIn", email);
    return {
      success: true,
      message: "Sign-in link sent to your email. Please check your inbox.",
    };
  } catch (error) {
    console.error("Error sending sign-in link:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

export const completeSignInWithEmailLink = async (email, link) => {
  try {
    console.log("Completing sign in for email:", email);
    const result = await signInWithEmailLink(auth, email, link);
    const user = result.user;

    // Create a Promise that resolves when the user document is confirmed to exist
    const ensureUserDocument = async () => {
      const userRef = doc(db, "users", user.uid);
      let attempts = 0;
      const maxAttempts = 3;

      while (attempts < maxAttempts) {
        const userDoc = await getDoc(userRef);

        if (userDoc.exists()) {
          return { exists: true, data: userDoc.data() };
        }

        // If document doesn't exist, create it
        if (attempts === 0) {
          await setDoc(userRef, {
            email: user.email,
            emailVerified: true,
            displayName: "",
            displayNameSet: false,
            lastAccessedProject: null,
          });
        }

        // Wait before next attempt
        await new Promise((resolve) => setTimeout(resolve, 1000));
        attempts++;
      }

      // Final check after all attempts
      const finalCheck = await getDoc(userRef);
      return {
        exists: finalCheck.exists(),
        data: finalCheck.exists() ? finalCheck.data() : null,
      };
    };

    const userDocStatus = await ensureUserDocument();

    // Clear email from storage
    window.localStorage.removeItem("emailForSignIn");

    if (!userDocStatus.exists) {
      throw new Error("Failed to confirm user document creation");
    }

    return {
      success: true,
      user,
      userData: userDocStatus.data,
    };
  } catch (error) {
    console.error("Error completing sign-in:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

export const updateUserDisplayName = async (uid, displayName) => {
  try {
    console.log("Attempting to update display name for uid:", uid);
    const userRef = doc(db, "users", uid);

    // First attempt to get the document
    const userDoc = await getDoc(userRef);

    // Create or update the document
    if (!userDoc.exists()) {
      console.log("Creating new user document during display name update");
      await setDoc(userRef, {
        email: auth.currentUser.email,
        emailVerified: true,
        displayName: displayName,
        displayNameSet: true,
        lastAccessedProject: null,
      });
    } else {
      console.log("Updating existing user document");
      await updateDoc(userRef, {
        displayName: displayName,
        displayNameSet: true,
      });
    }

    // Verify the update with retries
    let verificationAttempts = 0;
    const maxAttempts = 3;

    while (verificationAttempts < maxAttempts) {
      const verifyDoc = await getDoc(userRef);
      if (
        verifyDoc.exists() &&
        verifyDoc.data().displayNameSet &&
        verifyDoc.data().displayName === displayName
      ) {
        console.log("Display name update verified");
        return {
          success: true,
          userData: verifyDoc.data(),
        };
      }

      console.log(
        `Verification attempt ${verificationAttempts + 1} failed, retrying...`
      );
      await new Promise((resolve) => setTimeout(resolve, 1000));
      verificationAttempts++;
    }

    throw new Error(
      "Could not verify display name update after multiple attempts"
    );
  } catch (error) {
    console.error("Error updating display name:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

export const logout = async () => {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    console.error("Logout error:", error);
    throw error;
  }
};

export { auth, onAuthStateChanged, isSignInWithEmailLink };

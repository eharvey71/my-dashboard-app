import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  sendEmailVerification as firebaseSendEmailVerification,
  applyActionCode,
  onAuthStateChanged
} from "firebase/auth";
import { getFirestore, doc, setDoc, updateDoc } from "firebase/firestore";

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

export const signup = async (email, password, displayName) => {
  try {
    // Create user with email and password
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Save user information in Firestore
    await setDoc(doc(db, "users", user.uid), {
      email: user.email,
      displayName: displayName,
      emailVerified: false,
    });

    // Send email verification and log the result or any errors
    await firebaseSendEmailVerification(user)
      .then(() => {
        console.log("Verification email sent to:", user.email);
      })
      .catch((error) => {
        console.error("Error sending email verification:", error);
        throw new Error("Failed to send verification email.");
      });

    // Sign out the user after email is sent
    await auth.signOut();

    return { success: true, message: "Signup successful. Please check your email for verification." };
  } catch (error) {
    console.error("Error in signup process:", error);
    return { success: false, error: error.message };
  }
};


export const login = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // if (!user.emailVerified) {
    //   await signOut(auth);
    //   return { success: false, error: "Please verify your email before logging in." };
    // }

    return { success: true, user };
  } catch (error) {
    console.error("Error in login process:", error);
    return { success: false, error: error.message };
  }
};

export const logout = async () => {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    console.error('Logout error:', error);
    throw error;
  }
};

export const verifyEmail = async (actionCode) => {
  try {
    await applyActionCode(auth, actionCode);
    const user = auth.currentUser;
    if (user) {
      await updateDoc(doc(db, "users", user.uid), { emailVerified: true });
    }
    return { success: true };
  } catch (error) {
    console.error("Error verifying email:", error);
    return { success: false, error: error.message };
  }
};

export const resendVerificationEmail = async () => {
  try {
    const user = auth.currentUser;
    if (user) {
      await firebaseSendEmailVerification(user);
      return { success: true, message: "Verification email sent successfully." };
    } else {
      return { success: false, error: "No user is currently signed in." };
    }
  } catch (error) {
    console.error("Error resending verification email:", error);
    return { success: false, error: error.message };
  }
};

export { auth };

export { onAuthStateChanged } from 'firebase/auth';
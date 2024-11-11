import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  signOut,
  onAuthStateChanged
} from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

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
  handleCodeInApp: true
};

export const sendSignInLink = async (email) => {
  try {
    await sendSignInLinkToEmail(auth, email, actionCodeSettings);
    // Save email for confirmation
    window.localStorage.setItem('emailForSignIn', email);
    return { 
      success: true, 
      message: "Sign-in link sent to your email. Please check your inbox." 
    };
  } catch (error) {
    console.error("Error sending sign-in link:", error);
    return { 
      success: false, 
      error: error.message 
    };
  }
};

export const completeSignInWithEmailLink = async (email, link) => {
  try {
    console.log('Completing sign in for email:', email);
    const result = await signInWithEmailLink(auth, email, link);
    const user = result.user;

    console.log('Sign in completed, checking if new user:', result.additionalUserInfo?.isNewUser);
    
    // Create user document for new users
    if (result.additionalUserInfo?.isNewUser) {
      console.log('Creating new user document');
      try {
        await setDoc(doc(db, "users", user.uid), {
          email: user.email,
          emailVerified: true,
          displayName: '',
          displayNameSet: false,
          lastAccessedProject: null
        });
      } catch (error) {
        console.error('Error creating user document:', error);
        throw error;
      }
    }
    
    // Clear email from storage
    window.localStorage.removeItem('emailForSignIn');
    
    return { 
      success: true, 
      isNewUser: result.additionalUserInfo?.isNewUser,
      user 
    };
  } catch (error) {
    console.error("Error completing sign-in:", error);
    return { 
      success: false, 
      error: error.message 
    };
  }
};

export const updateUserDisplayName = async (uid, displayName) => {
  try {
    console.log('Attempting to update display name for uid:', uid);
    const userRef = doc(db, "users", uid);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      console.error('User document not found');
      // Create the user document if it doesn't exist
      console.log('Creating new user document during display name update');
      await setDoc(userRef, {
        email: auth.currentUser.email,
        emailVerified: true,
        displayName: displayName,
        displayNameSet: true,
        lastAccessedProject: null
      });
      return { success: true };
    }
    
    const userData = userDoc.data();
    console.log('Current user data:', userData);
    
    const updates = {
      displayName: displayName,
      displayNameSet: true,
    };
    
    console.log('Applying updates:', updates);
    await updateDoc(userRef, updates);
    
    return { success: true };
  } catch (error) {
    console.error("Error updating display name:", error);
    return { 
      success: false, 
      error: error.message 
    };
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

export { auth, onAuthStateChanged, isSignInWithEmailLink };
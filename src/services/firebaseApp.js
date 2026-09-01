// Single Firebase app instance shared by every service.
//
// firebaseConfig.js and firebaseAuth.js each used to call initializeApp() with
// the same config, producing two apps in one page. Everything now imports from
// here so there is exactly one app, one Firestore handle, and one auth handle.
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getAuth } from "firebase/auth";

// The Firebase web apiKey is a public client identifier, not a secret. Access
// is controlled by Firestore security rules (see firestore.rules), not by
// hiding this value.
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

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const functions = getFunctions(app);
export const auth = getAuth(app);

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, setDoc } from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getAnalytics } from "firebase/analytics";

// Replace these with your actual Firebase project configuration values
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Set persistence
setPersistence(auth, browserLocalPersistence);

const createUserProfile = async (userId, email) => {
  const userDoc = doc(db, 'users', userId);
  await setDoc(userDoc, { email });
};

const getTasks = async (userId) => {
  console.log("getTasks: Fetching tasks for user:", userId)
  const tasksCollection = collection(db, 'tasks');
  const q = query(tasksCollection, where("userId", "==", userId));
  const taskSnapshot = await getDocs(q);
  return taskSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

const addTask = async (title, userId) => {
  const tasksCollection = collection(db, 'tasks');
  const taskData = {
    title,
    completed: false,
    createdAt: new Date(),
    timerSeconds: 1500,
    timerActive: false,
    userId
  };

  console.log("Adding task with data:", taskData);

  await addDoc(tasksCollection, taskData);
};

const updateTask = async (id, updatedFields) => {
  const taskDoc = doc(db, 'tasks', id);
  await updateDoc(taskDoc, updatedFields);
};

const deleteTask = async (id) => {
  const taskDoc = doc(db, 'tasks', id);
  await deleteDoc(taskDoc);
};

const getNotes = async (userId) => {
  const notesCollection = collection(db, 'notes');
  const q = query(notesCollection, where("userId", "==", userId));
  const noteSnapshot = await getDocs(q);
  return noteSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

const addNote = async (content, userId) => {
  const notesCollection = collection(db, 'notes');
  await addDoc(notesCollection, { content, createdAt: new Date(), userId });
};

const deleteNote = async (id) => {
  const noteDoc = doc(db, 'notes', id);
  await deleteDoc(noteDoc);
};

const signup = async (email, password) => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const userId = userCredential.user.uid;
  await createUserProfile(userId, email);
};

const login = async (email, password) => {
  await signInWithEmailAndPassword(auth, email, password);
};

const logout = async () => {
  await signOut(auth);
};

export { getTasks, addTask, updateTask, deleteTask, getNotes, addNote, deleteNote, signup, login, logout, auth, onAuthStateChanged };

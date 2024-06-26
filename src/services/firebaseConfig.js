import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, addDoc, deleteDoc, doc, query, where, setDoc, updateDoc } from 'firebase/firestore'; // Ensure updateDoc and deleteDoc are imported
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, setPersistence, browserLocalPersistence, onAuthStateChanged } from 'firebase/auth';

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

  console.log("Attempting to add task with data:", taskData);

  try {
    await addDoc(tasksCollection, taskData);
    console.log("Task successfully added:", taskData);
  } catch (error) {
    console.error("Error adding task:", error);
  }
};

const updateTask = async (id, updates) => {
  const taskDoc = doc(db, 'tasks', id);
  try {
    await updateDoc(taskDoc, updates);
    console.log("Task successfully updated:", updates);
  } catch (error) {
    console.error("Error updating task:", error);
  }
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
  const noteData = {
    content,
    createdAt: new Date(),
    userId
  };

  console.log("Attempting to add note with data:", noteData);

  try {
    await addDoc(notesCollection, noteData);
    console.log("Note successfully added:", noteData);
  } catch (error) {
    console.error("Error adding note:", error);
  }
};

const deleteNote = async (id) => {
  const noteDoc = doc(db, 'notes', id);
  await deleteDoc(noteDoc);
};

const getBookmarks = async (userId) => {
  const bookmarksCollection = collection(db, 'bookmarks');
  const q = query(bookmarksCollection, where("userId", "==", userId));
  const bookmarkSnapshot = await getDocs(q);
  return bookmarkSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

const addBookmark = async (url, title, image, userId) => {
  const bookmarksCollection = collection(db, 'bookmarks');
  const bookmarkData = {
    url,
    title,
    image,
    userId
  };

  console.log("Attempting to add bookmark with data:", bookmarkData);

  try {
    await addDoc(bookmarksCollection, bookmarkData);
    console.log("Bookmark successfully added:", bookmarkData);
  } catch (error) {
    console.error("Error adding bookmark:", error);
  }
};

const deleteBookmark = async (id) => {
  const bookmarkDoc = doc(db, 'bookmarks', id);
  await deleteDoc(bookmarkDoc);
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

export { db, getTasks, addTask, updateTask, deleteTask, getNotes, addNote, deleteNote, getBookmarks, addBookmark, deleteBookmark, signup, login, logout, auth, onAuthStateChanged };

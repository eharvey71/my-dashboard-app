import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, addDoc, deleteDoc, doc, query, where, setDoc, updateDoc, getDoc } from "firebase/firestore";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, setPersistence, browserLocalPersistence, onAuthStateChanged } from "firebase/auth";
import { updateVector } from "./pineconeService";
import { getFunctions, httpsCallable } from 'firebase/functions';

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
const functions = getFunctions(app);

// Set persistence
setPersistence(auth, browserLocalPersistence);

/* const createUserProfile = async (userId, email) => {
  const userDoc = doc(db, "users", userId);
  await setDoc(userDoc, { email });
}; */

const addItem = async (content, userId, type, additionalData = {}) => {
  const collectionRef = collection(db, `${type}s`);
  try {
    const docRef = await addDoc(collectionRef, {
      title: content,
      content: content,
      createdAt: new Date(),
      userId,
      indexedInPinecone: false,
      ...(type === "task"
        ? { completed: false, 
            timerSeconds: 1500,
            timerActive: false,
            isRecurring: additionalData.isRecurring || false,
            recurrencePattern: additionalData.recurrencePattern || null,
            nextDueDate: additionalData.nextDueDate ? new Date(additionalData.nextDueDate).toISOString() : null,
          }
        : {}),
      ...additionalData,
    });

    console.log(`${type} added to Firebase with ID: ${docRef.id}`);

    // The Cloud Function will handle the Pinecone indexing
    return {
      id: docRef.id,
      title: content,
      content: content,
      createdAt: new Date(),
      userId,
      indexedInPinecone: false,
      ...(type === "task"
        ? { 
            completed: false,
            timerSeconds: 1500,
            timerActive: false,
            isRecurring: additionalData.isRecurring || false,
            recurrencePattern: additionalData.recurrencePattern || null,
            nextDueDate: additionalData.nextDueDate || null,
          }
        : {}),
    };
  } catch (error) {
    console.error(`Error adding ${type}:`, error);
    throw error;
  }
};

const updateItem = async (id, updates, type) => {
  const itemDoc = doc(db, `${type}s`, id);
  try {
    const itemSnapshot = await getDoc(itemDoc);
    if (!itemSnapshot.exists()) {
      throw new Error(`${type} not found`);
    }
    const currentItem = itemSnapshot.data();

    if (type === "task") {
      if ('isRecurring' in updates) {
        updates.recurrencePattern = updates.isRecurring ? (updates.recurrencePattern || currentItem.recurrencePattern) : null;
        updates.nextDueDate = updates.isRecurring ? 
          (updates.nextDueDate ? new Date(updates.nextDueDate).toISOString() : currentItem.nextDueDate) : 
          null;
      }
      if ('nextDueDate' in updates && updates.nextDueDate) {
        updates.nextDueDate = new Date(updates.nextDueDate).toISOString();
      }
    }

    await updateDoc(itemDoc, updates);

    if (
      (updates.content || updates.title) &&
      (updates.content !== currentItem.content ||
        updates.title !== currentItem.title)
    ) {
      const newContent = updates.content || updates.title;
      await updateVector(currentItem.userId, id, newContent, type);
    }

    console.log(`${type} successfully updated:`, updates);
  } catch (error) {
    console.error(`Error updating ${type}:`, error);
    throw error;
  }
};

const deleteItem = async (id, type) => {
  const itemDoc = doc(db, `${type}s`, id);
  try {
    const itemSnapshot = await getDoc(itemDoc);
    if (!itemSnapshot.exists()) {
      throw new Error(`${type} not found`);
    }
    const itemData = itemSnapshot.data();
    await deleteDoc(itemDoc);
    //await deleteVector(itemData.userId, id, type);
    //console.log(
    //  `${type} ${id} deleted from Firebase and Pinecone for user ${itemData.userId}`
    //);
  } catch (error) {
    console.error(`Error deleting ${type}:`, error);
    throw error;
  }
};

const getItems = async (userId, type) => {
  const itemsCollection = collection(db, `${type}s`);
  const q = query(itemsCollection, where("userId", "==", userId));
  const itemSnapshot = await getDocs(q);
  return itemSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

// Specific functions for tasks and notes
const addTask = async (content, userId, additionalData = {}) => {
  return addItem(content, userId, "task", additionalData);
};
const updateTask = async (id, updates) => {
  await updateItem(id, updates, "task");
};
const deleteTask = (id) => deleteItem(id, "task");
const getTasks = (userId) => getItems(userId, "task");

const addNote = (content, userId) => addItem(content, userId, "note");
//const updateNote = (id, updates) => updateItem(id, updates, "note");
const deleteNote = (id) => deleteItem(id, "note");
const getNotes = (userId) => getItems(userId, "note");

const getBookmarks = async (userId) => {
  const bookmarksCollection = collection(db, "bookmarks");
  const q = query(bookmarksCollection, where("userId", "==", userId));
  const bookmarkSnapshot = await getDocs(q);
  return bookmarkSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

const addBookmark = async (url, title, image, userId) => {
  const bookmarksCollection = collection(db, "bookmarks");
  const bookmarkData = {
    url,
    title,
    image,
    userId,
    indexedInPinecone: false,
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
  try {
    const bookmarkRef = doc(db, "bookmarks", id);
    const bookmarkDoc = await getDoc(bookmarkRef);

    if (bookmarkDoc.exists()) {
      const bookmarkData = bookmarkDoc.data();
      const url = bookmarkData.url;

      // Delete the bookmark from Firebase
      await deleteDoc(bookmarkRef);
      console.log(`Bookmark deleted from Firebase with ID: ${id}`);

    } else {
      console.log(`Bookmark with ID ${id} not found`);
    }
  } catch (error) {
    console.error("Error in deleteBookmark function:", error);
    throw error;
  }
};

const updateBookmark = async (id, updates) => {
  const bookmarkRef = doc(db, 'bookmarks', id);
  await updateDoc(bookmarkRef, updates);
};

const signup = async (email, password, displayName) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );
    const user = userCredential.user;

    // Store user info in Firestore
    await setDoc(doc(db, "users", user.uid), {
      email: user.email,
      displayName: displayName,
    });

    console.log("User signed up successfully");
  } catch (error) {
    console.error("Error signing up:", error);
    throw error;
  }
};

const login = async (email, password) => {
  await signInWithEmailAndPassword(auth, email, password);
};

const logout = async () => {
  await signOut(auth);
};

const updateAnalytics = async (userId, analyticsData) => {
  try {
    const analyticsRef = doc(db, 'analytics', userId);
    await setDoc(analyticsRef, analyticsData, { merge: true });
    console.log("Analytics updated successfully for user:", userId);
  } catch (error) {
    console.error("Error updating analytics:", error);
    throw error;
  }
};

const getAnalytics = async (userId) => {
  try {
    const analyticsRef = doc(db, 'analytics', userId);
    const docSnap = await getDoc(analyticsRef);
    if (docSnap.exists()) {
      return docSnap.data();
    } else {
      console.log("No analytics found for user:", userId);
      return {};
    }
  } catch (error) {
    console.error("Error getting analytics:", error);
    throw error;
  }
};

// Document functions
const addDocument = async (title, content, userId) => {
  const timestamp = new Date();
  return addItem(title, userId, "document", { 
    content, 
    createdAt: timestamp,
    updatedAt: timestamp
  });
};

const updateDocument = async (id, updates) => {
  const updatesWithTimestamp = {
    ...updates,
    updatedAt: new Date()
  };
  await updateItem(id, updatesWithTimestamp, "document");
};

const deleteDocument = (id) => deleteItem(id, "document");

const getDocuments = async (userId) => {
  const documentsCollection = collection(db, "documents");
  const q = query(documentsCollection, where("userId", "==", userId));
  const documentSnapshot = await getDocs(q);
  return documentSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

const queryPinecone = httpsCallable(functions, 'queryPinecone');
const analyzeContent = httpsCallable(functions, 'analyzeContent');

export { db, getTasks, addTask, updateTask, deleteTask, getNotes, addNote, deleteNote, getBookmarks, addBookmark, deleteBookmark,
  updateBookmark, signup, login, logout, auth, onAuthStateChanged, queryPinecone, analyzeContent, updateAnalytics, getAnalytics,
  addDocument, updateDocument, deleteDocument, getDocuments };

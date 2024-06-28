import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, addDoc, deleteDoc, doc, query, where, setDoc, updateDoc, getDoc } from 'firebase/firestore'; // Ensure updateDoc and deleteDoc are imported
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, setPersistence, browserLocalPersistence, onAuthStateChanged } from 'firebase/auth';
import { deleteVector, indexContent, updateVector } from './pineconeService';

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

const addItem = async (content, userId, type) => {
  const collectionRef = collection(db, `${type}s`);
  try {
    const docRef = await addDoc(collectionRef, {
      title: content,
      content: content,
      createdAt: new Date(),
      userId,
      ...(type === 'task' ? { completed: false, timerSeconds: 1500, timerActive: false } : {})
    });
    await indexContent(userId, content, type, docRef.id);
    console.log(`${type} added to Firebase and indexed in Pinecone with ID: ${docRef.id}`);
    return docRef.id;
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

    if (updates.title) {
      updates.content = updates.title;
    }

    await updateDoc(itemDoc, updates);

    if ((updates.content || updates.title) &&
        (updates.content !== currentItem.content || updates.title !== currentItem.title)) {
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
    await deleteVector(itemData.userId, id, type);
    console.log(`${type} ${id} deleted from Firebase and Pinecone for user ${itemData.userId}`);
  } catch (error) {
    console.error(`Error deleting ${type}:`, error);
    throw error;
  }
};

const getItems = async (userId, type) => {
  const itemsCollection = collection(db, `${type}s`);
  const q = query(itemsCollection, where("userId", "==", userId));
  const itemSnapshot = await getDocs(q);
  return itemSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};


// Specific functions for tasks and notes
const addTask = (content, userId) => addItem(content, userId, 'task');
const updateTask = (id, updates) => updateItem(id, updates, 'task');
const deleteTask = (id) => deleteItem(id, 'task');
const getTasks = (userId) => getItems(userId, 'task');

const addNote = (content, userId) => addItem(content, userId, 'note');
const updateNote = (id, updates) => updateItem(id, updates, 'note');
const deleteNote = (id) => deleteItem(id, 'note');
const getNotes = (userId) => getItems(userId, 'note');

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

const signup = async (email, password, displayName) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Store user info in Firestore
    await setDoc(doc(db, 'users', user.uid), {
      email: user.email,
      displayName: displayName
    });

    console.log('User signed up successfully');
  } catch (error) {
    console.error('Error signing up:', error);
    throw error;
  }
};;

const login = async (email, password) => {
  await signInWithEmailAndPassword(auth, email, password);
};

const logout = async () => {
  await signOut(auth);
};

export { db, getTasks, addTask, updateTask, deleteTask, getNotes, addNote, deleteNote, getBookmarks, addBookmark, deleteBookmark, signup, login, logout, auth, onAuthStateChanged };

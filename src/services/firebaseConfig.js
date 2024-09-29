import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, addDoc, deleteDoc, doc, query, where, setDoc, updateDoc, getDoc } from "firebase/firestore";
import { updateVector } from "./pineconeService";
import { getFunctions, httpsCallable } from 'firebase/functions';
import formatUrl from '../utils/urlFormatter';

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
const functions = getFunctions(app);

// AI Response functions
const addAIResponse = async (userId, projectId, content) => {
  const aiResponsesCollection = collection(db, "aiResponses");
  try {
    const docRef = await addDoc(aiResponsesCollection, {
      content,
      userId,
      projectId,
      createdAt: new Date(),
      included: false,
    });
    console.log(`AI Response added with ID: ${docRef.id}`);
    return { id: docRef.id, content, createdAt: new Date(), included: false };
  } catch (error) {
    console.error("Error adding AI Response:", error);
    throw error;
  }
};

const getAIResponses = async (userId, projectId) => {
  const aiResponsesCollection = collection(db, "aiResponses");
  const q = query(aiResponsesCollection, where("userId", "==", userId), where("projectId", "==", projectId));
  const aiResponseSnapshot = await getDocs(q);
  return aiResponseSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

const deleteAIResponse = async (id) => {
  const aiResponseDoc = doc(db, "aiResponses", id);
  try {
    await deleteDoc(aiResponseDoc);
    console.log(`AI Response ${id} deleted from Firebase`);
  } catch (error) {
    console.error("Error deleting AI Response:", error);
    throw error;
  }
};

const updateAIResponse = async (id, updates) => {
  const aiResponseDoc = doc(db, "aiResponses", id);
  try {
    await updateDoc(aiResponseDoc, updates);
    console.log(`AI Response ${id} updated in Firebase`);
  } catch (error) {
    console.error("Error updating AI Response:", error);
    throw error;
  }
};

// Project-related functions
const createProject = async (userId, projectName) => {
  const projectsCollection = collection(db, "projects");
  try {
    const docRef = await addDoc(projectsCollection, {
      name: projectName,
      userId,
      createdAt: new Date(),
    });
    console.log(`Project created with ID: ${docRef.id}`);
    return { id: docRef.id, name: projectName, userId, createdAt: new Date() };
  } catch (error) {
    console.error("Error creating project:", error);
    throw error;
  }
};

const updateProject = async (projectId, updates) => {
  const projectRef = doc(db, "projects", projectId);
  try {
    await updateDoc(projectRef, updates);
    console.log(`Project ${projectId} updated successfully`);
  } catch (error) {
    console.error("Error updating project:", error);
    throw error;
  }
};

const getUserProjects = async (userId) => {
  const projectsCollection = collection(db, "projects");
  const q = query(projectsCollection, where("userId", "==", userId));
  const projectSnapshot = await getDocs(q);
  return projectSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

// Generic add item function
const addItem = async (content, userId, projectId, type, additionalData = {}) => {
  const collectionRef = collection(db, `${type}s`);
  try {
    const docRef = await addDoc(collectionRef, {
      title: content,
      content: content,
      createdAt: new Date(),
      userId,
      projectId,
      indexedInPinecone: false,
      ...(type === "task"
        ? { 
            completed: false, 
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

    return {
      id: docRef.id,
      title: content,
      content: content,
      createdAt: new Date(),
      userId,
      projectId,
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

// Generic get items function
const getItems = async (userId, projectId, type) => {
  const itemsCollection = collection(db, `${type}s`);
  const q = query(itemsCollection, where("userId", "==", userId), where("projectId", "==", projectId));
  const itemSnapshot = await getDocs(q);
  return itemSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

// Generic update item function
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

// Generic delete item function
const deleteItem = async (id, type) => {
  const itemDoc = doc(db, `${type}s`, id);
  try {
    const itemSnapshot = await getDoc(itemDoc);
    if (!itemSnapshot.exists()) {
      throw new Error(`${type} not found`);
    }
    const itemData = itemSnapshot.data();
    await deleteDoc(itemDoc);
    console.log(`${type} ${id} deleted from Firebase for user ${itemData.userId}`);
  } catch (error) {
    console.error(`Error deleting ${type}:`, error);
    throw error;
  }
};

// Task-specific functions
const addTask = async (content, userId, projectId, additionalData = {}) => {
  const availableColors = [
    "#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A", "#98D8C8",
    "#F7DC6F", "#BB8FCE", "#82E0AA", "#F1948A", "#85C1E9"
  ];
  
  const existingTasks = await getTasks(userId, projectId);
  const usedColors = existingTasks.map(task => task.color).filter(Boolean);
  const availableColorPool = availableColors.filter(color => !usedColors.includes(color));

  let color = "#CCCCCC"; // Default color if all colors are used
  if (availableColorPool.length > 0) {
    const randomIndex = Math.floor(Math.random() * availableColorPool.length);
    color = availableColorPool[randomIndex];
  }

  return addItem(content, userId, projectId, "task", { ...additionalData, color });
};

const updateTask = async (id, updates) => updateItem(id, updates, "task");
const deleteTask = (id) => deleteItem(id, "task");
const getTasks = async (userId, projectId) => getItems(userId, projectId, "task");

// Note-specific functions
const addNote = (content, userId, projectId) => addItem(content, userId, projectId, "note");
const deleteNote = (id) => deleteItem(id, "note");
const getNotes = (userId, projectId) => getItems(userId, projectId, "note");

// Bookmark-specific functions
const getBookmarks = async (userId, projectId) => getItems(userId, projectId, "bookmark");

const addBookmark = async (url, title, image, userId, projectId) => {
  const bookmarksCollection = collection(db, "bookmarks");
  const formattedUrl = formatUrl(url, window.location.hostname);
  const bookmarkData = {
    url: formattedUrl,
    title,
    image,
    userId,
    projectId,
    indexedInPinecone: false,
  };

  console.log("Attempting to add bookmark with data:", bookmarkData);

  try {
    const docRef = await addDoc(bookmarksCollection, bookmarkData);
    console.log("Bookmark added to database:", bookmarkData);
    return { id: docRef.id, ...bookmarkData };
  } catch (error) {
    console.error("Error adding bookmark:", error);
    throw error;
  }
};

const deleteBookmark = (id) => deleteItem(id, "bookmark");
const updateBookmark = async (id, updates) => updateItem(id, updates, "bookmark");

// Document-specific functions
const addDocument = async (title, content, userId, projectId) => {
  const timestamp = new Date();
  return addItem(title, userId, projectId, "document", { 
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
const getDocuments = async (userId, projectId) => getItems(userId, projectId, "document");

// Analytics functions
const updateAnalytics = async (userId, projectId, analyticsData) => {
  try {
    const analyticsRef = doc(db, 'analytics', `${userId}_${projectId}`);
    await setDoc(analyticsRef, analyticsData, { merge: true });
    console.log("Analytics updated successfully for user:", userId, "and project:", projectId);
  } catch (error) {
    console.error("Error updating analytics:", error);
    throw error;
  }
};

const getAnalytics = async (userId, projectId) => {
  try {
    const analyticsRef = doc(db, 'analytics', `${userId}_${projectId}`);
    const docSnap = await getDoc(analyticsRef);
    if (docSnap.exists()) {
      return docSnap.data();
    } else {
      console.log("No analytics found for user:", userId, "and project:", projectId);
      return {};
    }
  } catch (error) {
    console.error("Error getting analytics:", error);
    throw error;
  }
};

const setLastAccessedProject = async (userId, projectId) => {
  try {
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, { lastAccessedProject: projectId });
    console.log("Last accessed project updated for user:", userId);
  } catch (error) {
    console.error("Error updating last accessed project:", error);
    throw error;
  }
};

const getLastAccessedProject = async (userId) => {
  try {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      return userSnap.data().lastAccessedProject;
    }
    return null;
  } catch (error) {
    console.error("Error getting last accessed project:", error);
    throw error;
  }
};

// Cloud functions
const queryPinecone = httpsCallable(functions, 'queryPinecone');
const analyzeContent = httpsCallable(functions, 'analyzeContent');

export { 
  db, 
  createProject,
  updateProject,
  getUserProjects, 
  getTasks, 
  addTask, 
  updateTask, 
  deleteTask, 
  getNotes, 
  addNote, 
  deleteNote, 
  getBookmarks, 
  addBookmark, 
  deleteBookmark,
  updateBookmark, 
  queryPinecone, 
  analyzeContent, 
  updateAnalytics, 
  getAnalytics,
  addDocument, 
  updateDocument, 
  deleteDocument, 
  getDocuments,
  setLastAccessedProject,
  getLastAccessedProject,
  addAIResponse,
  getAIResponses,
  deleteAIResponse,
  updateAIResponse
};
// synapseService.js
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  orderBy,
} from "firebase/firestore";
import { db } from "./firebaseConfig";

// Create a new synapse
export const createSynapse = async (userId, projectId, name) => {
  const synapsesCollection = collection(db, "synapses");
  try {
    const docRef = await addDoc(synapsesCollection, {
      name,
      userId,
      projectId,
      createdAt: new Date(),
      updatedAt: new Date(),
      connections: [],
    });
    return {
      id: docRef.id,
      name,
      userId,
      projectId,
      createdAt: new Date(),
      updatedAt: new Date(),
      connections: [],
    };
  } catch (error) {
    console.error("Error creating synapse:", error);
    throw error;
  }
};

// Get all synapses for a project
export const getSynapses = async (userId, projectId) => {
  const synapsesCollection = collection(db, "synapses");
  const q = query(
    synapsesCollection,
    where("userId", "==", userId),
    where("projectId", "==", projectId),
    orderBy("createdAt", "desc")
  );

  try {
    const synapseSnapshot = await getDocs(q);
    return synapseSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt.toDate(),
      updatedAt: doc.data().updatedAt.toDate(),
    }));
  } catch (error) {
    console.error("Error getting synapses:", error);
    throw error;
  }
};

// Update a synapse's connections
export const updateSynapseConnections = async (synapseId, connections) => {
  const synapseRef = doc(db, "synapses", synapseId);
  try {
    await updateDoc(synapseRef, {
      connections,
      updatedAt: new Date(),
    });
  } catch (error) {
    console.error("Error updating synapse connections:", error);
    throw error;
  }
};

// Delete a synapse
export const deleteSynapse = async (synapseId) => {
  const synapseRef = doc(db, "synapses", synapseId);
  try {
    await deleteDoc(synapseRef);
  } catch (error) {
    console.error("Error deleting synapse:", error);
    throw error;
  }
};

// Get items for synapse creation (with pagination)
export const getItemsForSynapse = async (
  userId,
  projectId,
  itemType,
  page = 1,
  itemsPerPage = 10
) => {
  const startIndex = (page - 1) * itemsPerPage;
  const itemsCollection = collection(db, `${itemType}s`);

  // Create query based on item type
  const q =
    itemType === "bookmark"
      ? query(
          itemsCollection,
          where("userId", "==", userId),
          where("projectId", "==", projectId)
        )
      : query(
          itemsCollection,
          where("userId", "==", userId),
          where("projectId", "==", projectId),
          orderBy("createdAt", "desc")
        );

  try {
    const snapshot = await getDocs(q);
    console.log(
      "Raw snapshot data:",
      snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
    );

    const allItems = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        type: itemType,
        title:
          itemType === "bookmark" ? data.title : data.title || data.content,
        content: itemType === "bookmark" ? data.url : data.content,
        ...data,
      };
    });

    const paginatedItems = allItems.slice(
      startIndex,
      startIndex + itemsPerPage
    );
    const totalPages = Math.ceil(allItems.length / itemsPerPage);

    return {
      items: paginatedItems,
      totalPages,
      currentPage: page,
    };
  } catch (error) {
    console.error(`Error getting ${itemType}s:`, error);
    throw error;
  }
};

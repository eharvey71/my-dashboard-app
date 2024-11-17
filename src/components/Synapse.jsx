import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import { Plus, X, Save, Tag, Trash2, Check } from "lucide-react";
import {
  createSynapse,
  getSynapses,
  updateSynapseConnections,
  getItemsForSynapse,
} from "../services/synapseService";
import styles from "./Synapse.module.css";

const itemTypes = [
  { value: "task", label: "Tasks" },
  { value: "bookmark", label: "Bookmarks" },
  { value: "note", label: "Quick Notes" },
  { value: "document", label: "Documents" },
];

export default function Synapse({ user }) {
  const { projectId } = useParams();
  const [synapses, setSynapses] = useState([]);
  const [selectedType, setSelectedType] = useState("");
  const [items, setItems] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [newSynapseName, setNewSynapseName] = useState("");
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [deletingConnection, setDeletingConnection] = useState(null);

  useEffect(() => {
    loadSynapses();
  }, [projectId]);

  useEffect(() => {
    if (selectedType) {
      loadItems();
    }
  }, [selectedType, currentPage]);

  const loadSynapses = async () => {
    try {
      const loadedSynapses = await getSynapses(user.uid, projectId);
      setSynapses(loadedSynapses);
    } catch (error) {
      console.error("Error loading synapses:", error);
    }
  };

  const loadItems = async () => {
    try {
      const result = await getItemsForSynapse(
        user.uid,
        projectId,
        selectedType,
        currentPage
      );
      console.log("Load Items Result:", {
        selectedType,
        result,
        items: result.items,
      });
      setItems(result.items);
      setTotalPages(result.totalPages);
      setCurrentPage(result.currentPage);
    } catch (error) {
      console.error("Error loading items:", error);
    }
  };

  const handleCreateSynapse = async () => {
    if (!newSynapseName.trim()) return;

    try {
      const newSynapse = await createSynapse(
        user.uid,
        projectId,
        newSynapseName
      );
      setSynapses([newSynapse, ...synapses]);
      setNewSynapseName("");
      setIsCreatingNew(false);
    } catch (error) {
      console.error("Error creating synapse:", error);
    }
  };

  const handleDeleteConnection = async (synapseId, connectionIndex) => {
    const synapse = synapses.find((s) => s.id === synapseId);
    if (!synapse) return;

    const updatedConnections = synapse.connections.filter(
      (_, index) => index !== connectionIndex
    );

    try {
      await updateSynapseConnections(synapseId, updatedConnections);
      setSynapses(
        synapses.map((s) =>
          s.id === synapseId ? { ...s, connections: updatedConnections } : s
        )
      );
    } catch (error) {
      console.error("Error deleting connection:", error);
    } finally {
      setDeletingConnection(null);
    }
  };

  const handleDragEnd = async (result) => {
    const { source, destination, draggableId } = result;

    // If dropped outside a droppable area
    if (!destination) return;

    // If dropped in the same place
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    )
      return;

    // Find the dragged item
    const draggedItem = items.find((item) => item.id === draggableId);
    if (!draggedItem) return;

    // Find the target synapse
    const targetSynapse = synapses.find(
      (s) => s.id === destination.droppableId
    );
    if (!targetSynapse) return;

    // Check if the item is already in the synapse
    const isAlreadyConnected = targetSynapse.connections.some(
      (conn) => conn.itemId === draggedItem.id && conn.itemType === selectedType
    );

    if (isAlreadyConnected) return;

    // Create new connection
    const newConnection = {
      itemId: draggedItem.id,
      itemType: selectedType,
      addedAt: new Date(),
      title: draggedItem.title || draggedItem.content, // Store the title/content for display
    };

    // Update the synapse with the new connection
    const updatedConnections = [...targetSynapse.connections, newConnection];

    try {
      await updateSynapseConnections(targetSynapse.id, updatedConnections);

      // Update local state
      setSynapses(
        synapses.map((s) =>
          s.id === targetSynapse.id
            ? { ...s, connections: updatedConnections }
            : s
        )
      );
    } catch (error) {
      console.error("Error updating synapse:", error);
    }
  };

  const renderPagination = () => {
    return (
      <div className="flex justify-center gap-2 mt-4">
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
          <button
            key={page}
            onClick={() => setCurrentPage(page)}
            className={`px-3 py-1 rounded ${
              currentPage === page
                ? "bg-blue-500 text-white"
                : "bg-gray-200 hover:bg-gray-300"
            }`}
          >
            {page}
          </button>
        ))}
      </div>
    );
  };

  const renderConnection = (connection, index, synapseId) => {
    const isDeleting =
      deletingConnection?.synapseId === synapseId &&
      deletingConnection?.connectionIndex === index;

    return (
      <div
        key={`${connection.itemId}-${index}`}
        className={`${styles.connectionItem} ${styles[connection.itemType]}`}
      >
        <Tag size={14} />
        {connection.title || connection.itemId}

        {isDeleting ? (
          <div className={styles.deleteConfirmation}>
            <button
              className={styles.confirmButton}
              onClick={() => handleDeleteConnection(synapseId, index)}
            >
              <Check size={14} /> Confirm
            </button>
            <button
              className={styles.cancelDeleteButton}
              onClick={() => setDeletingConnection(null)}
            >
              <X size={14} /> Cancel
            </button>
          </div>
        ) : (
          <button
            className={styles.deleteButton}
            onClick={() =>
              setDeletingConnection({ synapseId, connectionIndex: index })
            }
            title="Delete connection"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
    );
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>Synapses</h1>
          <button
            onClick={() => setIsCreatingNew(true)}
            className={styles.newSynapseButton}
          >
            <Plus size={20} /> Create New Synapse
          </button>
        </div>

        {isCreatingNew && (
          <div className={styles.createSynapseForm}>
            <div className={styles.formInputGroup}>
              <input
                type="text"
                value={newSynapseName}
                onChange={(e) => setNewSynapseName(e.target.value)}
                placeholder="Enter synapse name"
                className={styles.input}
              />
              <button
                onClick={handleCreateSynapse}
                className={`${styles.actionButton} ${styles.saveButton}`}
              >
                <Save size={20} /> Save
              </button>
              <button
                onClick={() => setIsCreatingNew(false)}
                className={`${styles.actionButton} ${styles.cancelButton}`}
              >
                <X size={20} /> Cancel
              </button>
            </div>
          </div>
        )}

        <div className={styles.grid}>
          <div className={styles.itemsList}>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className={styles.typeSelect}
            >
              <option value="">Select Type</option>
              {itemTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>

            {selectedType && (
              <Droppable droppableId="itemsList" isDropDisabled={true}>
                {(provided) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className={styles.draggableList}
                  >
                    {items.map((item, index) => (
                      <Draggable
                        key={item.id}
                        draggableId={item.id}
                        index={index}
                      >
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={styles.draggableItem}
                            style={{
                              ...provided.draggableProps.style,
                              opacity: snapshot.isDragging ? 0.8 : 1,
                            }}
                          >
                            <Tag size={16} className="mr-2" />
                            {item.title || item.content}
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            )}

            {selectedType && totalPages > 1 && (
              <div className={styles.pagination}>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`${styles.pageButton} ${
                        currentPage === page ? styles.active : ""
                      }`}
                    >
                      {page}
                    </button>
                  )
                )}
              </div>
            )}
          </div>

          <div>
            {synapses.map((synapse) => (
              <Droppable key={synapse.id} droppableId={synapse.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`${styles.synapseContainer} ${
                      snapshot.isDraggingOver ? styles.isDraggingOver : ""
                    }`}
                  >
                    <h3 className={styles.synapseTitle}>{synapse.name}</h3>
                    <div className={styles.connectionsList}>
                      {synapse.connections.map((connection, index) =>
                        renderConnection(connection, index, synapse.id)
                      )}
                    </div>
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            ))}
          </div>
        </div>
      </div>
    </DragDropContext>
  );
}

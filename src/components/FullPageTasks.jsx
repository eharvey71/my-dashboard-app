import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getTasks, addTask, deleteTask } from "../services/firebaseConfig";
import { getFunctions, httpsCallable } from "firebase/functions";
import Task from "./Task";
import moduleStyles from "./DashboardModule.module.css";
import styles from "./FullPageTasks.module.css";
import { 
  ListTodo, 
  FileText, 
  Save, 
  Trash2, 
  Archive, 
  AlertCircle 
} from "lucide-react";

const FullPageTasks = ({ user }) => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTask, setNewTask] = useState("");
  const [error, setError] = useState(null);
  const [showCompleted, setShowCompleted] = useState(true);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [convertTitle, setConvertTitle] = useState("Tasks Summary");
  const [archiveTasks, setArchiveTasks] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [conversionResult, setConversionResult] = useState(null);

  const fetchTasks = useCallback(async () => {
    if (!user || !projectId) return;
    try {
      const fetchedTasks = await getTasks(user.uid, projectId);
      setTasks(fetchedTasks);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      setLoading(false);
      setError("Failed to fetch tasks");
    }
  }, [user, projectId]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleAddTask = async () => {
    if (newTask.trim() === "") return;
    try {
      const addedTask = await addTask(newTask, user.uid, projectId);
      setTasks((prevTasks) => [addedTask, ...prevTasks]);
      setNewTask("");
    } catch (error) {
      console.error("Error adding task:", error);
      setError("Failed to add task");
    }
  };

  const handleTaskUpdate = async () => {
    await fetchTasks();
  };

  const handleTaskDelete = useCallback(async (taskId) => {
    try {
      await deleteTask(taskId);
      setTasks((prevTasks) => prevTasks.filter((task) => task.id !== taskId));
    } catch (error) {
      console.error("Error deleting task:", error);
      setError("Failed to delete task");
    }
  }, []);
  
  // Function to handle converting tasks to a document
  const handleConvertTasks = async () => {
    if (!user || !projectId) return;
    
    setIsConverting(true);
    setError(null);
    setConversionResult(null);
    
    try {
      const functions = getFunctions();
      const convertTasksToDocument = httpsCallable(
        functions,
        "convertTasksToDocument"
      );
      
      const result = await convertTasksToDocument({
        userId: user.uid,
        projectId,
        documentTitle: convertTitle,
        archiveTasks
      });
      
      setConversionResult(result.data);
      
      // If we archived tasks, refresh the task list
      if (archiveTasks) {
        fetchTasks();
      }
    } catch (error) {
      console.error("Error converting tasks to document:", error);
      setError("Failed to convert tasks to document. Please try again.");
    } finally {
      setIsConverting(false);
    }
  };

  if (loading) {
    return <div className={moduleStyles.loading}>Loading tasks...</div>;
  }

  const sortedTasks = [...tasks].sort((a, b) => {
    // First sort by completion status
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1;
    }
    
    // Then sort by priority
    if (a.priority !== b.priority) {
      // Lower numbers are higher priority
      if (!a.priority) return 1;
      if (!b.priority) return -1;
      return a.priority - b.priority;
    }
    
    // Finally sort by creation date
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  const filteredTasks = showCompleted 
    ? sortedTasks 
    : sortedTasks.filter(task => !task.completed);

  return (
    <div className="container mt-4">
      <div className={moduleStyles.container}>
        <div className={moduleStyles.header}>
          <h2 className={moduleStyles.title}>
            <ListTodo size={20} />
            <span>All Project Tasks</span>
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <label className="form-check form-switch" style={{ fontSize: '0.875rem', marginBottom: 0, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <input
                type="checkbox"
                checked={showCompleted}
                onChange={() => setShowCompleted(!showCompleted)}
                style={{ marginRight: '0.25rem' }}
              />
              Show Completed
            </label>
            
            <button
              className={`btn btn-outline-primary btn-sm d-flex align-items-center gap-1`}
              onClick={() => setShowConvertModal(true)}
              disabled={tasks.length === 0}
            >
              <FileText size={16} />
              <span>Convert to Document</span>
            </button>
          </div>
        </div>

        <div className={moduleStyles.inputGroup}>
          <input
            type="text"
            className={moduleStyles.input}
            placeholder="New Task"
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === "Enter") {
                handleAddTask();
              }
            }}
          />
          <button 
            className={`${moduleStyles.actionButton} ${moduleStyles.primaryButton}`}
            onClick={handleAddTask}
          >
            Add Task
          </button>
        </div>

        {error && <div className={moduleStyles.error}>{error}</div>}
        
        <ul className={moduleStyles.list}>
          {filteredTasks.length > 0 ? (
            filteredTasks.map((task) => (
              <Task
                key={task.id}
                task={task}
                onTaskUpdate={handleTaskUpdate}
                onTaskDelete={handleTaskDelete}
                isFullPage={true}
              />
            ))
          ) : (
            <div className={moduleStyles.emptyState}>
              {showCompleted 
                ? "No tasks yet. Add one above!" 
                : "No incomplete tasks. Great job!"}
            </div>
          )}
        </ul>

        {/* Convert to Document Modal */}
        {showConvertModal && (
          <div className="modal d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Convert Tasks to Document</h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => {
                      setShowConvertModal(false);
                      setConversionResult(null);
                      setError(null);
                    }}
                  ></button>
                </div>
                <div className="modal-body">
                  {!conversionResult ? (
                    <>
                      <p>
                        This will create a new document containing all your tasks, organized by status and priority.
                        The document will be formatted with markdown and will be available in your documents section.
                      </p>
                      <div className="mb-3">
                        <label htmlFor="documentTitle" className="form-label">
                          Document Title
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          id="documentTitle"
                          value={convertTitle}
                          onChange={(e) => setConvertTitle(e.target.value)}
                          disabled={isConverting}
                        />
                      </div>
                      <div className="form-check mb-3">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id="archiveCompleted"
                          checked={archiveTasks}
                          onChange={(e) => setArchiveTasks(e.target.checked)}
                          disabled={isConverting}
                        />
                        <label className="form-check-label" htmlFor="archiveCompleted">
                          Archive completed tasks after conversion
                        </label>
                      </div>
                      {error && (
                        <div className="alert alert-danger d-flex align-items-center" role="alert">
                          <AlertCircle size={20} className="me-2" />
                          {error}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center">
                      <div className="mb-4">
                        <div className="bg-success text-white rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style={{ width: '64px', height: '64px' }}>
                          <Save size={32} />
                        </div>
                        <h4>Conversion Successful!</h4>
                      </div>
                      <p>
                        Your tasks have been successfully converted to a document titled:
                        <strong className="d-block mt-2">{conversionResult.documentTitle}</strong>
                      </p>
                      {conversionResult.archivedCount > 0 && (
                        <p className="text-muted">
                          <Archive size={16} className="me-1" />
                          {conversionResult.archivedCount} tasks have been archived.
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <div className="modal-footer">
                  {!conversionResult ? (
                    <>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setShowConvertModal(false)}
                        disabled={isConverting}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary d-flex align-items-center gap-2"
                        onClick={handleConvertTasks}
                        disabled={isConverting}
                      >
                        {isConverting ? (
                          <>
                            <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                            Converting...
                          </>
                        ) : (
                          <>
                            <FileText size={16} />
                            Convert Tasks
                          </>
                        )}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => {
                          setShowConvertModal(false);
                          setConversionResult(null);
                        }}
                      >
                        Close
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary d-flex align-items-center gap-2"
                        onClick={() => {
                          setShowConvertModal(false);
                          setConversionResult(null);
                          navigate(`/project/${projectId}/documents/${conversionResult.documentId}`);
                        }}
                      >
                        <FileText size={16} />
                        View Document
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FullPageTasks;
import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { getTasks, addTask, deleteTask } from "../services/firebaseConfig";
import Task from "./Task";
import moduleStyles from "./DashboardModule.module.css";
import styles from "./FullPageTasks.module.css";
import { ListTodo } from "lucide-react";

const FullPageTasks = ({ user }) => {
  const { projectId } = useParams();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTask, setNewTask] = useState("");
  const [error, setError] = useState(null);
  const [showCompleted, setShowCompleted] = useState(true);

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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label className="form-check form-switch" style={{ fontSize: '0.875rem', marginBottom: 0, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <input
                type="checkbox"
                checked={showCompleted}
                onChange={() => setShowCompleted(!showCompleted)}
                style={{ marginRight: '0.25rem' }}
              />
              Show Completed
            </label>
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
      </div>
    </div>
  );
};

export default FullPageTasks;
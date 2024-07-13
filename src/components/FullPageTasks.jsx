import React, { useState, useEffect, useCallback } from "react";
import { getTasks, addTask, updateTask, deleteTask } from "../services/firebaseConfig";
import PomodoroTimer from "./PomodoroTimer";
import { Trash2, Check, X } from 'lucide-react';
import "./FullPageTasks.css";

const FullPageTask = ({ task, onTaskUpdate, onTaskDelete }) => {
  const [editTaskTitle, setEditTaskTitle] = useState(task.title || task.content);
  const [isEditing, setIsEditing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const handleToggleComplete = async () => {
    try {
      await updateTask(task.id, { completed: !task.completed });
      onTaskUpdate();
    } catch (error) {
      console.error("Error updating task:", error);
    }
  };

  const handleUpdateTask = () => {
    setIsEditing(true);
  };

  const handleSaveTask = async () => {
    try {
      await updateTask(task.id, { title: editTaskTitle });
      setIsEditing(false);
      onTaskUpdate();
    } catch (error) {
      console.error("Error saving task:", error);
    }
  };

  const handleDeleteClick = () => {
    setIsConfirmingDelete(true);
  };

  const handleConfirmDelete = () => {
    onTaskDelete(task.id);
    setIsConfirmingDelete(false);
  };

  const handleCancelDelete = () => {
    setIsConfirmingDelete(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSaveTask();
    }
  };

  return (
    <div 
      className={`full-page-task ${task.completed ? "completed" : ""}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setIsConfirmingDelete(false);
      }}
    >
      <div className="task-content">
        <input
          type="checkbox"
          checked={task.completed}
          onChange={handleToggleComplete}
          className="task-checkbox"
        />
        {isEditing ? (
          <input
            type="text"
            className="form-control"
            value={editTaskTitle}
            onChange={(e) => setEditTaskTitle(e.target.value)}
            onBlur={handleSaveTask}
            onKeyPress={handleKeyPress}
          />
        ) : (
          <span onClick={handleUpdateTask}>{task.title || task.content}</span>
        )}
        <button
          className="btn btn-sm btn-link text-danger delete-btn"
          onClick={handleDeleteClick}
          title="Delete task"
        >
          <Trash2 size={18} />
        </button>
      </div>
      {!task.completed && (
        <div className="task-timer">
          <PomodoroTimer
            taskId={task.id}
            initialSeconds={task.timerSeconds || 1500}
            isHovered={isHovered}
          />
        </div>
      )}
      {isConfirmingDelete && (
        <div className="delete-confirmation-overlay">
          <div className="delete-confirmation d-flex align-items-center justify-content-center">
            <span className="me-2">Confirm delete?</span>
            <button
              className="btn btn-sm btn-success me-1"
              onClick={handleConfirmDelete}
              title="Confirm delete"
            >
              <Check size={14} />
            </button>
            <button
              className="btn btn-sm btn-danger"
              onClick={handleCancelDelete}
              title="Cancel delete"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const FullPageTasks = ({ user }) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTask, setNewTask] = useState("");
  const [error, setError] = useState(null);

  const fetchTasks = useCallback(async () => {
    if (!user) return;
    try {
      const fetchedTasks = await getTasks(user.uid);
      setTasks(fetchedTasks);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      setLoading(false);
      setError("Failed to fetch tasks");
    }
  }, [user]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleAddTask = async () => {
    if (newTask.trim() === "") return;
    try {
      const addedTask = await addTask(newTask, user.uid);
      setTasks(prevTasks => [addedTask, ...prevTasks]);
      setNewTask('');
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
      setTasks(prevTasks => prevTasks.filter(task => task.id !== taskId));
    } catch (error) {
      console.error("Error deleting task:", error);
      setError("Failed to delete task");
    }
  }, []);

  if (loading) {
    return <div>Loading tasks...</div>;
  }

  return (
    <div className="container mt-4">
      <h1>All Tasks</h1>
      <div className="mb-3">
        <div className="input-group">
          <input
            type="text"
            className="form-control"
            placeholder="New Task"
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === "Enter") {
                handleAddTask();
              }
            }}
          />
          <button className="btn btn-primary" onClick={handleAddTask}>
            Add Task
          </button>
        </div>
      </div>
      {error && <p className="text-danger">{error}</p>}
      <div className="full-page-task-grid">
        {tasks
          .sort((a, b) => a.completed - b.completed)
          .map((task) => (
            <FullPageTask
              key={task.id}
              task={task}
              onTaskUpdate={handleTaskUpdate}
              onTaskDelete={handleTaskDelete}
            />
          ))}
      </div>
    </div>
  );
};

export default FullPageTasks;
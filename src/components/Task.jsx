import React, { useState, useRef, useEffect } from "react";
import { updateTask } from "../services/firebaseConfig";
import PomodoroTimer from "./PomodoroTimer";
import { Trash2, Check, X, ChevronDown } from "lucide-react";

const Task = ({ task, onTaskUpdate, onTaskDelete }) => {
  const [editTaskTitle, setEditTaskTitle] = useState(task.title || task.content);
  const [isEditing, setIsEditing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isEditing) {
      inputRef.current.focus();
    }
  }, [isEditing]);

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
    if (e.key === "Enter") {
      handleSaveTask();
    }
  };

  const handlePriorityChange = async (priority) => {
    try {
      await updateTask(task.id, { priority: priority });
      onTaskUpdate();
      setShowPriorityDropdown(false);
    } catch (error) {
      console.error("Error updating task priority:", error);
    }
  };

  return (
    <li
      className={`list-group-item ${task.completed ? "completed" : ""}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setIsConfirmingDelete(false);
        setShowPriorityDropdown(false);
      }}
    >
      <div className="task-row d-flex align-items-center position-relative">
        <div className="task-checkbox me-2">
          <input
            type="checkbox"
            checked={task.completed}
            onChange={handleToggleComplete}
          />
        </div>
        <div className="task-priority me-2" style={{ position: 'relative' }}>
          <button
            className="btn btn-sm btn-outline-secondary"
            onClick={() => setShowPriorityDropdown(!showPriorityDropdown)}
          >
            {task.priority !== undefined ? task.priority : <ChevronDown size={14} />}
          </button>
          {showPriorityDropdown && (
            <div className="priority-dropdown" style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              zIndex: 1000,
              backgroundColor: 'white',
              border: '1px solid #ced4da',
              borderRadius: '0.25rem',
              boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
            }}>
              {[1, 2, 3, 4, 5].map((priority) => (
                <button
                  key={priority}
                  className="btn btn-sm btn-link"
                  onClick={() => handlePriorityChange(priority)}
                >
                  {priority}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className={`task-content flex-grow-1 ${isHovered ? "hovered" : ""}`}>
          {isEditing ? (
            <input
              ref={inputRef}
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
        </div>
        <div className="task-actions">
          <button
            className="btn btn-sm btn-link text-danger"
            onClick={handleDeleteClick}
            title="Delete task"
          >
            <Trash2 size={18} />
          </button>
        </div>
        {!task.completed && (
          <div className="task-timer ms-2">
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
    </li>
  );
};

export default Task;
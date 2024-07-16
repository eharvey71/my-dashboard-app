import React, { useState, useRef, useEffect } from "react";
import { updateTask, addTask } from "../services/firebaseConfig";
import PomodoroTimer from "./PomodoroTimer";
import { Trash2, Check, X, ChevronDown, Repeat } from "lucide-react";

const Task = ({ task, onTaskUpdate, onTaskDelete, isFullPage = false }) => {
  const [editTaskTitle, setEditTaskTitle] = useState(task.title || task.content);
  const [isEditing, setIsEditing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [hoveredItem, setHoveredItem] = useState(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
  const [showRecurrenceDropdown, setShowRecurrenceDropdown] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isEditing) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleToggleComplete = async () => {
    try {
      await updateTask(task.id, { completed: !task.completed });
      if (task.isRecurring && !task.completed) {
        const nextDueDate = calculateNextDueDate(task.recurrencePattern, task.nextDueDate);
        if (nextDueDate) {
          await updateTask(task.id, { nextDueDate: nextDueDate.toISOString() });
          // Create a new instance of the recurring task
          const newTask = {
            ...task,
            completed: false,
            nextDueDate: nextDueDate.toISOString(),
          };
          delete newTask.id; // Remove the id so a new one is generated
          await addTask(newTask.title, task.userId, newTask);
        }
      }
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

  const handleRecurrenceChange = async (recurrencePattern) => {
    try {
      const nextDueDate = calculateNextDueDate(recurrencePattern, new Date());
      await updateTask(task.id, {
        isRecurring: !!recurrencePattern,
        recurrencePattern: recurrencePattern,
        nextDueDate: nextDueDate
      });
      onTaskUpdate();
      setShowRecurrenceDropdown(false);
    } catch (error) {
      console.error("Error updating task recurrence:", error);
    }
  };

  const calculateNextDueDate = (recurrencePattern, currentDate) => {
    const date = currentDate instanceof Date ? currentDate : new Date(currentDate);
    if (isNaN(date.getTime())) {
      console.error("Invalid date:", currentDate);
      return null;
    }
    switch (recurrencePattern) {
      case 'daily':
        date.setDate(date.getDate() + 1);
        break;
      case 'weekly':
        date.setDate(date.getDate() + 7);
        break;
      case 'monthly':
        date.setMonth(date.getMonth() + 1);
        break;
      default:
        return null;
    }
    return date;
  };

  const isOverdue = () => {
    if (task.nextDueDate) {
      const dueDate = new Date(task.nextDueDate);
      const now = new Date();
      return !task.completed && dueDate < now;
    }
    return false;
  };

  const taskClasses = `list-group-item ${task.completed ? "completed" : ""} ${isOverdue() ? "task-overdue" : ""}`;

  const getPriorityStyle = (priority) => {
    const colors = {
      1: 'rgba(255, 204, 203, 0.5)', // Light Red
      2: 'rgba(255, 218, 185, 0.5)', // Light Orange
      3: 'rgba(255, 250, 205, 0.5)', // Light Yellow
      4: 'rgba(144, 238, 144, 0.5)', // Light Green
      5: 'rgba(173, 216, 230, 0.5)', // Light Blue
    };
    return { backgroundColor: colors[priority] || 'transparent' };
  };

  const getRecurringStyle = (pattern) => {
    const isRecurring = task.recurrencePattern && task.recurrencePattern !== 'none';
    
    // Style for the main button
    if (!pattern) {
      return isRecurring ? { backgroundColor: 'rgba(230, 230, 250, 0.8)' } : {};
    }
    
    // Style for dropdown items
    if (hoveredItem === pattern) {
      return dropdownHoverStyle;
    }
    
    return task.recurrencePattern === pattern ? 
      { backgroundColor: 'rgba(230, 230, 250, 0.8)' } : 
      {};
  };

  const dropdownHoverStyle = {
    backgroundColor: '#e9ecef', // Light grey background
    color: '#495057' // Dark grey text
  };

  return (
    <li
      className={taskClasses}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setIsConfirmingDelete(false);
        setShowPriorityDropdown(false);
        setShowRecurrenceDropdown(false);
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
            style={getPriorityStyle(task.priority)}
            onClick={() => setShowPriorityDropdown(!showPriorityDropdown)}
          >
            {task.priority !== undefined ? task.priority : <ChevronDown size={14} />}
          </button>
          {showPriorityDropdown && (
            <div className="priority-dropdown">
              {[1, 2, 3, 4, 5].map((priority) => (
                <button
                  key={priority}
                  className="btn btn-sm btn-outline-secondary"
                  style={hoveredItem === priority ? dropdownHoverStyle : getPriorityStyle(priority)}
                  onClick={() => handlePriorityChange(priority)}
                  onMouseEnter={() => setHoveredItem(priority)}
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  {priority}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="task-recurrence me-2" style={{ position: 'relative' }}>
          <button
            className="btn btn-sm btn-outline-secondary"
            style={getRecurringStyle()}
            onClick={() => setShowRecurrenceDropdown(!showRecurrenceDropdown)}
          >
            <Repeat size={14} />
          </button>
          {showRecurrenceDropdown && (
            <div className="recurrence-dropdown">
              {['none', 'daily', 'weekly', 'monthly'].map((pattern) => (
                <button
                  key={pattern}
                  className="btn btn-sm btn-outline-secondary"
                  style={getRecurringStyle(pattern)}
                  onClick={() => handleRecurrenceChange(pattern === 'none' ? null : pattern)}
                  onMouseEnter={() => setHoveredItem(pattern)}
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  {pattern}
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
            <span onClick={handleUpdateTask}>
              {task.title || task.content}
              {task.isRecurring && (
                <small className="text-muted ms-2">
                  ({task.recurrencePattern}, Next: {task.nextDueDate ? new Date(task.nextDueDate).toLocaleDateString() : 'Not set'})
                </small>
              )}
              {isOverdue() && <small className="text-danger ms-2">(Overdue)</small>}
            </span>
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
      {isFullPage && !task.completed && (
        <div className="task-timer ms-2">
          <PomodoroTimer
            taskId={task.id}
            initialSeconds={task.timerSeconds || 1500}
            isHovered={isHovered}
          />
        </div>
      )}
    </li>
  );
};

export default Task;
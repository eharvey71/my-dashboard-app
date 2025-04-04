import React, { useState, useRef, useEffect } from 'react';
import { updateTask } from "../services/firebaseConfig";
import { Trash2, Check, X, ChevronDown, Repeat, Folder } from "lucide-react";
import styles from './Task.module.css';
import projectStyles from './ProjectTaskItem.module.css';

const ProjectTaskItem = ({ task, projectName, onTaskUpdate, onTaskDelete }) => {
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

  const taskClasses = `list-group-item ${task.completed ? styles.completed : ""} ${isOverdue() ? styles.taskOverdue : ""}`;

  const getPriorityStyle = (priority) => {
    const colors = {
      1: 'rgba(255, 204, 203, 0.5)',
      2: 'rgba(255, 218, 185, 0.5)',
      3: 'rgba(255, 250, 205, 0.5)',
      4: 'rgba(144, 238, 144, 0.5)',
      5: 'rgba(173, 216, 230, 0.5)',
    };
    return { backgroundColor: colors[priority] || 'transparent' };
  };

  const getRecurringStyle = (pattern) => {
    const isRecurring = task.recurrencePattern && task.recurrencePattern !== 'none';
    
    if (!pattern) {
      return isRecurring ? { backgroundColor: 'rgba(230, 230, 250, 0.8)' } : {};
    }
    
    if (hoveredItem === pattern) {
      return { backgroundColor: '#e9ecef', color: '#495057' };
    }
    
    return task.recurrencePattern === pattern ? 
      { backgroundColor: 'rgba(230, 230, 250, 0.8)' } : 
      {};
  };

  return (
    <li
      className={taskClasses}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        // Only close dropdowns, but keep delete confirmation open if active
        setShowPriorityDropdown(false);
        setShowRecurrenceDropdown(false);
      }}
    >
      <div className={styles.taskRow}>
        <div className={styles.taskCheckbox}>
          <input
            type="checkbox"
            checked={task.completed}
            onChange={handleToggleComplete}
          />
        </div>
        <div className={styles.taskPriority}>
          <button
            className="btn btn-sm btn-outline-secondary"
            style={getPriorityStyle(task.priority)}
            onClick={() => setShowPriorityDropdown(!showPriorityDropdown)}
          >
            {task.priority !== undefined ? task.priority : <ChevronDown size={14} />}
          </button>
          {showPriorityDropdown && (
            <div className={styles.priorityDropdown}>
              {[1, 2, 3, 4, 5].map((priority) => (
                <button
                  key={priority}
                  className={`btn btn-sm btn-outline-secondary ${styles.dropdownButton}`}
                  style={getPriorityStyle(priority)}
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
        <div className={styles.taskRecurrence}>
          <button
            className="btn btn-sm btn-outline-secondary"
            style={getRecurringStyle()}
            onClick={() => setShowRecurrenceDropdown(!showRecurrenceDropdown)}
          >
            <Repeat size={14} />
          </button>
          {showRecurrenceDropdown && (
            <div className={styles.recurrenceDropdown}>
              {['none', 'daily', 'weekly', 'monthly'].map((pattern) => (
                <button
                  key={pattern}
                  className={`btn btn-sm btn-outline-secondary ${styles.dropdownButton}`}
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
        <div className={`${styles.taskContent} ${isHovered ? styles.hovered : ""}`}>
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
            <div className={projectStyles.taskContentWrapper}>
              <span 
                onClick={handleUpdateTask}
                className={`
                  ${task.completed ? styles.completedTask : ''}
                  ${isOverdue() ? styles.overdueTask : ''}
                `}
              >
                {task.title || task.content}
                {task.isRecurring && (
                  <small className="text-muted ms-2">
                    ({task.recurrencePattern}, Next: {task.nextDueDate ? new Date(task.nextDueDate).toLocaleDateString() : 'Not set'})
                  </small>
                )}
                {isOverdue() && <small className="text-danger ms-2">(Overdue)</small>}
              </span>
              <div className={projectStyles.projectBadge}>
                <Folder size={12} className={projectStyles.folderIcon} />
                <span>{projectName}</span>
              </div>
            </div>
          )}
        </div>
        <div className={styles.taskActions}>
          <button
            className="btn btn-sm btn-link text-danger"
            onClick={handleDeleteClick}
            title="Delete task"
          >
            <Trash2 size={18} />
          </button>
        </div>
        {isConfirmingDelete && (
          <div className={styles.deleteConfirmationOverlay}>
            <div className={styles.deleteConfirmation}>
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

export default ProjectTaskItem;
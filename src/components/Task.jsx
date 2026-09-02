import React, { useState, useRef, useEffect } from "react";
import { updateTask, addTask } from "../services/firebaseConfig";
import {
  Trash2, Check, X, ChevronDown, Repeat, Edit, Circle, CheckCircle
} from "lucide-react";
import { useEducation } from "../contexts/EducationContext";
import { useProjectContext } from "../contexts/ProjectContext";
import taskStyles from "./Task.module.css";
import moduleStyles from "./DashboardModule.module.css";

const Task = ({ task, onTaskUpdate, onTaskDelete, isFullPage = false }) => {
  const { getTerm } = useEducation();
  const { activeProjectType } = useProjectContext();
  const [editTaskTitle, setEditTaskTitle] = useState(task.title || task.content);
  const [isEditing, setIsEditing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [openDropdown, setOpenDropdown] = useState({ type: null });
  const inputRef = useRef(null);
  const priorityMenuRef = useRef(null);
  const recurrenceMenuRef = useRef(null);

  const styles = isFullPage ? taskStyles : moduleStyles;

  useEffect(() => {
    if (isEditing) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  // Handle clicks outside of dropdowns to close them
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openDropdown.type === 'priority' && 
          priorityMenuRef.current && 
          !priorityMenuRef.current.contains(event.target) && 
          !event.target.closest(`.${taskStyles.priorityButton}`)) {
        setOpenDropdown({ type: null });
      }
      
      if (openDropdown.type === 'recurrence' && 
          recurrenceMenuRef.current && 
          !recurrenceMenuRef.current.contains(event.target) && 
          !event.target.closest(`.${taskStyles.recurrenceButton}`)) {
        setOpenDropdown({ type: null });
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openDropdown]);

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
          await addTask(newTask.title, task.userId, task.projectId, newTask);
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
      setOpenDropdown({ type: null });
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
        nextDueDate: nextDueDate ? nextDueDate.toISOString() : null
      });
      onTaskUpdate();
      setOpenDropdown({ type: null });
    } catch (error) {
      console.error("Error updating task recurrence:", error);
    }
  };

  const calculateNextDueDate = (recurrencePattern, currentDate) => {
    const date = new Date(currentDate);
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
    if (!task.nextDueDate) return false;
    const dueDate = new Date(task.nextDueDate);
    const today = new Date();
    return dueDate < today && !task.completed;
  };

  // Helper to get priority color
  const getPriorityColor = (priority) => {
    switch (priority) {
      case 1: return '#f5222d'; // Red - Highest priority
      case 2: return '#fa8c16'; // Orange
      case 3: return '#faad14'; // Yellow
      case 4: return '#52c41a'; // Green
      case 5: return '#1890ff'; // Blue - Lowest priority
      default: return '#d9d9d9'; // Grey - No priority
    }
  };

  return (
    <li 
      className={`${moduleStyles.listItem} ${moduleStyles.taskItem} ${taskStyles.taskItem} ${isOverdue() ? taskStyles.overdueTask : ''} ${(openDropdown.type) ? taskStyles.activeTask : ''}`}
      style={{ 
        borderLeftColor: task.color || '#4299e1',
        opacity: task.completed ? 0.7 : 1,
        textDecoration: task.completed ? 'line-through' : 'none'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={moduleStyles.listItemContent}>
        {/* Checkbox */}
        <div className={taskStyles.taskCheckbox}>
          <input
            type="checkbox"
            checked={task.completed}
            onChange={handleToggleComplete}
            title={task.completed ? `Mark as incomplete` : `Mark as complete`}
          />
        </div>

        {/* Priority */}
        <div className={`${taskStyles.taskPriority} ${openDropdown.type === 'priority' ? taskStyles.activeDropdown : ''}`}>
          <button
            className={taskStyles.priorityButton}
            onClick={() => {
              if (openDropdown.type === 'priority') {
                setOpenDropdown({ type: null });
              } else {
                setOpenDropdown({ type: 'priority' });
              }
            }}
            title="Set priority"
            style={{ 
              backgroundColor: task.priority ? `${getPriorityColor(task.priority)}20` : 'transparent',
              color: task.priority ? getPriorityColor(task.priority) : '#6b7280',
              border: `1px solid ${task.priority ? getPriorityColor(task.priority) : '#d1d5db'}`
            }}
          >
            {task.priority || <ChevronDown size={14} />}
          </button>
          
          {openDropdown.type === 'priority' && (
            <div 
              className={taskStyles.priorityMenu}
              ref={priorityMenuRef}
              style={{
                position: 'absolute',
                top: '100%',
                left: '0',
                zIndex: 1050
              }}
            >
              {[1, 2, 3, 4, 5].map((priority) => (
                <button
                  key={priority}
                  className={taskStyles.priorityOption}
                  onClick={() => handlePriorityChange(priority)}
                  style={{ 
                    backgroundColor: `${getPriorityColor(priority)}20`,
                    color: getPriorityColor(priority)
                  }}
                >
                  {priority}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Recurrence */}
        <div className={`${taskStyles.taskRecurrence} ${openDropdown.type === 'recurrence' ? taskStyles.activeDropdown : ''}`}>
          <button
            className={taskStyles.recurrenceButton}
            onClick={() => {
              if (openDropdown.type === 'recurrence') {
                setOpenDropdown({ type: null });
              } else {
                setOpenDropdown({ type: 'recurrence' });
              }
            }}
            title={task.isRecurring ? `Recurring: ${task.recurrencePattern}` : "Set recurrence"}
            style={{ 
              backgroundColor: task.isRecurring ? 'rgba(79, 70, 229, 0.1)' : 'transparent',
              color: task.isRecurring ? '#4f46e5' : '#6b7280',
              border: `1px solid ${task.isRecurring ? '#4f46e5' : '#d1d5db'}`
            }}
          >
            <Repeat size={14} />
          </button>
          
          {openDropdown.type === 'recurrence' && (
            <div 
              className={taskStyles.recurrenceMenu}
              ref={recurrenceMenuRef}
              style={{
                position: 'absolute',
                top: '100%',
                left: '0',
                zIndex: 1050
              }}
            >
              <button 
                className={taskStyles.recurrenceOption}
                onClick={() => handleRecurrenceChange(null)}
                style={{ 
                  color: !task.isRecurring ? '#4f46e5' : '#6b7280',
                  fontWeight: !task.isRecurring ? '600' : 'normal'
                }}
              >
                None
              </button>
              {['daily', 'weekly', 'monthly'].map((pattern) => (
                <button
                  key={pattern}
                  className={taskStyles.recurrenceOption}
                  onClick={() => handleRecurrenceChange(pattern)}
                  style={{ 
                    color: task.recurrencePattern === pattern ? '#4f46e5' : '#6b7280',
                    fontWeight: task.recurrencePattern === pattern ? '600' : 'normal'
                  }}
                >
                  {pattern.charAt(0).toUpperCase() + pattern.slice(1)}
                </button>
              ))}
            </div>
          )}
        </div>
        
        {/* Title */}
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            className={moduleStyles.input}
            style={{ minWidth: 0, flex: 1 }}
            value={editTaskTitle}
            onChange={(e) => setEditTaskTitle(e.target.value)}
            onBlur={handleSaveTask}
            onKeyPress={handleKeyPress}
            autoFocus
          />
        ) : (
          <span 
            style={{ flex: 1, cursor: 'pointer' }} 
            onClick={handleUpdateTask}
          >
            {task.title || task.content}
            {task.isRecurring && (
              <small style={{ marginLeft: '0.5rem', color: '#6b7280', fontSize: '0.75rem' }}>
                ({task.recurrencePattern}, Next: {task.nextDueDate ? new Date(task.nextDueDate).toLocaleDateString() : 'Not set'})
              </small>
            )}
            {isOverdue() && !task.completed && (
              <span className={taskStyles.overdueBadge}>
                Overdue
              </span>
            )}
          </span>
        )}
      </div>
      
      {/* Actions */}
      <div className={moduleStyles.listItemActions}>
        {/* Edit button (only show when not editing) */}
        {!isEditing && (
          <button
            className={`${moduleStyles.iconButton} ${moduleStyles.editButton}`}
            onClick={handleUpdateTask}
            title={`Edit ${getTerm("task", activeProjectType).toLowerCase()}`}
          >
            <Edit size={16} />
          </button>
        )}
        
        {/* Delete button */}
        <button
          className={`${moduleStyles.iconButton} ${moduleStyles.deleteButton}`}
          onClick={handleDeleteClick}
          title={`Delete ${getTerm("task", activeProjectType).toLowerCase()}`}
        >
          <Trash2 size={16} />
        </button>
      </div>
      
      {/* Delete confirmation */}
      {isConfirmingDelete && (
        <div className={moduleStyles.deleteConfirmationOverlay}>
          <div className={moduleStyles.deleteConfirmation}>
            <span>Confirm delete?</span>
            <button
              className={moduleStyles.actionButton}
              style={{ backgroundColor: '#4ade80', color: 'white', padding: '0.25rem 0.5rem', margin: '0 0.25rem' }}
              onClick={handleConfirmDelete}
              title={`Yes, delete ${getTerm("task", activeProjectType).toLowerCase()}`}
            >
              <Check size={14} />
            </button>
            <button
              className={moduleStyles.actionButton}
              style={{ backgroundColor: '#f87171', color: 'white', padding: '0.25rem 0.5rem', margin: '0 0.25rem' }}
              onClick={handleCancelDelete}
              title="No, cancel"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </li>
  );
};

export default Task;
import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link } from 'react-router-dom';
import { getTasks, addTask, deleteTask, updateTask } from "../services/firebaseConfig";
import {
  CheckCircle, Circle, Trash2, Calendar, Check, X, ListTodo,
  ChevronDown, Repeat, Edit
} from "lucide-react";
import { useEducation } from "../contexts/EducationContext";
import styles from "./TaskList.module.css";
import moduleStyles from "./DashboardModule.module.css";

const TaskList = ({ user, projectId, limit = 5 }) => {
  const { getTerm } = useEducation();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTask, setNewTask] = useState("");
  const [error, setError] = useState(null);
  const [showCompleted, setShowCompleted] = useState(false);
  
  // Task editing states
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  
  // Dropdowns for priority and recurrence - will be managed per task
  const [openDropdown, setOpenDropdown] = useState({ type: null, taskId: null });
  
  // References for click outside detection
  const priorityMenuRef = useRef(null);
  const recurrenceMenuRef = useRef(null);

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
  
  // Handle clicks outside of dropdowns to close them
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openDropdown.type === 'priority' && 
          priorityMenuRef.current && 
          !priorityMenuRef.current.contains(event.target) && 
          !event.target.closest(`.${styles.priorityButton}`)) {
        setOpenDropdown({ type: null, taskId: null });
      }
      
      if (openDropdown.type === 'recurrence' && 
          recurrenceMenuRef.current && 
          !recurrenceMenuRef.current.contains(event.target) && 
          !event.target.closest(`.${styles.recurrenceButton}`)) {
        setOpenDropdown({ type: null, taskId: null });
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openDropdown]);

  const handleAddTask = async () => {
    if (newTask.trim() === "") return;
    try {
      const addedTask = await addTask(newTask, user.uid, projectId);
      setTasks(prevTasks => [addedTask, ...prevTasks]);
      setNewTask('');
    } catch (error) {
      console.error("Error adding task:", error);
      setError("Failed to add task");
    }
  };

  const handleTaskDelete = useCallback(async (taskId) => {
    try {
      await deleteTask(taskId);
      setTasks(prevTasks => prevTasks.filter(task => task.id !== taskId));
      setDeletingId(null);
    } catch (error) {
      console.error("Error deleting task:", error);
      setError("Failed to delete task");
    }
  }, []);

  const handleToggleComplete = async (task) => {
    try {
      await updateTask(task.id, { completed: !task.completed });
      setTasks(prevTasks => 
        prevTasks.map(t => 
          t.id === task.id ? { ...t, completed: !t.completed } : t
        )
      );
    } catch (error) {
      console.error("Error updating task:", error);
      setError("Failed to update task");
    }
  };
  
  const handleEdit = (task) => {
    setEditingId(task.id);
    setEditTitle(task.title);
  };

  const handleSaveEdit = async (id) => {
    try {
      await updateTask(id, { title: editTitle });
      setTasks(prevTasks => 
        prevTasks.map(t => 
          t.id === id ? { ...t, title: editTitle } : t
        )
      );
      setEditingId(null);
    } catch (error) {
      console.error("Error saving task:", error);
      setError("Failed to update task");
    }
  };
  
  const handlePriorityChange = async (taskId, priority) => {
    try {
      await updateTask(taskId, { priority });
      setTasks(prevTasks => 
        prevTasks.map(t => 
          t.id === taskId ? { ...t, priority } : t
        )
      );
      setOpenDropdown({ type: null, taskId: null });
    } catch (error) {
      console.error("Error updating priority:", error);
      setError("Failed to update priority");
    }
  };
  
  const handleRecurrenceChange = async (taskId, recurrencePattern) => {
    try {
      let updateData = {
        isRecurring: !!recurrencePattern,
        recurrencePattern: recurrencePattern,
      };
      
      if (recurrencePattern) {
        const nextDueDate = calculateNextDueDate(recurrencePattern, new Date());
        if (nextDueDate) {
          updateData.nextDueDate = nextDueDate.toISOString();
        }
      }
      
      await updateTask(taskId, updateData);
      setTasks(prevTasks => 
        prevTasks.map(t => 
          t.id === taskId ? { ...t, ...updateData } : t
        )
      );
      setOpenDropdown({ type: null, taskId: null });
    } catch (error) {
      console.error("Error updating recurrence:", error);
      setError("Failed to update recurrence");
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

  const isTaskOverdue = (task) => {
    if (!task.nextDueDate) return false;
    const dueDate = new Date(task.nextDueDate);
    const today = new Date();
    return dueDate < today && !task.completed;
  };

  if (loading) {
    return <div className={moduleStyles.loading}>Loading tasks...</div>;
  }

  const sortedTasks = [...tasks].sort((a, b) => {
    // First sort by completion status
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1;
    }
    
    // Then sort overdue tasks to the top (if not completed)
    const aOverdue = isTaskOverdue(a);
    const bOverdue = isTaskOverdue(b);
    if (aOverdue !== bOverdue) {
      return aOverdue ? -1 : 1;
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

  const filteredTasks = showCompleted ? sortedTasks : sortedTasks.filter(task => !task.completed);
  const displayedTasks = filteredTasks.slice(0, limit);
  const hasMoreTasks = filteredTasks.length > limit;
  
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
    <div className={moduleStyles.container}>
      <div className={moduleStyles.header}>
        <h2 className={moduleStyles.title}>
          <ListTodo size={20} />
          <span>{getTerm("tasks")}</span>
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

          <Link to={`/project/${projectId}/tasks`} className={moduleStyles.viewAllButton}>
            {getTerm("viewAllTasks")}
          </Link>
        </div>
      </div>

      <div className={moduleStyles.inputGroup}>
        <input
          type="text"
          className={moduleStyles.input}
          placeholder={`New ${getTerm("task")}`}
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

      <ul className={moduleStyles.list}>
        {displayedTasks.length > 0 ? (
          displayedTasks.map((task, index) => (
            <li 
              key={task.id} 
              className={`${moduleStyles.listItem} ${moduleStyles.taskItem} ${styles.taskItem} ${isTaskOverdue(task) ? styles.overdueTask : ''} ${(openDropdown.taskId === task.id) ? styles.activeTask : ''}`}
              style={{ 
                borderLeftColor: task.color || '#4299e1',
                opacity: task.completed ? 0.7 : 1,
                textDecoration: task.completed ? 'line-through' : 'none'
              }}
            >
              <div className={moduleStyles.listItemContent}>
                {/* Checkbox */}
                <button
                  className={moduleStyles.iconButton}
                  onClick={() => handleToggleComplete(task)}
                  title={task.completed ? "Mark as incomplete" : "Mark as complete"}
                >
                  {task.completed ? 
                    <CheckCircle size={20} /> :
                    <Circle size={20} />
                  }
                </button>
                
                {/* Title */}
                {editingId === task.id ? (
                  <input
                    type="text"
                    className={moduleStyles.input}
                    style={{ minWidth: 0, flex: 1 }}
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onBlur={() => handleSaveEdit(task.id)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSaveEdit(task.id)}
                    autoFocus
                  />
                ) : (
                  <span 
                    style={{ flex: 1, cursor: 'pointer' }} 
                    onClick={() => handleEdit(task)}
                  >
                    {task.title}
                    {task.isRecurring && (
                      <small style={{ marginLeft: '0.5rem', color: '#6b7280', fontSize: '0.75rem' }}>
                        ({task.recurrencePattern}, Next: {task.nextDueDate ? new Date(task.nextDueDate).toLocaleDateString() : 'Not set'})
                      </small>
                    )}
                    {isTaskOverdue(task) && !task.completed && (
                      <span className={styles.overdueBadge}>
                        Overdue
                      </span>
                    )}
                  </span>
                )}
                
                {/* Priority Button - Only show when not editing */}
                {editingId !== task.id && (
                  <div className={`${styles.priorityContainer} ${openDropdown.type === 'priority' && openDropdown.taskId === task.id ? styles.activeDropdown : ''}`}>
                    <button
                      className={styles.priorityButton}
                      onClick={() => {
                        if (openDropdown.type === 'priority' && openDropdown.taskId === task.id) {
                          setOpenDropdown({ type: null, taskId: null });
                        } else {
                          setOpenDropdown({ type: 'priority', taskId: task.id });
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
                    
                    {openDropdown.type === 'priority' && openDropdown.taskId === task.id && (
                      <div 
                        className={styles.priorityMenu}
                        ref={priorityMenuRef}
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: '0',
                        }}
                      >
                        {[1, 2, 3, 4, 5].map((priority) => (
                          <button
                            key={priority}
                            className={styles.priorityOption}
                            onClick={() => handlePriorityChange(task.id, priority)}
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
                )}
                
                {/* Recurrence Button - Only show when not editing */}
                {editingId !== task.id && (
                  <div className={`${styles.recurrenceContainer} ${openDropdown.type === 'recurrence' && openDropdown.taskId === task.id ? styles.activeDropdown : ''}`}>
                    <button
                      className={styles.recurrenceButton}
                      onClick={() => {
                        if (openDropdown.type === 'recurrence' && openDropdown.taskId === task.id) {
                          setOpenDropdown({ type: null, taskId: null });
                        } else {
                          setOpenDropdown({ type: 'recurrence', taskId: task.id });
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
                    
                    {openDropdown.type === 'recurrence' && openDropdown.taskId === task.id && (
                      <div 
                        className={styles.recurrenceMenu}
                        ref={recurrenceMenuRef}
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: '0',
                        }}
                      >
                        <button 
                          className={styles.recurrenceOption}
                          onClick={() => handleRecurrenceChange(task.id, null)}
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
                            className={styles.recurrenceOption}
                            onClick={() => handleRecurrenceChange(task.id, pattern)}
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
                )}
              </div>
              
              {/* Actions */}
              <div className={moduleStyles.listItemActions}>
                {/* Edit button (only show when not editing) */}
                {editingId !== task.id && (
                  <button 
                    className={`${moduleStyles.iconButton} ${moduleStyles.editButton}`}
                    onClick={() => handleEdit(task)}
                    title="Edit task"
                  >
                    <Edit size={16} />
                  </button>
                )}
                
                {/* Delete button */}
                <button 
                  className={`${moduleStyles.iconButton} ${moduleStyles.deleteButton}`}
                  onClick={() => setDeletingId(task.id)}
                  title="Delete task"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              
              {/* Delete confirmation */}
              {deletingId === task.id && (
                <div className={moduleStyles.deleteConfirmationOverlay}>
                  <div className={moduleStyles.deleteConfirmation}>
                    <span>Confirm delete?</span>
                    <button
                      className={moduleStyles.actionButton}
                      style={{ backgroundColor: '#4ade80', color: 'white', padding: '0.25rem 0.5rem', margin: '0 0.25rem' }}
                      onClick={() => handleTaskDelete(task.id)}
                      title="Yes, delete task"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      className={moduleStyles.actionButton}
                      style={{ backgroundColor: '#f87171', color: 'white', padding: '0.25rem 0.5rem', margin: '0 0.25rem' }}
                      onClick={() => setDeletingId(null)}
                      title="No, cancel"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))
        ) : (
          <div className={moduleStyles.emptyState}>
            {showCompleted 
              ? "No tasks yet. Add one above!" 
              : "No incomplete tasks. Great job!"}
          </div>
        )}
      </ul>
      
      {error && <p className={moduleStyles.error}>{error}</p>}
    </div>
  );
};

export default TaskList;
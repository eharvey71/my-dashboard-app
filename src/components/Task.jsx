import React, { useState, useRef, useEffect } from 'react';
import { updateTask, deleteTask } from '../services/firebaseConfig';
import PomodoroTimer from './PomodoroTimer';
import { Trash2 } from 'lucide-react';

const Task = ({ task, onTaskUpdate, onTaskDelete }) => {
  const [editTaskTitle, setEditTaskTitle] = useState(task.title || task.content);
  const [isEditing, setIsEditing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
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

  const handleDeleteTask = async () => {
    try {
      await deleteTask(task.id);
      onTaskDelete(task.id);
    } catch (error) {
      console.error("Error deleting task:", error);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSaveTask();
    }
  };

  return (
    <li
      className={`list-group-item ${task.completed ? "completed" : ""}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="task-row d-flex align-items-center">
        <div className="task-checkbox me-2">
          <input
            type="checkbox"
            checked={task.completed}
            onChange={handleToggleComplete}
          />
        </div>
        <div className="task-content flex-grow-1">
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
            onClick={handleDeleteTask}
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
      </div>
    </li>
  );
};

export default Task;
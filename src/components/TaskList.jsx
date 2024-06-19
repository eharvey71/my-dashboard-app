import React, { useState, useEffect } from 'react';
import { getTasks, addTask, updateTask, deleteTask } from '../services/firebaseConfig';
import PomodoroTimer from './PomodoroTimer';
import './TaskList.css';

const TaskList = ({ user }) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTask, setNewTask] = useState('');
  const [editTaskId, setEditTaskId] = useState(null);
  const [editTaskTitle, setEditTaskTitle] = useState('');
  const [hoveredTaskId, setHoveredTaskId] = useState(null);

  useEffect(() => {
    if (user) {
      const fetchTasks = async () => {
        try {
          const tasks = await getTasks(user.uid);
          setTasks(tasks);
          setLoading(false);
        } catch (error) {
          console.error("Error fetching tasks:", error);
          setLoading(false);
        }
      };

      fetchTasks();
    }
  }, [user]);

  const handleAddTask = async () => {
    if (newTask.trim() === '') return;
    try {
      await addTask(newTask, user.uid);
      const tasks = await getTasks(user.uid);
      setTasks(tasks);
      setNewTask('');
    } catch (error) {
      console.error("Error adding task:", error);
    }
  };

  const handleToggleComplete = async (id, completed) => {
    try {
      await updateTask(id, { completed: !completed });
      const tasks = await getTasks(user.uid);
      setTasks(tasks);
    } catch (error) {
      console.error("Error updating task:", error);
    }
  };

  const handleUpdateTask = (id) => {
    setEditTaskId(id);
    const task = tasks.find((task) => task.id === id);
    setEditTaskTitle(task.title);
  };

  const handleSaveTask = async (id) => {
    try {
      await updateTask(id, { title: editTaskTitle });
      const tasks = await getTasks(user.uid);
      setTasks(tasks);
      setEditTaskId(null);
      setEditTaskTitle('');
    } catch (error) {
      console.error("Error saving task:", error);
    }
  };

  const handleDeleteTask = async (id) => {
    try {
      await deleteTask(id);
      const tasks = await getTasks(user.uid);
      setTasks(tasks);
    } catch (error) {
      console.error("Error deleting task:", error);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container">
      <h2>Task List</h2>
      <div className="input-group mb-3">
        <input
          type="text"
          className="form-control"
          placeholder="New Task"
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              handleAddTask();
            }
          }}
        />
        <button className="btn btn-outline-secondary" onClick={handleAddTask}>Add Task</button>
      </div>
      <ul className="list-group">
        {tasks.sort((a, b) => a.completed - b.completed).map((task) => (
          <li
            key={task.id}
            className={`list-group-item ${task.completed ? 'completed' : ''}`}
            onMouseEnter={() => setHoveredTaskId(task.id)}
            onMouseLeave={() => setHoveredTaskId(null)}
          >
            <div className="task-row">
              <div className="task-details">
                {editTaskId === task.id ? (
                  <div className="task-edit">
                    <input
                      type="text"
                      className="form-control"
                      value={editTaskTitle}
                      onChange={(e) => setEditTaskTitle(e.target.value)}
                    />
                    <button className="btn btn-sm btn-outline-primary" onClick={() => handleSaveTask(task.id)}>Save</button>
                  </div>
                ) : (
                  <>
                    <span>{task.title}</span>
                    <div className={`task-actions ${hoveredTaskId === task.id ? 'visible' : ''}`}>
                      <button className="btn btn-sm btn-outline-secondary me-2" onClick={() => handleToggleComplete(task.id, task.completed)}>
                        {task.completed ? 'Undo' : 'Complete'}
                      </button>
                      {!task.completed && (
                        <button className="btn btn-sm btn-outline-primary me-2" onClick={() => handleUpdateTask(task.id)}>Update</button>
                      )}
                      <button className="btn btn-sm btn-outline-danger me-2" onClick={() => handleDeleteTask(task.id)}>Delete</button>
                    </div>
                  </>
                )}
              </div>
              {!task.completed && (
                <div className="task-timer">
                  <PomodoroTimer
                    taskId={task.id}
                    initialSeconds={task.timerSeconds || 1500}
                    isHovered={hoveredTaskId === task.id}
                  />
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TaskList;

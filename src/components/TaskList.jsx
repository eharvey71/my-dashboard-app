import React, { useState, useEffect, useCallback } from "react";
import { Link } from 'react-router-dom';
import { getTasks, addTask, deleteTask } from "../services/firebaseConfig";
import Task from "./Task";
import "./TaskList.css";

const TaskList = ({ user, limit = 5 }) => {
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
    return <div>Loading...</div>;
  }

/*   const sortedTasks = [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1;
    }
    return (a.priority || 5) - (b.priority || 5);
  }); */

  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1;
    }
    if (a.priority === undefined && b.priority === undefined) return 0;
    if (a.priority === undefined) return 1;
    if (b.priority === undefined) return -1;
    return a.priority - b.priority;
  });

  const displayedTasks = sortedTasks.slice(0, limit);
  const hasMoreTasks = tasks.length > limit;

  return (
    <div className="card task-list-card">
      <div className="card-body">
        <h2 className="card-title">Task List</h2>
        <div className="input-group mb-3">
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
          <button className="btn btn-outline-secondary" onClick={handleAddTask}>
            Add Task
          </button>
        </div>
        <ul className="list-group task-list">
          {displayedTasks.map((task) => (
            <Task
              key={task.id}
              task={task}
              onTaskUpdate={handleTaskUpdate}
              onTaskDelete={handleTaskDelete}
            />
          ))}
          {hasMoreTasks && (
            <div className="text-center mt-3">
              <Link to="/tasks" className="btn btn-link">View More</Link>
            </div>
          )}
        </ul>
        {error && <p className="text-danger">{error}</p>}
      </div>
    </div>
  );
};

export default TaskList;
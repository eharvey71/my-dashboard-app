import React, { useState, useEffect } from "react";
import { Link } from 'react-router-dom';
import { getTasks, addTask } from "../services/firebaseConfig";
import Task from "./Task";
import "./TaskList.css";

const TaskList = ({ user, limit = 5 }) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTask, setNewTask] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => {
    if (user) {
      fetchTasks();
    }
  }, [user]);

  const fetchTasks = async () => {
    try {
      const fetchedTasks = await getTasks(user.uid);
      setTasks(fetchedTasks);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      setLoading(false);
      setError("Failed to fetch tasks");
    }
  };

  const handleAddTask = async () => {
    if (newTask.trim() === "") return;
    try {
      await addTask(newTask, user.uid);
      await fetchTasks();
      setNewTask('');
    } catch (error) {
      console.error("Error adding task:", error);
      setError("Failed to add task");
    }
  };

  const handleTaskUpdate = async () => {
    await fetchTasks();
  };

  const handleTaskDelete = (taskId) => {
    setTasks(tasks.filter(task => task.id !== taskId));
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  const displayedTasks = tasks.slice(0, limit);
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
          {displayedTasks
            .sort((a, b) => a.completed - b.completed)
            .map((task) => (
              <Task
                key={task.id}
                task={task}
                onTaskUpdate={handleTaskUpdate}
                onTaskDelete={handleTaskDelete}
              />
            ))}
          {hasMoreTasks && (
            <li className="list-group-item text-center">
              <Link to="/tasks">View More</Link>
            </li>
          )}
        </ul>
        {error && <p className="text-danger">{error}</p>}
      </div>
    </div>
  );
};

export default TaskList;
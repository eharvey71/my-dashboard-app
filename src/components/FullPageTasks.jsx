import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { getTasks, addTask, deleteTask } from "../services/firebaseConfig";
import Task from "./Task";
import styles from "./FullPageTasks.module.css";

const FullPageTasks = ({ user }) => {
  const { projectId } = useParams();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTask, setNewTask] = useState("");
  const [error, setError] = useState(null);

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

  const handleAddTask = async () => {
    if (newTask.trim() === "") return;
    try {
      const addedTask = await addTask(newTask, user.uid, projectId);
      setTasks((prevTasks) => [addedTask, ...prevTasks]);
      setNewTask("");
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
      setTasks((prevTasks) => prevTasks.filter((task) => task.id !== taskId));
    } catch (error) {
      console.error("Error deleting task:", error);
      setError("Failed to delete task");
    }
  }, []);

  if (loading) {
    return <div>Loading tasks...</div>;
  }

  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1;
    }
    if (a.priority === undefined && b.priority === undefined) return 0;
    if (a.priority === undefined) return 1;
    if (b.priority === undefined) return -1;
    return a.priority - b.priority;
  });

  return (
    <div className="container mt-4">
      <h1>All Project Tasks</h1>
      <div className={`card ${styles.taskListCard}`}>
        <div className="card-body">
          <div className={`input-group ${styles.inputGroup}`}>
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
            <button
              className={`btn ${styles.btnOutlineSecondary}`}
              onClick={handleAddTask}
            >
              Add Task
            </button>
          </div>
          {error && <p className="text-danger">{error}</p>}
          <ul
            className={`list-group ${styles.taskList} ${styles.fullPageTaskGrid}`}
          >
            {sortedTasks.map((task) => (
              <Task
                key={task.id}
                task={task}
                onTaskUpdate={handleTaskUpdate}
                onTaskDelete={handleTaskDelete}
                isFullPage={true}
                styles={styles}
              />
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default FullPageTasks;

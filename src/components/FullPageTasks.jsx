import React, { useState, useEffect, useCallback } from "react";
import { getTasks, addTask, deleteTask } from "../services/firebaseConfig";
import Task from "./Task";
import "./FullPageTasks.css";

const FullPageTasks = ({ user }) => {
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

  /* const handleRecurrenceChange = async (taskId, recurrencePattern) => {
    try {
      await updateTask(taskId, { 
        isRecurring: !!recurrencePattern,
        recurrencePattern: recurrencePattern
      });
      await fetchTasks();
    } catch (error) {
      console.error("Error updating task recurrence:", error);
      setError("Failed to update task recurrence");
    }
  };

  const handleNextDueDateChange = async (taskId, nextDueDate) => {
    try {
      await updateTask(taskId, { nextDueDate: nextDueDate });
      await fetchTasks();
    } catch (error) {
      console.error("Error updating task next due date:", error);
      setError("Failed to update task next due date");
    }
  };
 */

  return (
    <div className="container mt-4">
      <h1>All Tasks</h1>
      <div className="card task-list-card">
        <div className="card-body">
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
          {error && <p className="text-danger">{error}</p>}
          <ul className="list-group task-list full-page-task-grid">
            {sortedTasks.map((task) => (
              <Task
                key={task.id}
                task={task}
                onTaskUpdate={handleTaskUpdate}
                onTaskDelete={handleTaskDelete}
                isFullPage={true}
              />
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default FullPageTasks;
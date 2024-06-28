import React, { useState, useEffect } from "react";
import {
  getTasks,
  addTask,
  updateTask,
  deleteTask,
} from "../services/firebaseConfig";
import PomodoroTimer from "./PomodoroTimer";
import "./TaskList.css";

const TaskList = ({ user }) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTask, setNewTask] = useState("");
  const [editTaskId, setEditTaskId] = useState(null);
  const [editTaskTitle, setEditTaskTitle] = useState("");
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
    if (newTask.trim() === "") return;
    try {
      await addTask(newTask, user.uid);
      const updatedTasks = await getTasks(user.uid);
      setTasks(updatedTasks);
      setNewTask('');
    } catch (error) {
      console.error("Error adding task:", error);
    }
  };

  const handleToggleComplete = async (id, completed) => {
    try {
      await updateTask(id, { completed: !completed });
      const updatedTasks = await getTasks(user.uid);
      setTasks(updatedTasks);
    } catch (error) {
      console.error("Error updating task:", error);
    }
  };

  const handleSaveTask = async (id) => {
    try {
      //console.log(`Saving task with ID ${id} and new title: ${editTaskTitle}`);
      await updateTask(id, { title: editTaskTitle });
      const updatedTasks = await getTasks(user.uid);
      setTasks(updatedTasks);
      setEditTaskId(null);
      setEditTaskTitle('');
    } catch (error) {
      console.error("Error saving task:", error);
      setError("Failed to update task");
    }
  };

  const handleDeleteTask = async (id) => {
    try {
      //console.log(`Deleting task with ID ${id}`);
      await deleteTask(id);
      const updatedTasks = await getTasks(user.uid);
      setTasks(updatedTasks);
      console.log(`Task with ID ${id} deleted`);
    } catch (error) {
      console.error("Error deleting task:", error);
      setError("Failed to delete task");
    }
  };

  const handleUpdateTask = (id) => {
    setEditTaskId(id);
    const task = tasks.find((task) => task.id === id);
    setEditTaskTitle(task.title);
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="card">
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
        <ul className="list-group">
          {tasks
            .sort((a, b) => a.completed - b.completed)
            .map((task) => (
              <li
                key={task.id}
                className={`list-group-item ${
                  task.completed ? "completed" : ""
                }`}
                onMouseEnter={() => setHoveredTaskId(task.id)}
                onMouseLeave={() => setHoveredTaskId(null)}
              >
                <div className="task-row d-flex justify-content-between">
                  <div className="task-details">
                    {editTaskId === task.id ? (
                      <div className="task-edit">
                        <input
                          type="text"
                          className="form-control"
                          value={editTaskTitle}
                          onChange={(e) => setEditTaskTitle(e.target.value)}
                        />
                        <button
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => handleSaveTask(task.id)}
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <>
                        <span>{task.title || task.content}</span>
                        <div
                          className={`task-actions ${
                            hoveredTaskId === task.id ? "visible" : ""
                          }`}
                        >
                          <button
                            className="btn btn-sm btn-outline-secondary me-2"
                            onClick={() =>
                              handleToggleComplete(task.id, task.completed)
                            }
                          >
                            {task.completed ? "Undo" : "Complete"}
                          </button>
                          {!task.completed && (
                            <button
                              className="btn btn-sm btn-outline-primary me-2"
                              onClick={() => handleUpdateTask(task.id)}
                            >
                              Update
                            </button>
                          )}
                          <button
                            className="btn btn-sm btn-outline-danger me-2"
                            onClick={() => handleDeleteTask(task.id)}
                          >
                            Delete
                          </button>
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
    </div>
  );
};

export default TaskList;

import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
  getTasks,
  updateAnalytics,
  getAnalytics,
} from "../services/firebaseConfig";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import styles from "./FocusTimer.module.css";

const FocusTimer = ({ user }) => {
  const { projectId } = useParams();
  const [tasks, setTasks] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [time, setTime] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [analytics, setAnalytics] = useState({});
  const [isTimerComplete, setIsTimerComplete] = useState(false);
  const [localAnalytics, setLocalAnalytics] = useState({});

  useEffect(() => {
    const fetchTasks = async () => {
      const fetchedTasks = await getTasks(user.uid, projectId);
      setTasks(fetchedTasks.filter((task) => !task.completed));
    };
    const fetchAnalytics = async () => {
      const fetchedAnalytics = await getAnalytics(user.uid, projectId);
      setAnalytics(fetchedAnalytics || {});
      setLocalAnalytics(fetchedAnalytics || {});
    };
    fetchTasks();
    fetchAnalytics();
  }, [user, projectId]);

  useEffect(() => {
    let interval = null;
    if (isActive && time > 0) {
      interval = setInterval(() => {
        setTime((time) => time - 1);
        if (selectedTask) {
          setLocalAnalytics((prev) => ({
            ...prev,
            [selectedTask.id]: (prev[selectedTask.id] || 0) + 1,
          }));
        }
      }, 1000);
    } else if (time === 0) {
      setIsActive(false);
      setIsTimerComplete(true);
      updateDatabaseAnalytics();
    }
    return () => clearInterval(interval);
  }, [isActive, time, selectedTask]);

  const updateDatabaseAnalytics = async () => {
    if (user && selectedTask) {
      await updateAnalytics(user.uid, projectId, localAnalytics);
      setAnalytics(localAnalytics);
    }
  };

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs > 0 ? hrs + "h " : ""}${mins > 0 ? mins + "m " : ""}${secs}s`;
  };

  const handleTaskClick = async (task) => {
    if (isActive) {
      await updateDatabaseAnalytics();
    }
    setSelectedTask(task);
    setIsActive(false);
    setTime(25 * 60);
    setIsTimerComplete(false);
  };

  const handleTimerOptionClick = async (minutes) => {
    if (isActive) {
      await updateDatabaseAnalytics();
    }
    setTime(minutes * 60);
    setIsActive(false);
    setIsTimerComplete(false);
  };

  const toggleTimer = async () => {
    if (isActive) {
      await updateDatabaseAnalytics();
    }
    setIsActive(!isActive);
    setIsTimerComplete(false);
  };

  const resetTimer = async () => {
    if (isActive) {
      await updateDatabaseAnalytics();
    }
    setIsActive(false);
    setTime(25 * 60);
    setIsTimerComplete(false);
  };

  const sortedAnalytics = Object.entries(analytics)
    .map(([taskId, seconds]) => {
      const task = tasks.find((t) => t.id === taskId);
      return {
        taskId,
        taskTitle: task?.title || "Unknown Task",
        time: seconds,
        color: task?.color || "#CCCCCC",
      };
    })
    .sort((a, b) => b.time - a.time);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className={styles.customTooltip}>
          <p className={styles.label}>{`${payload[0].payload.taskTitle}`}</p>
          <p className={styles.intro}>{`Time: ${formatTime(
            payload[0].value
          )}`}</p>
        </div>
      );
    }
    return null;
  };

  const renderPriorityIndicator = (priority) => {
    const indicators = {
      1: "!!!",
      2: "!!",
      3: "!",
      4: "",
      5: "",
    };
    return indicators[priority] || "";
  };

  return (
    <div className={styles.container}>
      <div className={styles.taskGrid}>
        {tasks.map((task) => (
          <div
            key={task.id}
            className={`${styles.taskItem} ${
              selectedTask && selectedTask.id === task.id ? styles.selected : ""
            }`}
            onClick={() => handleTaskClick(task)}
            style={{ backgroundColor: task.color || "#CCCCCC" }}
          >
            <span className={styles.priorityIndicator}>
              {renderPriorityIndicator(task.priority)}
            </span>
            {task.title}
          </div>
        ))}
      </div>
      <div className={styles.timerSection}>
        <div className={styles.timerControls}>
          <button onClick={toggleTimer}>{isActive ? "Pause" : "Start"}</button>
          <button onClick={resetTimer}>Reset</button>
        </div>
        <div
          className={`${styles.timerDisplay} ${
            isTimerComplete ? styles.timerComplete : ""
          }`}
        >
          {formatTime(time)}
        </div>
        {selectedTask && (
          <div className={styles.selectedTask}>
            Selected Task: <span>{selectedTask.title}</span>
          </div>
        )}
        <div className={styles.timerOptions}>
          <button onClick={() => handleTimerOptionClick(25)}>25 min</button>
          <button onClick={() => handleTimerOptionClick(15)}>15 min</button>
          <button onClick={() => handleTimerOptionClick(10)}>10 min</button>
          <button onClick={() => handleTimerOptionClick(5)}>5 min</button>
        </div>
      </div>
      <div className={styles.analyticsSection}>
        <h2>Analytics Dashboard</h2>
        <table className={styles.analyticsTable}>
          <thead>
            <tr>
              <th>Task</th>
              <th>Time Spent</th>
            </tr>
          </thead>
          <tbody>
            {sortedAnalytics.map(({ taskId, taskTitle, time, color }) => (
              <tr key={taskId}>
                <td>
                  <span
                    className={styles.colorIndicator}
                    style={{ backgroundColor: color }}
                  ></span>
                  {taskTitle}
                </td>
                <td>{formatTime(time)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className={styles.chartContainer}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={sortedAnalytics}>
              <XAxis dataKey="taskId" axisLine={false} tick={false} />
              <YAxis />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="time">
                {sortedAnalytics.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default FocusTimer;
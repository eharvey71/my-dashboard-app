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
import { useTimer } from "../contexts/TimerContext.jsx";
import styles from "./FocusTimer.module.css";

const TIME_OPTIONS = [
  { label: "5 minutes", value: 5 },
  { label: "10 minutes", value: 10 },
  { label: "15 minutes", value: 15 },
  { label: "25 minutes", value: 25 },
  { label: "30 minutes", value: 30 },
  { label: "45 minutes", value: 45 },
  { label: "60 minutes", value: 60 },
];

const FocusTimer = ({ user }) => {
  const { projectId } = useParams();
  const {
    activeTimer,
    remainingTime,
    setRemainingTime,
    startTimer,
    pauseTimer,
    resumeTimer,
    stopTimer,
    formatTime,
    elapsedSeconds,
  } = useTimer();

  const [tasks, setTasks] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedTime, setSelectedTime] = useState(25);
  const [analytics, setAnalytics] = useState({});
  const [lastUpdateTime, setLastUpdateTime] = useState(0);

  useEffect(() => {
    const fetchTasks = async () => {
      const fetchedTasks = await getTasks(user.uid, projectId);
      setTasks(fetchedTasks.filter((task) => !task.completed));

      if (activeTimer?.taskId) {
        const activeTask = fetchedTasks.find(
          (task) => task.id === activeTimer.taskId
        );
        if (activeTask) {
          setSelectedTask(activeTask);
        }
      }
    };

    const fetchAnalytics = async () => {
      const fetchedAnalytics = await getAnalytics(user.uid, projectId);
      setAnalytics(fetchedAnalytics || {});
    };

    fetchTasks();
    fetchAnalytics();
  }, [user, projectId, activeTimer?.taskId]);

  const updateDatabaseAnalytics = async (secondsToAdd) => {
    if (user && selectedTask && secondsToAdd > 0) {
      const currentAnalytics = await getAnalytics(user.uid, projectId);
      const updatedAnalytics = {
        ...currentAnalytics,
        [selectedTask.id]:
          (currentAnalytics[selectedTask.id] || 0) + secondsToAdd,
      };

      await updateAnalytics(user.uid, projectId, updatedAnalytics);
      setAnalytics(updatedAnalytics);
      setLastUpdateTime(elapsedSeconds);
    }
  };

  const handleTaskClick = (task) => {
    setSelectedTask(task);
  };

  const handleTimeChange = (event) => {
    const minutes = parseInt(event.target.value);
    setSelectedTime(minutes);
    setRemainingTime(minutes * 60);
  };

  const handleTimerControl = async () => {
    if (!selectedTask) return;

    if (!activeTimer) {
      startTimer(selectedTask, projectId, selectedTime);
      setLastUpdateTime(0);
    } else if (activeTimer.isActive) {
      const secondsSinceLastUpdate = elapsedSeconds - lastUpdateTime;
      await updateDatabaseAnalytics(secondsSinceLastUpdate);
      pauseTimer();
    } else {
      resumeTimer();
    }
  };

  const handleStopTimer = async () => {
    if (activeTimer) {
      const secondsSinceLastUpdate = elapsedSeconds - lastUpdateTime;
      if (secondsSinceLastUpdate > 0) {
        await updateDatabaseAnalytics(secondsSinceLastUpdate);
      }
    }
    stopTimer();
    setLastUpdateTime(0);
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

  return (
    <div className="container-fluid p-4">
      <div className="row">
        <div className="col-md-8">
          <div className="card mb-4">
            <div className="card-body">
              <h4 className="card-title mb-4">Tasks</h4>
              <div className={styles.taskGrid}>
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    className={`${styles.taskItem} ${
                      selectedTask?.id === task.id ? styles.selected : ""
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
            </div>
          </div>

          {selectedTask && (
            <div className="card">
              <div className="card-body text-center">
                <h5 className="card-title">Timer Controls</h5>
                {!activeTimer && (
                  <div className="mb-3">
                    <select
                      className="form-select form-select-lg w-auto mx-auto"
                      value={selectedTime}
                      onChange={handleTimeChange}
                      disabled={activeTimer}
                    >
                      {TIME_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className={styles.timerDisplay}>
                  {formatTime(remainingTime)}
                </div>
                <div className={styles.timerControls}>
                  <button
                    className={`btn ${
                      activeTimer?.isActive ? "btn-warning" : "btn-success"
                    } btn-lg mx-2`}
                    onClick={handleTimerControl}
                  >
                    {!activeTimer
                      ? "Start"
                      : activeTimer.isActive
                      ? "Pause"
                      : "Resume"}
                  </button>
                  {activeTimer && (
                    <button
                      className="btn btn-danger btn-lg mx-2"
                      onClick={handleStopTimer}
                    >
                      Stop
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="col-md-4">
          <div className="card">
            <div className="card-body">
              <h4 className="card-title mb-4">Analytics Dashboard</h4>
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
                        />
                        {taskTitle}
                      </td>
                      <td>{formatTime(time)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FocusTimer;

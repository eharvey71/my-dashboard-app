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
  const [showDeletedTasks, setShowDeletedTasks] = useState(false);
  const [showCompletedTasks, setShowCompletedTasks] = useState(false);
  const [sortBy, setSortBy] = useState('priority'); // priority, name, color

  useEffect(() => {
    const fetchTasks = async () => {
      const fetchedTasks = await getTasks(user.uid, projectId);
      
      // Filter tasks based on completed status toggle
      const filteredTasks = showCompletedTasks 
        ? fetchedTasks 
        : fetchedTasks.filter((task) => !task.completed);
        
      setTasks(filteredTasks);

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
  }, [user, projectId, activeTimer?.taskId, showCompletedTasks]);

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

  const handleTimerControl = () => {
    if (!selectedTask) return;

    if (!activeTimer) {
      startTimer(selectedTask, projectId, selectedTime, user.uid);
    } else if (activeTimer.isActive) {
      pauseTimer();
    } else {
      resumeTimer();
    }
  };

  const handleStopTimer = () => {
    stopTimer();
  };

  const renderPriorityIndicator = (priority) => {
    const indicators = {
      1: "P1",
      2: "P2",
      3: "P3",
      4: "P4",
      5: "P5",
    };
    return indicators[priority] || "-";
  };
  
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
  
  const sortTasks = (tasksToSort) => {
    return [...tasksToSort].sort((a, b) => {
      switch (sortBy) {
        case 'priority':
          // Sort by priority (lower number is higher priority)
          if (!a.priority) return 1;
          if (!b.priority) return -1;
          if (a.priority !== b.priority) {
            return a.priority - b.priority;
          }
          // If same priority, sort by title
          return a.title.localeCompare(b.title);
          
        case 'name':
          // Sort alphabetically by title
          return a.title.localeCompare(b.title);
          
        case 'color':
          // Sort by color
          if (!a.color) return 1;
          if (!b.color) return -1;
          return a.color.localeCompare(b.color);
          
        default:
          return 0;
      }
    });
  };

  const sortedAnalytics = Object.entries(analytics)
    // Filter out the deletedTaskInfo property, it's not a task entry
    .filter(([key]) => key !== 'deletedTaskInfo')
    .map(([taskId, seconds]) => {
      // Try to find the task in active tasks
      const task = tasks.find((t) => t.id === taskId);
      
      // If task exists, use its data
      if (task) {
        return {
          taskId,
          taskTitle: task.title,
          time: seconds,
          color: task.color || "#CCCCCC",
          isDeleted: false
        };
      }
      
      // If task doesn't exist but we have info in deletedTaskInfo, use that
      const deletedTaskInfo = analytics.deletedTaskInfo?.[taskId];
      if (deletedTaskInfo) {
        return {
          taskId,
          taskTitle: deletedTaskInfo.title || "Unknown Task",
          time: seconds,
          color: deletedTaskInfo.color || "#CCCCCC",
          isDeleted: true
        };
      }
      
      // Fall back to Unknown Task if no data found
      return {
        taskId,
        taskTitle: "Unknown Task",
        time: seconds,
        color: "#CCCCCC",
        isDeleted: true
      };
    })
    // If showDeletedTasks is false, filter out deleted tasks
    .filter(task => showDeletedTasks || !task.isDeleted)
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
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h4 className="card-title mb-0">Tasks</h4>
                <div className="d-flex align-items-center">
                  <div className="form-check form-switch me-3">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="showCompletedTasksSwitch"
                      checked={showCompletedTasks}
                      onChange={() => setShowCompletedTasks(!showCompletedTasks)}
                    />
                    <label className="form-check-label" htmlFor="showCompletedTasksSwitch" style={{ fontSize: '0.85rem' }}>
                      Show Completed
                    </label>
                  </div>
                  
                  <select 
                    className="form-select form-select-sm" 
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    style={{ width: 'auto', fontSize: '0.85rem' }}
                  >
                    <option value="priority">Sort by Priority</option>
                    <option value="name">Sort by Name</option>
                    <option value="color">Sort by Color</option>
                  </select>
                </div>
              </div>
              
              <div className={styles.taskGrid}>
                {sortTasks(tasks).map((task) => (
                  <div
                    key={task.id}
                    className={`${styles.taskItem} ${
                      selectedTask?.id === task.id ? styles.selected : ""
                    } ${task.completed ? styles.completedTask : ""}`}
                    onClick={() => handleTaskClick(task)}
                    style={{ 
                      backgroundColor: task.color || "#CCCCCC",
                      borderLeft: task.priority ? `5px solid ${getPriorityColor(task.priority)}` : '5px solid transparent'
                    }}
                  >
                    {task.priority && (
                      <div className={styles.priorityBadge} style={{ backgroundColor: getPriorityColor(task.priority) }}>
                        {renderPriorityIndicator(task.priority)}
                      </div>
                    )}
                    <div className={styles.taskContent}>
                      {task.title}
                      {task.completed && <span className={styles.completedBadge}>Completed</span>}
                    </div>
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
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h4 className="card-title mb-0">Focus Metrics</h4>
                <div className="d-flex flex-column" style={{ gap: '0.5rem' }}>
                  <div className="form-check form-switch">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="showDeletedTasksSwitch"
                      checked={showDeletedTasks}
                      onChange={() => setShowDeletedTasks(!showDeletedTasks)}
                    />
                    <label className="form-check-label" htmlFor="showDeletedTasksSwitch" style={{ fontSize: '0.85rem' }}>
                      Show Deleted Tasks
                    </label>
                  </div>
                  <div className="form-check form-switch">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="analyticsShowCompletedSwitch"
                      checked={showCompletedTasks}
                      onChange={() => setShowCompletedTasks(!showCompletedTasks)}
                    />
                    <label className="form-check-label" htmlFor="analyticsShowCompletedSwitch" style={{ fontSize: '0.85rem' }}>
                      Show Completed Tasks
                    </label>
                  </div>
                </div>
              </div>
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
                  {sortedAnalytics.map(({ taskId, taskTitle, time, color, isDeleted }) => (
                    <tr key={taskId} className={isDeleted ? styles.deletedTask : ''}>
                      <td>
                        <span
                          className={styles.colorIndicator}
                          style={{ backgroundColor: color }}
                        />
                        {taskTitle}
                        {isDeleted && <span className={styles.deletedTag}>(deleted)</span>}
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

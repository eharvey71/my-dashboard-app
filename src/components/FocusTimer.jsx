import React, { useState, useEffect } from 'react';
import { getTasks, updateAnalytics, getAnalytics } from '../services/firebaseConfig';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import styles from './FocusTimer.module.css';

const FocusTimer = ({ user }) => {
  const [tasks, setTasks] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [time, setTime] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [analytics, setAnalytics] = useState({});
  const [isTimerComplete, setIsTimerComplete] = useState(false);
  const [localAnalytics, setLocalAnalytics] = useState({});

  useEffect(() => {
    const fetchTasks = async () => {
      const fetchedTasks = await getTasks(user.uid);
      setTasks(fetchedTasks);
    };
    const fetchAnalytics = async () => {
      const fetchedAnalytics = await getAnalytics(user.uid);
      setAnalytics(fetchedAnalytics || {});
      setLocalAnalytics(fetchedAnalytics || {});
    };
    fetchTasks();
    fetchAnalytics();
  }, [user]);

  useEffect(() => {
    let interval = null;
    if (isActive && time > 0) {
      interval = setInterval(() => {
        setTime(time => time - 1);
        if (selectedTask) {
          setLocalAnalytics(prev => ({
            ...prev,
            [selectedTask.id]: (prev[selectedTask.id] || 0) + 1
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
      await updateAnalytics(user.uid, localAnalytics);
      setAnalytics(localAnalytics);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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
    .map(([taskId, seconds]) => ({
      taskId,
      taskTitle: tasks.find(t => t.id === taskId)?.title || 'Unknown Task',
      time: seconds
    }))
    .sort((a, b) => b.time - a.time);

  return (
    <div className={styles.container}>
      <div className={styles.taskGrid}>
        {tasks.map(task => (
          <div
            key={task.id}
            className={`${styles.taskItem} ${selectedTask && selectedTask.id === task.id ? styles.selected : ''}`}
            onClick={() => handleTaskClick(task)}
          >
            {task.title}
          </div>
        ))}
      </div>
      <div className={styles.timerSection}>
        <div className={`${styles.timerDisplay} ${isTimerComplete ? styles.timerComplete : ''}`}>
          {formatTime(time)}
        </div>
        <div className={styles.timerOptions}>
          <button onClick={() => handleTimerOptionClick(25)}>25 min</button>
          <button onClick={() => handleTimerOptionClick(15)}>15 min</button>
          <button onClick={() => handleTimerOptionClick(10)}>10 min</button>
          <button onClick={() => handleTimerOptionClick(5)}>5 min</button>
        </div>
        <div className={styles.timerControls}>
          <button onClick={toggleTimer}>{isActive ? 'Pause' : 'Start'}</button>
          <button onClick={resetTimer}>Reset</button>
        </div>
        {selectedTask && (
          <div className={styles.selectedTask}>
            Selected Task: {selectedTask.title}
          </div>
        )}
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
            {sortedAnalytics.map(({ taskId, taskTitle, time }) => (
              <tr key={taskId}>
                <td>{taskTitle}</td>
                <td>{formatTime(time)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className={styles.chartContainer}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={sortedAnalytics}>
              <XAxis dataKey="taskTitle" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="time" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default FocusTimer;
import React, { useState, useEffect } from 'react';
import { getAnalytics } from '../services/firebaseConfig';
import { getTasks } from '../services/firebaseConfig';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { useTimer } from '../contexts/TimerContext.jsx';
import { BarChart3 } from 'lucide-react';
import moduleStyles from './DashboardModule.module.css';
import styles from './FocusTimer.module.css';

const FocusMetrics = ({ user, projectId, limit = 5 }) => {
  const { formatTime } = useTimer();
  const [analytics, setAnalytics] = useState({});
  const [loading, setLoading] = useState(true);
  const [showDeletedTasks, setShowDeletedTasks] = useState(false);
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user || !projectId) return;
      
      try {
        const fetchedAnalytics = await getAnalytics(user.uid, projectId);
        setAnalytics(fetchedAnalytics || {});
        
        const fetchedTasks = await getTasks(user.uid, projectId);
        setTasks(fetchedTasks);
        
        setLoading(false);
      } catch (error) {
        console.error("Error fetching focus metrics:", error);
        setLoading(false);
      }
    };

    fetchData();
  }, [user, projectId]);

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
    .sort((a, b) => b.time - a.time)
    // Limit the number of tasks shown
    .slice(0, limit);

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

  if (loading) {
    return <div className={moduleStyles.loading}>Loading focus metrics...</div>;
  }

  return (
    <div className={moduleStyles.container}>
      <div className={moduleStyles.header}>
        <h2 className={moduleStyles.title}>
          <BarChart3 size={20} />
          <span>Focus Metrics</span>
        </h2>
        <div className="form-check form-switch" style={{ fontSize: '0.875rem' }}>
          <input
            className="form-check-input"
            type="checkbox"
            id="dashboardShowDeletedTasksSwitch"
            checked={showDeletedTasks}
            onChange={() => setShowDeletedTasks(!showDeletedTasks)}
          />
          <label className="form-check-label" htmlFor="dashboardShowDeletedTasksSwitch">
            Show Deleted Tasks
          </label>
        </div>
      </div>

      {sortedAnalytics.length > 0 ? (
        <>
          <div className={styles.chartContainer} style={{ height: '200px' }}>
            <ResponsiveContainer width="100%" height="100%">
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
        </>
      ) : (
        <div className={moduleStyles.emptyState}>
          No focus data yet. Use the timer to track time spent on tasks.
        </div>
      )}
    </div>
  );
};

export default FocusMetrics;
import React, { useState, useEffect } from 'react';
import { updateTask } from '../services/firebaseConfig';
import styles from './PomodoroTimer.module.css';

const PomodoroTimer = ({ taskId, initialSeconds, isHovered }) => {
  const [seconds, setSeconds] = useState(initialSeconds || 1500);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    let interval = null;
    if (isActive) {
      interval = setInterval(() => {
        setSeconds((seconds) => seconds - 1);
      }, 1000);
    } else if (!isActive && seconds !== 0) {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isActive, seconds]);

  const toggle = () => {
    setIsActive(!isActive);
    saveTimerState();
  };

  const reset = async () => {
    setSeconds(1500);
    setIsActive(false);
    await updateTask(taskId, { timerSeconds: 1500, timerActive: false });
  };

  const saveTimerState = async () => {
    await updateTask(taskId, { timerSeconds: seconds, timerActive: isActive });
  };

  if (seconds === 1500 && !isActive && !isHovered) {
    return null;
  }

  return (
    <div>
      <div className={styles.timer}>
        <span>{Math.floor(seconds / 60)}:{seconds % 60 < 10 ? '0' : ''}{seconds % 60}</span>
      </div>
      <button className={`btn btn-primary btn-sm ${styles.button}`} onClick={toggle}>
        {isActive ? 'Pause' : 'Start'}
      </button>
      <button className={`btn btn-secondary btn-sm ${styles.button}`} onClick={reset}>
        Reset
      </button>
    </div>
  );
};

export default PomodoroTimer;
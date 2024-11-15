// src/contexts/TimerContext.jsx
import React, { createContext, useContext, useState, useEffect } from "react";
import { updateAnalytics, getAnalytics } from "../services/firebaseConfig";

export const TimerContext = createContext(null);

export const useTimer = () => {
  const context = useContext(TimerContext);
  if (!context) {
    throw new Error("useTimer must be used within a TimerProvider");
  }
  return context;
};

export const TimerProvider = ({ children }) => {
  const [activeTimer, setActiveTimer] = useState(() => {
    const saved = localStorage.getItem("activeTimer");
    return saved ? JSON.parse(saved) : null;
  });

  const [remainingTime, setRemainingTime] = useState(() => {
    const saved = localStorage.getItem("remainingTime");
    return saved ? parseInt(saved) : 25 * 60;
  });

  const [elapsedSeconds, setElapsedSeconds] = useState(() => {
    const saved = localStorage.getItem("elapsedSeconds");
    return saved ? parseInt(saved) : 0;
  });

  const [lastUpdateTime, setLastUpdateTime] = useState(0);

  // Persist timer state to localStorage
  useEffect(() => {
    if (activeTimer) {
      localStorage.setItem("activeTimer", JSON.stringify(activeTimer));
      localStorage.setItem("elapsedSeconds", elapsedSeconds.toString());
    } else {
      localStorage.removeItem("activeTimer");
      localStorage.removeItem("elapsedSeconds");
    }
  }, [activeTimer, elapsedSeconds]);

  useEffect(() => {
    localStorage.setItem("remainingTime", remainingTime.toString());
  }, [remainingTime]);

  // Handle the countdown and elapsed time tracking
  useEffect(() => {
    let interval;
    if (activeTimer?.isActive) {
      interval = setInterval(() => {
        setRemainingTime((prev) => {
          if (prev <= 1) {
            stopTimer();
            return 0;
          }
          return prev - 1;
        });
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeTimer?.isActive]);

  const updateDatabaseAnalytics = async (secondsToAdd) => {
    if (activeTimer && secondsToAdd > 0) {
      const currentAnalytics = await getAnalytics(
        activeTimer.userId,
        activeTimer.projectId
      );
      const updatedAnalytics = {
        ...currentAnalytics,
        [activeTimer.taskId]:
          (currentAnalytics[activeTimer.taskId] || 0) + secondsToAdd,
      };

      await updateAnalytics(
        activeTimer.userId,
        activeTimer.projectId,
        updatedAnalytics
      );
      setLastUpdateTime(elapsedSeconds);
    }
  };

  const startTimer = (task, projectId, duration, userId) => {
    setActiveTimer({
      isActive: true,
      taskId: task.id,
      taskTitle: task.title,
      projectId,
      userId,
      duration,
    });
    setRemainingTime(duration * 60);
    setElapsedSeconds(0);
    setLastUpdateTime(0);
  };

  const pauseTimer = async () => {
    if (activeTimer?.isActive) {
      const secondsSinceLastUpdate = elapsedSeconds - lastUpdateTime;
      await updateDatabaseAnalytics(secondsSinceLastUpdate);
      setActiveTimer((prev) => ({
        ...prev,
        isActive: false,
      }));
    }
  };

  const resumeTimer = () => {
    if (activeTimer) {
      setActiveTimer((prev) => ({
        ...prev,
        isActive: true,
      }));
    }
  };

  const stopTimer = async () => {
    if (activeTimer) {
      const secondsSinceLastUpdate = elapsedSeconds - lastUpdateTime;
      if (secondsSinceLastUpdate > 0) {
        await updateDatabaseAnalytics(secondsSinceLastUpdate);
      }
      setActiveTimer(null);
      setRemainingTime(25 * 60);
      setElapsedSeconds(0);
      setLastUpdateTime(0);
    }
  };

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs > 0 ? `${hrs.toString().padStart(2, "0")}:` : ""}${mins
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <TimerContext.Provider
      value={{
        activeTimer,
        remainingTime,
        elapsedSeconds,
        setRemainingTime,
        startTimer,
        pauseTimer,
        resumeTimer,
        stopTimer,
        formatTime,
      }}
    >
      {children}
    </TimerContext.Provider>
  );
};

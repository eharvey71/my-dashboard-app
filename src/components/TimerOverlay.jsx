// src/components/TimerOverlay.jsx
import React, { useState, useEffect } from "react";
import { Timer, Pause, Play, Square } from "lucide-react";
import { useTimer } from "../contexts/TimerContext";
import { updateAnalytics, getAnalytics } from "../services/firebaseConfig";

const TimerOverlay = () => {
  const {
    activeTimer,
    remainingTime,
    formatTime,
    pauseTimer,
    resumeTimer,
    stopTimer,
    elapsedSeconds,
  } = useTimer();

  const [lastUpdateTime, setLastUpdateTime] = useState(0);

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

  const handlePauseResume = async () => {
    if (activeTimer.isActive) {
      const secondsSinceLastUpdate = elapsedSeconds - lastUpdateTime;
      await updateDatabaseAnalytics(secondsSinceLastUpdate);
      pauseTimer();
    } else {
      resumeTimer();
    }
  };

  const handleStop = async () => {
    if (activeTimer) {
      const secondsSinceLastUpdate = elapsedSeconds - lastUpdateTime;
      if (secondsSinceLastUpdate > 0) {
        await updateDatabaseAnalytics(secondsSinceLastUpdate);
      }
    }
    stopTimer();
    setLastUpdateTime(0);
  };

  // Reset lastUpdateTime when a new timer starts
  useEffect(() => {
    if (activeTimer?.isActive) {
      setLastUpdateTime(elapsedSeconds);
    }
  }, [activeTimer?.taskId]);

  if (!activeTimer) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-white rounded-lg shadow-lg p-3 border border-gray-200 min-w-[200px]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Timer size={16} className="text-blue-500" />
            <span
              className="text-sm font-medium truncate max-w-[120px]"
              title={activeTimer.taskTitle}
            >
              {activeTimer.taskTitle}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-2xl font-bold font-mono">
            {formatTime(remainingTime)}
          </span>

          <div className="flex gap-2">
            <button
              onClick={activeTimer.isActive ? pauseTimer : resumeTimer}
              className="p-1 rounded hover:bg-gray-100 transition-colors"
              title={activeTimer.isActive ? "Pause" : "Resume"}
            >
              {activeTimer.isActive ? (
                <Pause size={20} className="text-gray-600" />
              ) : (
                <Play size={20} className="text-green-600" />
              )}
            </button>

            <button
              onClick={stopTimer}
              className="p-1 rounded hover:bg-gray-100 transition-colors"
              title="Stop"
            >
              <Square size={20} className="text-red-600" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimerOverlay;

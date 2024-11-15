import React from "react";
import { Pause, Play, Square } from "lucide-react";
import { useTimer } from "../contexts/TimerContext";

const TimerOverlay = () => {
  const {
    activeTimer,
    remainingTime,
    formatTime,
    pauseTimer,
    resumeTimer,
    stopTimer,
  } = useTimer();

  if (!activeTimer) return null;

  const handlePauseResume = async () => {
    if (activeTimer.isActive) {
      await pauseTimer();
    } else {
      resumeTimer();
    }
  };

  const handleStop = async () => {
    await stopTimer();
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: "20px",
        right: "20px",
        backgroundColor: "white",
        padding: "12px",
        borderRadius: "8px",
        boxShadow: "0 2px 10px rgba(0, 0, 0, 0.1)",
        width: "220px",
        minHeight: "80px",
        zIndex: 9999,
        border: "1px solid #e2e8f0",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <div
        style={{
          fontSize: "13px",
          marginBottom: "8px",
          color: "#4a5568",
          lineHeight: "1.4",
          wordWrap: "break-word",
        }}
      >
        {activeTimer.taskTitle}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "auto",
        }}
      >
        <span
          style={{
            fontFamily: "monospace",
            fontWeight: "500",
            fontSize: "15px",
          }}
        >
          {formatTime(remainingTime)}
        </span>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={handlePauseResume}
            style={{
              border: "none",
              background: "none",
              cursor: "pointer",
              padding: "4px",
            }}
          >
            {activeTimer.isActive ? (
              <Pause size={18} color="#4a5568" />
            ) : (
              <Play size={18} color="#48bb78" />
            )}
          </button>
          <button
            onClick={handleStop}
            style={{
              border: "none",
              background: "none",
              cursor: "pointer",
              padding: "4px",
            }}
          >
            <Square size={18} color="#e53e3e" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TimerOverlay;

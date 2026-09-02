import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
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

  // Persist the timer itself only when it actually changes. This used to also
  // depend on elapsedSeconds, so a running timer re-serialised activeTimer to
  // localStorage every second even though it had not changed.
  useEffect(() => {
    if (activeTimer) {
      localStorage.setItem("activeTimer", JSON.stringify(activeTimer));
    } else {
      localStorage.removeItem("activeTimer");
      localStorage.removeItem("elapsedSeconds");
      localStorage.removeItem("remainingTime");
    }
  }, [activeTimer]);

  // Counters are persisted on a slow cadence rather than on every tick.
  // localStorage is synchronous and blocks the main thread; three writes a
  // second was enough to visibly starve rendering and network callbacks in
  // Safari, leaving the rest of the app stuck on its loading states while a
  // timer ran. Losing at most a few seconds of progress on a hard crash is a
  // fair trade - the counters are also flushed on pause, stop and page hide.
  const countersRef = useRef({ elapsedSeconds, remainingTime });
  countersRef.current = { elapsedSeconds, remainingTime };

  const flushCounters = useCallback(() => {
    const { elapsedSeconds: e, remainingTime: r } = countersRef.current;
    localStorage.setItem("elapsedSeconds", e.toString());
    localStorage.setItem("remainingTime", r.toString());
  }, []);

  useEffect(() => {
    if (!activeTimer?.isActive) return undefined;

    const interval = setInterval(flushCounters, 5000);
    window.addEventListener("pagehide", flushCounters);

    return () => {
      clearInterval(interval);
      window.removeEventListener("pagehide", flushCounters);
      flushCounters();
    };
  }, [activeTimer?.isActive, flushCounters]);

  // Handle the countdown and elapsed time tracking
  useEffect(() => {
    if (!activeTimer?.isActive) return undefined;

    const interval = setInterval(() => {
      // Updaters must stay pure - stopTimer() used to be called from inside
      // one, which fires a Firestore write during the render phase.
      setRemainingTime((prev) => (prev <= 1 ? 0 : prev - 1));
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [activeTimer?.isActive]);

  // Stop once the countdown reaches zero, from an effect rather than mid-update.
  useEffect(() => {
    if (activeTimer?.isActive && remainingTime === 0) {
      stopTimer();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingTime, activeTimer?.isActive]);

  const updateDatabaseAnalytics = async (secondsToAdd) => {
    if (activeTimer && secondsToAdd > 0) {
      try {
        console.log("Updating analytics with seconds:", secondsToAdd);
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
        console.log("Analytics updated successfully");
      } catch (error) {
        console.error("Error updating analytics:", error);
      }
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
      try {
        const secondsSinceLastUpdate = elapsedSeconds - lastUpdateTime;
        await updateDatabaseAnalytics(secondsSinceLastUpdate);
        setActiveTimer((prev) => ({
          ...prev,
          isActive: false,
        }));
        flushCounters();
      } catch (error) {
        console.error("Error in pauseTimer:", error);
      }
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
      try {
        const secondsSinceLastUpdate = elapsedSeconds - lastUpdateTime;
        if (secondsSinceLastUpdate > 0) {
          await updateDatabaseAnalytics(secondsSinceLastUpdate);
        }
        setActiveTimer(null);
        setRemainingTime(25 * 60);
        setElapsedSeconds(0);
        setLastUpdateTime(0);
      } catch (error) {
        console.error("Error in stopTimer:", error);
      }
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

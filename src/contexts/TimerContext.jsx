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

const DEFAULT_MINUTES = 25;
const STORAGE_KEY = "activeTimer";
const PREVIEW_KEY = "previewSeconds";

export const useTimer = () => {
  const context = useContext(TimerContext);
  if (!context) {
    throw new Error("useTimer must be used within a TimerProvider");
  }
  return context;
};

const readStored = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
};

// Elapsed time is derived from wall-clock timestamps rather than accumulated a
// tick at a time. Two things fall out of that: nothing has to be written to
// localStorage on every tick (three synchronous writes a second was enough to
// stall Safari), and the timer cannot drift when the browser throttles or
// suspends its interval in a background tab - on wake it simply reads the
// correct value from the clock.
//
// activeTimer.startedAt is when the current running segment began, and
// accumulatedMs is everything banked from segments before it. Pausing folds
// one into the other.
const elapsedMsOf = (timer) => {
  if (!timer) return 0;
  const banked = timer.accumulatedMs || 0;
  if (!timer.isActive || !timer.startedAt) return banked;
  return banked + Math.max(0, Date.now() - timer.startedAt);
};

export const TimerProvider = ({ children }) => {
  const [activeTimer, setActiveTimer] = useState(() =>
    readStored(STORAGE_KEY, null)
  );

  // The duration shown before a timer is started. Only meaningful when idle.
  const [previewSeconds, setPreviewSeconds] = useState(() =>
    readStored(PREVIEW_KEY, DEFAULT_MINUTES * 60)
  );

  // Forces a re-render once a second so the countdown display advances. It
  // holds no timer state of its own - everything real is derived below.
  const [, setTick] = useState(0);

  const [lastUpdateTime, setLastUpdateTime] = useState(0);

  const elapsedSeconds = Math.floor(elapsedMsOf(activeTimer) / 1000);
  const remainingTime = activeTimer
    ? Math.max(0, activeTimer.duration * 60 - elapsedSeconds)
    : previewSeconds;

  // Written only when the timer itself changes - start, pause, resume, stop.
  useEffect(() => {
    try {
      if (activeTimer) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(activeTimer));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Private mode or blocked storage: the timer still runs, it just will
      // not survive a reload.
    }
  }, [activeTimer]);

  useEffect(() => {
    try {
      localStorage.setItem(PREVIEW_KEY, JSON.stringify(previewSeconds));
    } catch {
      // As above.
    }
  }, [previewSeconds]);

  useEffect(() => {
    if (!activeTimer?.isActive) return undefined;

    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [activeTimer?.isActive]);

  // activeTimer is read inside async callbacks that would otherwise close over
  // a stale value.
  const timerRef = useRef(activeTimer);
  timerRef.current = activeTimer;

  const updateDatabaseAnalytics = useCallback(async (secondsToAdd) => {
    const timer = timerRef.current;
    if (!timer || secondsToAdd <= 0) return;

    try {
      const currentAnalytics = await getAnalytics(timer.userId, timer.projectId);
      await updateAnalytics(timer.userId, timer.projectId, {
        ...currentAnalytics,
        [timer.taskId]: (currentAnalytics[timer.taskId] || 0) + secondsToAdd,
      });
    } catch (error) {
      console.error("Error updating analytics:", error);
    }
  }, []);

  const startTimer = useCallback((task, projectId, duration, userId) => {
    setActiveTimer({
      isActive: true,
      taskId: task.id,
      taskTitle: task.title,
      projectId,
      userId,
      duration,
      startedAt: Date.now(),
      accumulatedMs: 0,
    });
    setLastUpdateTime(0);
  }, []);

  const pauseTimer = useCallback(async () => {
    const timer = timerRef.current;
    if (!timer?.isActive) return;

    const elapsed = Math.floor(elapsedMsOf(timer) / 1000);

    // Bank the running segment so the clock stops advancing.
    setActiveTimer({
      ...timer,
      isActive: false,
      accumulatedMs: elapsedMsOf(timer),
      startedAt: null,
    });

    await updateDatabaseAnalytics(elapsed - lastUpdateTime);
    setLastUpdateTime(elapsed);
  }, [lastUpdateTime, updateDatabaseAnalytics]);

  const resumeTimer = useCallback(() => {
    const timer = timerRef.current;
    if (!timer || timer.isActive) return;

    setActiveTimer({ ...timer, isActive: true, startedAt: Date.now() });
  }, []);

  const stopTimer = useCallback(async () => {
    const timer = timerRef.current;
    if (!timer) return;

    const elapsed = Math.floor(elapsedMsOf(timer) / 1000);

    setActiveTimer(null);
    setLastUpdateTime(0);

    await updateDatabaseAnalytics(elapsed - lastUpdateTime);
  }, [lastUpdateTime, updateDatabaseAnalytics]);

  // Stop when the countdown reaches zero. This runs from an effect rather than
  // from inside a state updater, which must stay pure.
  useEffect(() => {
    if (activeTimer?.isActive && remainingTime === 0) {
      stopTimer();
    }
  }, [activeTimer?.isActive, remainingTime, stopTimer]);

  const formatTime = useCallback((seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs > 0 ? `${hrs.toString().padStart(2, "0")}:` : ""}${mins
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }, []);

  return (
    <TimerContext.Provider
      value={{
        activeTimer,
        remainingTime,
        elapsedSeconds,
        // Sets the duration previewed before starting; ignored once a timer is
        // running, whose remaining time is derived from its own duration.
        setRemainingTime: setPreviewSeconds,
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

import { createContext, useContext, useState, useEffect } from "react";

export const TimerContext = createContext(null);

export const TimerProvider = ({ children }) => {
  const [activeTimer, setActiveTimer] = useState(() => {
    const saved = localStorage.getItem("activeTimer");
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    if (activeTimer) {
      localStorage.setItem("activeTimer", JSON.stringify(activeTimer));
    } else {
      localStorage.removeItem("activeTimer");
    }
  }, [activeTimer]);

  return (
    <TimerContext.Provider value={{ activeTimer, setActiveTimer }}>
      {children}
    </TimerContext.Provider>
  );
};

// src/components/TimeWidget.jsx
import React, { useState, useEffect } from "react";
import styles from "./TimeWidget.module.css";

const TimeWidget = ({ timezone }) => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formattedTime = time.toLocaleTimeString("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={styles.timeWidget}>
      <span className={styles.time}>{formattedTime}</span>
    </div>
  );
};

export default TimeWidget;

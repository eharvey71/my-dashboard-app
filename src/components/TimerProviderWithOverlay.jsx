// src/components/TimerProviderWithOverlay.jsx
import React from "react";
import { TimerProvider } from "../contexts/TimerContext";
import TimerOverlay from "./TimerOverlay";

const TimerProviderWithOverlay = ({ children }) => {
  return (
    <TimerProvider>
      {children}
      <TimerOverlay />
    </TimerProvider>
  );
};

export default TimerProviderWithOverlay;

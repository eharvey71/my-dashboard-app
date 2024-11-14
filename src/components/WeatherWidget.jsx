// WeatherWidget.jsx
import React, { useState, useEffect } from "react";
import styles from "./WeatherWidget.module.css";

const WeatherWidget = ({ city, unit }) => {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    const fetchWeather = async () => {
      if (!city) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true); // Set loading when starting new fetch
        const encodedCity = encodeURIComponent(city.replace(/, /g, "%2C"));
        const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodedCity}&units=${unit}&appid=${
          import.meta.env.VITE_WEATHER_API_KEY
        }`;

        console.log("Fetching weather with unit:", unit); // Debug log

        const response = await fetch(url, {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Weather API error: ${response.status}`);
        }

        const data = await response.json();
        console.log("Weather data received:", data); // Debug log
        setWeather(data);
      } catch (err) {
        if (err.name === "AbortError") {
          console.log("Weather request cancelled");
          return;
        }
        console.error("Weather error:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();
    return () => controller.abort();
  }, [city, unit]); // Ensure unit is in dependency array

  if (loading) return <div className={styles.weatherWidget}>Loading...</div>;
  if (error)
    return <div className={styles.weatherWidget}>Weather error: {error}</div>;
  if (!weather?.main?.temp) return null;

  const tempSymbol = unit === "metric" ? "°C" : "°F";
  const formattedTemp = `${Math.round(weather.main.temp)}${tempSymbol}`;
  const weatherIconUrl = `http://openweathermap.org/img/wn/${weather.weather[0].icon}@2x.png`;

  return (
    <div className={styles.weatherWidget}>
      <div className={styles.tempContainer}>
        <span className={styles.temp}>{formattedTemp}</span>
      </div>
      <div className={styles.iconContainer}>
        <img
          src={weatherIconUrl}
          alt={weather.weather[0].description}
          className={styles.weatherIcon}
        />
        <div className={styles.tooltip}>{weather.weather[0].description}</div>
      </div>
      <span className={styles.city}>{city}</span>
    </div>
  );
};

export default WeatherWidget;

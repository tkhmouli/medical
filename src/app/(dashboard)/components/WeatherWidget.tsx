'use client';

import { useState, useEffect, useRef } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface WeatherData {
  temperature: number;
  condition: string;
  icon: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const WEATHER_REFRESH_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

// ─── Component ──────────────────────────────────────────────────────────────

/**
 * WeatherWidget displays current weather conditions fetched from the
 * server-side weather API route. Data refreshes every 30 minutes.
 * Shows a fallback message when weather data is unavailable.
 *
 * Requirements: 9.1, 9.3, 9.4
 */
export default function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    async function fetchWeather() {
      try {
        const response = await fetch('/api/dashboard/weather');
        if (response.ok) {
          const json = await response.json();
          if (json.success && json.data) {
            setWeather(json.data);
            setError(false);
          } else {
            // API returned null data — weather unavailable
            setWeather(null);
            setError(true);
          }
        } else {
          setWeather(null);
          setError(true);
        }
      } catch {
        setWeather(null);
        setError(true);
      } finally {
        setLoading(false);
      }
    }

    // Fetch on mount
    fetchWeather();

    // Refresh every 30 minutes
    intervalRef.current = setInterval(fetchWeather, WEATHER_REFRESH_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="rounded-lg border border-sky-200 bg-sky-50 p-4">
        <p className="text-sm text-sky-700">Loading weather...</p>
      </div>
    );
  }

  // Error / fallback state
  if (error || !weather) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <p className="text-sm text-gray-600">Weather data unavailable</p>
      </div>
    );
  }

  // Success state
  return (
    <div className="flex items-center gap-3 rounded-lg border border-sky-200 bg-sky-50 p-4">
      <img
        src={`https://openweathermap.org/img/wn/${weather.icon}@2x.png`}
        alt={weather.condition}
        className="h-12 w-12"
      />
      <div>
        <p className="text-2xl font-bold text-sky-900">{weather.temperature}°C</p>
        <p className="mt-0.5 text-sm capitalize text-sky-700">{weather.condition}</p>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';

// ─── Pure Utility Functions ─────────────────────────────────────────────────

/**
 * Formats a Date into HH:MM string (24-hour format, zero-padded).
 * Requirements: 10.1
 */
export function formatTime(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Formats a Date into human-readable date string (e.g., "Monday, January 15").
 * Requirements: 10.2
 */
export function formatDate(date: Date): string {
  const days = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  const dayOfWeek = days[date.getDay()];
  const month = months[date.getMonth()];
  const dayNumber = date.getDate();

  return `${dayOfWeek}, ${month} ${dayNumber}`;
}

// ─── Component ──────────────────────────────────────────────────────────────

/**
 * TimeWidget displays the current local time (HH:MM) and date in a
 * human-readable format. Time updates every minute via setInterval.
 *
 * Requirements: 10.1, 10.2
 */
export default function TimeWidget() {
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 60_000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
      <p className="text-2xl font-bold text-blue-900">{formatTime(now)}</p>
      <p className="mt-1 text-sm text-blue-700">{formatDate(now)}</p>
    </div>
  );
}

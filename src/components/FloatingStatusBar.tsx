'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ─── Constants ──────────────────────────────────────────────────────────────

const POLLING_INTERVAL_MS = 60_000; // 60 seconds

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatTime(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

function formatDay(date: Date): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;
}

// ─── Component ──────────────────────────────────────────────────────────────

/**
 * FloatingStatusBar — a prominent panel fixed at the top of all dashboard pages.
 * Shows current time/day, waiting count, seen count, and theme switcher.
 * Polls the dashboard API every 30s for real-time data.
 */
export function FloatingStatusBar() {
  const [now, setNow] = useState<Date>(new Date());
  const [waitingCount, setWaitingCount] = useState<number>(0);
  const [seenCount, setSeenCount] = useState<number>(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clockRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/dashboard/stats');
      if (response.ok) {
        const json = await response.json();
        if (json.success && json.data && 'waitingCount' in json.data) {
          setWaitingCount(json.data.waitingCount);
          setSeenCount(json.data.seenCount);
        }
      }
    } catch {
      // Silently ignore polling errors
    }
  }, []);

  useEffect(() => {
    fetchStats();
    pollRef.current = setInterval(fetchStats, POLLING_INTERVAL_MS);
    clockRef.current = setInterval(() => setNow(new Date()), 30_000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (clockRef.current) clearInterval(clockRef.current);
    };
  }, [fetchStats]);

  return (
    <div className="sticky top-0 z-20 theme-status-bar border-b px-4 py-3 shadow-sm">
      <div className="flex items-center justify-between">
        {/* Time & Day */}
        <div className="flex items-center gap-3">
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold theme-text-primary">{formatTime(now)}</span>
            <span className="text-sm font-medium theme-text-secondary">{formatDay(now)}</span>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="flex items-center gap-6">
          {/* Waiting */}
          <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-1.5 border border-amber-200">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-sm font-semibold text-amber-800">{waitingCount}</span>
            <span className="text-xs text-amber-600">waiting</span>
          </div>

          {/* Seen */}
          <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-1.5 border border-green-200">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500" />
            <span className="text-sm font-semibold text-green-800">{seenCount}</span>
            <span className="text-xs text-green-600">seen today</span>
          </div>


        </div>
      </div>
    </div>
  );
}

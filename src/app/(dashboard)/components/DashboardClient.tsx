'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import StatusCounters from './StatusCounters';
import AppointmentList from './AppointmentList';
import FinancialWidget from './FinancialWidget';
import { RoleGate } from '@/components/RoleGate';
import type { DashboardStats, DashboardAppointment, AppointmentStatus } from '@/lib/services/dashboard-service';
import type { Role } from '@/lib/auth/permissions';

// ─── Constants ────────────────────────────────────────────────────────────────

const POLLING_INTERVAL_MS = 30_000; // 30 seconds

// ─── Props ────────────────────────────────────────────────────────────────────

interface DashboardClientProps {
  user: { userId: string; role: Role; name: string };
  initialStats: DashboardStats;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * DashboardClient is the main client component for the doctor dashboard.
 * It manages:
 * - Polling /api/dashboard/stats every 30s for real-time counter updates
 * - Date picker state for viewing arbitrary date schedules
 * - Rendering StatusCounters and AppointmentList sections
 *
 * Requirements: 1.3, 4.1, 4.2, 4.3, 5.2, 5.3, 6.2, 6.3
 */
export default function DashboardClient({ user, initialStats }: DashboardClientProps) {
  const [stats, setStats] = useState<DashboardStats>(initialStats);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dateAppointments, setDateAppointments] = useState<DashboardAppointment[]>([]);
  const [isLoadingDate, setIsLoadingDate] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Polling ──────────────────────────────────────────────────────────

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/dashboard/stats');
      if (response.ok) {
        const json = await response.json();
        if (json.success && json.data) {
          setStats(json.data);
        }
      }
      // On non-ok response, silently ignore — retry on next interval
    } catch {
      // Handle polling errors silently (retry on next interval)
    }
  }, []);

  useEffect(() => {
    intervalRef.current = setInterval(fetchStats, POLLING_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchStats]);

  // ─── Date Picker ──────────────────────────────────────────────────────

  const handleDateChange = useCallback(async (dateValue: string) => {
    if (!dateValue) {
      // Date picker cleared — revert to today/tomorrow view
      setSelectedDate(null);
      setDateAppointments([]);
      return;
    }

    setSelectedDate(dateValue);
    setIsLoadingDate(true);

    try {
      const response = await fetch(`/api/dashboard/stats?date=${dateValue}`);
      if (response.ok) {
        const json = await response.json();
        if (json.success && json.data) {
          setDateAppointments(json.data);
        }
      }
    } catch {
      // Silently handle fetch errors for date picker
      setDateAppointments([]);
    } finally {
      setIsLoadingDate(false);
    }
  }, []);

  const handleClearDate = useCallback(() => {
    setSelectedDate(null);
    setDateAppointments([]);
  }, []);

  // ─── Status Change ────────────────────────────────────────────────────

  const handleStatusChange = useCallback(async (appointmentId: string, newStatus: AppointmentStatus) => {
    try {
      const response = await fetch(`/api/appointments/${appointmentId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (response.ok) {
        // Immediately refresh stats to update counters and list
        await fetchStats();
      }
    } catch {
      // Silently handle errors
    }
  }, [fetchStats]);

  // ─── Helpers ──────────────────────────────────────────────────────────

  function formatSelectedDate(dateStr: string): string {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Welcome back, {user.name}
        </p>
      </div>

      {/* Status Counters */}
      <StatusCounters
        waitingCount={stats.waitingCount}
        seenCount={stats.seenCount}
      />

      {/* Financial Widget (role-gated) */}
      <RoleGate feature="financial" role={user.role}>
        <FinancialWidget />
      </RoleGate>

      {/* Date Picker */}
      <div className="flex items-center gap-3">
        <label htmlFor="schedule-date" className="text-sm font-medium text-gray-700">
          View schedule for:
        </label>
        <input
          id="schedule-date"
          type="date"
          value={selectedDate ?? ''}
          onChange={(e) => handleDateChange(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {selectedDate && (
          <button
            onClick={handleClearDate}
            className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
          >
            Clear
          </button>
        )}
      </div>

      {/* Date-Picked Section */}
      {selectedDate && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900">
            Schedule for {formatSelectedDate(selectedDate)}
          </h2>
          {isLoadingDate ? (
            <p className="py-6 text-center text-sm text-gray-500">Loading schedule...</p>
          ) : (
            <div className="mt-3 rounded-lg border border-gray-200 bg-white">
              <AppointmentList
                appointments={dateAppointments}
                showStatus
                emptyMessage="No appointments scheduled for this date."
              />
            </div>
          )}
        </section>
      )}

      {/* Today's Schedule */}
      {!selectedDate && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900">Today&apos;s Schedule</h2>
          <div className="mt-3 rounded-lg border border-gray-200 bg-white">
            <AppointmentList
              appointments={stats.today}
              showStatus
              emptyMessage="No appointments scheduled for today."
              onStatusChange={handleStatusChange}
            />
          </div>
        </section>
      )}

      {/* Tomorrow's Schedule */}
      {!selectedDate && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900">Tomorrow&apos;s Schedule</h2>
          <div className="mt-3 rounded-lg border border-gray-200 bg-white">
            <AppointmentList
              appointments={stats.tomorrow}
              showStatus={false}
              emptyMessage="No appointments scheduled for tomorrow."
            />
          </div>
        </section>
      )}
    </div>
  );
}

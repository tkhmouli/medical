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
      {/* Greeting Header — MediCore style */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'},
            </h1>
            <p className="text-2xl font-bold text-blue-600">
              Dr. {user.name.split(' ').pop()} 👋
            </p>
            <p className="mt-2 text-sm text-gray-500">
              Here&apos;s what&apos;s happening in your practice today.
            </p>
          </div>
          <div className="hidden md:flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-800">
                {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
              <p className="text-xs text-gray-500">
                {new Date().toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
          </div>
        </div>
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
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <label htmlFor="schedule-date" className="text-sm font-medium text-gray-700">
            View schedule for:
          </label>
          <input
            id="schedule-date"
            type="date"
            value={selectedDate ?? ''}
            onChange={(e) => handleDateChange(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {selectedDate && (
            <button
              onClick={handleClearDate}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Date-Picked Section */}
      {selectedDate && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">
              Schedule for {formatSelectedDate(selectedDate)}
            </h2>
          </div>
          {isLoadingDate ? (
            <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
              <p className="text-sm text-gray-500">Loading schedule...</p>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
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
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Today&apos;s Appointments</h2>
            <span className="text-xs font-medium text-blue-600 hover:text-blue-700 cursor-pointer">View all →</span>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
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
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Tomorrow&apos;s Schedule</h2>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
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

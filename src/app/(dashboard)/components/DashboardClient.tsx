'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import StatusCounters from './StatusCounters';
import AppointmentList from './AppointmentList';
import FinancialWidget from './FinancialWidget';
import { RoleGate } from '@/components/RoleGate';
import type { DashboardStats, DashboardAppointment, AppointmentStatus } from '@/lib/services/dashboard-service';
import type { Role } from '@/lib/auth/permissions';

const POLLING_INTERVAL_MS = 30_000;

interface DashboardClientProps {
  user: { userId: string; role: Role; name: string };
  initialStats: DashboardStats;
}

export default function DashboardClient({ user, initialStats }: DashboardClientProps) {
  const [stats, setStats] = useState<DashboardStats>(initialStats);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dateAppointments, setDateAppointments] = useState<DashboardAppointment[]>([]);
  const [isLoadingDate, setIsLoadingDate] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/dashboard/stats');
      if (response.ok) {
        const json = await response.json();
        if (json.success && json.data) setStats(json.data);
      }
    } catch {}
  }, []);

  useEffect(() => {
    intervalRef.current = setInterval(fetchStats, POLLING_INTERVAL_MS);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchStats]);

  const handleDateChange = useCallback(async (dateValue: string) => {
    if (!dateValue) { setSelectedDate(null); setDateAppointments([]); return; }
    setSelectedDate(dateValue);
    setIsLoadingDate(true);
    try {
      const response = await fetch(`/api/dashboard/stats?date=${dateValue}`);
      if (response.ok) {
        const json = await response.json();
        if (json.success && json.data) setDateAppointments(json.data);
      }
    } catch { setDateAppointments([]); }
    finally { setIsLoadingDate(false); }
  }, []);

  const handleStatusChange = useCallback(async (appointmentId: string, newStatus: AppointmentStatus) => {
    try {
      const response = await fetch(`/api/appointments/${appointmentId}/status`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (response.ok) await fetchStats();
    } catch {}
  }, [fetchStats]);

  function formatSelectedDate(dateStr: string): string {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }

  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="space-y-6">
      {/* Greeting Card */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-lg text-gray-600">{greeting},</p>
            <h1 className="text-2xl font-bold text-blue-600">Dr. {user.name} 👋</h1>
            <p className="mt-2 text-sm text-gray-500">Here&apos;s what&apos;s happening in your practice today. Stay aware, stay ahead.</p>
          </div>
          <div className="hidden md:block text-right">
            <p className="text-sm font-medium text-gray-800">
              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
            <p className="text-xs text-gray-500">
              {new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <StatusCounters
        waitingCount={stats.waitingCount}
        seenCount={stats.seenCount}
        todayAppointments={stats.today}
      />

      {/* Main grid layout — like MediCore */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — Today's Appointments (2/3 width) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Today's Appointments */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <h2 className="text-base font-semibold text-gray-900">Today&apos;s Appointments</h2>
              <Link href="/appointments" className="text-xs font-medium text-blue-600 hover:text-blue-700">
                View all →
              </Link>
            </div>
            <div className="px-2">
              <AppointmentList
                appointments={stats.today}
                showStatus
                emptyMessage="No appointments scheduled for today."
                onStatusChange={handleStatusChange}
              />
            </div>
          </div>

          {/* Tomorrow's Schedule */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <h2 className="text-base font-semibold text-gray-900">Upcoming (Tomorrow)</h2>
            </div>
            <div className="px-2">
              <AppointmentList
                appointments={stats.tomorrow}
                showStatus={false}
                emptyMessage="No appointments scheduled for tomorrow."
              />
            </div>
          </div>

          {/* Date Picker Section */}
          {selectedDate && (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                <h2 className="text-base font-semibold text-gray-900">{formatSelectedDate(selectedDate)}</h2>
                <button onClick={() => { setSelectedDate(null); setDateAppointments([]); }} className="text-xs font-medium text-gray-500 hover:text-gray-700">Clear ×</button>
              </div>
              <div className="px-2">
                {isLoadingDate ? (
                  <p className="py-6 text-center text-sm text-gray-500">Loading...</p>
                ) : (
                  <AppointmentList appointments={dateAppointments} showStatus emptyMessage="No appointments for this date." />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right column — Sidebar widgets (1/3 width) */}
        <div className="space-y-6">
          {/* Quick Links */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Quick Links</h3>
            <div className="grid grid-cols-3 gap-3">
              <Link href="/workspace" className="flex flex-col items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 p-3 hover:bg-blue-50 hover:border-blue-200 transition-colors">
                <span className="text-xl">🩺</span>
                <span className="text-[10px] font-medium text-gray-600">Workspace</span>
              </Link>
              <Link href="/patients" className="flex flex-col items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 p-3 hover:bg-blue-50 hover:border-blue-200 transition-colors">
                <span className="text-xl">👤</span>
                <span className="text-[10px] font-medium text-gray-600">Patients</span>
              </Link>
              <Link href="/appointments" className="flex flex-col items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 p-3 hover:bg-blue-50 hover:border-blue-200 transition-colors">
                <span className="text-xl">📅</span>
                <span className="text-[10px] font-medium text-gray-600">Appts</span>
              </Link>
              <Link href="/prescriptions" className="flex flex-col items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 p-3 hover:bg-blue-50 hover:border-blue-200 transition-colors">
                <span className="text-xl">💊</span>
                <span className="text-[10px] font-medium text-gray-600">Rx</span>
              </Link>
              <Link href="/lab-requests" className="flex flex-col items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 p-3 hover:bg-blue-50 hover:border-blue-200 transition-colors">
                <span className="text-xl">🧪</span>
                <span className="text-[10px] font-medium text-gray-600">Lab</span>
              </Link>
              <Link href="/compte-rendu" className="flex flex-col items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 p-3 hover:bg-blue-50 hover:border-blue-200 transition-colors">
                <span className="text-xl">📋</span>
                <span className="text-[10px] font-medium text-gray-600">Reports</span>
              </Link>
            </div>
          </div>

          {/* Patient Queue Status */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">Patient Queue Status</h3>
            </div>
            <div className="flex items-center justify-center py-3">
              <div className="relative h-28 w-28">
                {/* Simple donut visualization */}
                <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="14" fill="none" stroke="#f3f4f6" strokeWidth="3" />
                  {stats.today.length > 0 && (
                    <>
                      {/* Completed arc */}
                      <circle cx="18" cy="18" r="14" fill="none" stroke="#10b981" strokeWidth="3"
                        strokeDasharray={`${(stats.seenCount / stats.today.length) * 88} 88`} strokeLinecap="round" />
                      {/* Waiting arc */}
                      <circle cx="18" cy="18" r="14" fill="none" stroke="#f59e0b" strokeWidth="3"
                        strokeDasharray={`${(stats.waitingCount / stats.today.length) * 88} 88`}
                        strokeDashoffset={`-${(stats.seenCount / stats.today.length) * 88}`} strokeLinecap="round" />
                    </>
                  )}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xs text-gray-500">Total</span>
                  <span className="text-xl font-bold text-gray-900">{stats.today.length}</span>
                </div>
              </div>
            </div>
            {/* Legend */}
            <div className="mt-3 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                  <span className="text-gray-600">Waiting</span>
                </div>
                <span className="font-medium text-gray-900">{stats.waitingCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                  <span className="text-gray-600">In Consultation</span>
                </div>
                <span className="font-medium text-gray-900">{stats.today.filter(a => a.status === 'in_progress').length}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
                  <span className="text-gray-600">Completed</span>
                </div>
                <span className="font-medium text-gray-900">{stats.seenCount}</span>
              </div>
            </div>
          </div>

          {/* Date Picker */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">View Schedule</h3>
            <input
              type="date"
              value={selectedDate ?? ''}
              onChange={(e) => handleDateChange(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Financial Widget */}
          <RoleGate feature="financial" role={user.role}>
            <FinancialWidget />
          </RoleGate>
        </div>
      </div>
    </div>
  );
}

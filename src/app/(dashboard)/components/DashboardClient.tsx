'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import StatusCounters from './StatusCounters';
import AppointmentList from './AppointmentList';
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
      {/* Greeting Card — MediCore gradient style */}
      <div className="rounded-2xl bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 p-8 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-1/2 w-48 h-48 bg-white/5 rounded-full translate-y-1/2" />
        <div className="relative z-10">
          <p className="text-blue-100 text-lg">{greeting},</p>
          <h1 className="text-3xl font-bold mt-1">Dr. {user.name}</h1>
          <p className="mt-3 text-blue-100 text-sm max-w-md">
            Here&apos;s what&apos;s happening in your practice today. Stay aware, stay ahead.
          </p>
          <div className="mt-4 flex items-center gap-4">
            <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-1.5 backdrop-blur-sm">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs font-medium">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-1.5 backdrop-blur-sm">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
              <span className="text-xs font-medium">{new Date().toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <StatusCounters waitingCount={stats.waitingCount} seenCount={stats.seenCount} todayAppointments={stats.today} />

      {/* Main grid layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <h2 className="text-base font-semibold text-gray-900">Today&apos;s Appointments</h2>
              <Link href="/appointments" className="text-xs font-medium text-blue-600 hover:text-blue-700">View all →</Link>
            </div>
            <div className="px-2">
              <AppointmentList appointments={stats.today} showStatus emptyMessage="No appointments scheduled for today." onStatusChange={handleStatusChange} />
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <h2 className="text-base font-semibold text-gray-900">Upcoming (Tomorrow)</h2>
            </div>
            <div className="px-2">
              <AppointmentList appointments={stats.tomorrow} showStatus={false} emptyMessage="No appointments scheduled for tomorrow." />
            </div>
          </div>
          {selectedDate && (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                <h2 className="text-base font-semibold text-gray-900">{formatSelectedDate(selectedDate)}</h2>
                <button onClick={() => { setSelectedDate(null); setDateAppointments([]); }} className="text-xs font-medium text-gray-500 hover:text-gray-700">Clear ×</button>
              </div>
              <div className="px-2">
                {isLoadingDate ? <p className="py-6 text-center text-sm text-gray-500">Loading...</p> : <AppointmentList appointments={dateAppointments} showStatus emptyMessage="No appointments for this date." />}
              </div>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Mini Calendar */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">{new Date().toLocaleDateString([], { month: 'long', year: 'numeric' })}</h3>
              <div className="flex items-center gap-1">
                <button type="button" className="p-1 rounded hover:bg-gray-100 text-gray-400"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg></button>
                <button type="button" className="p-1 rounded hover:bg-gray-100 text-gray-400"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg></button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-0.5 text-center">
              {['S','M','T','W','T','F','S'].map((d,i) => <span key={i} className="text-[10px] font-medium text-gray-400 py-1">{d}</span>)}
              {(() => {
                const today = new Date();
                const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).getDay();
                const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
                const cells = [];
                for (let i = 0; i < firstDay; i++) cells.push(<span key={`e${i}`} />);
                for (let d = 1; d <= daysInMonth; d++) {
                  const isToday = d === today.getDate();
                  cells.push(<button key={d} type="button" onClick={() => handleDateChange(`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`)} className={`text-xs py-1 rounded-md transition-colors ${isToday ? 'bg-blue-600 text-white font-bold' : 'text-gray-700 hover:bg-blue-50'}`}>{d}</button>);
                }
                return cells;
              })()}
            </div>
          </div>

          {/* Today's Schedule sidebar */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <h3 className="text-sm font-semibold text-gray-900">Today&apos;s Schedule</h3>
              <Link href="/appointments" className="text-[10px] font-medium text-blue-600">View Full Calendar →</Link>
            </div>
            <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
              {stats.today.length === 0 ? <p className="text-xs text-gray-400 text-center py-4">No appointments today</p> : stats.today.slice(0,5).map((appt) => (
                <div key={appt.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-gray-50">
                  <div className={`w-0.5 h-8 rounded-full ${appt.status === 'completed' ? 'bg-green-400' : appt.status === 'in_progress' ? 'bg-blue-400' : appt.status === 'waiting' ? 'bg-amber-400' : 'bg-gray-200'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-900 truncate">{appt.patientName}</p>
                    <p className="text-[10px] text-gray-500">{appt.visitType}</p>
                  </div>
                  <span className={`text-[10px] font-medium rounded-full px-2 py-0.5 ${appt.status === 'completed' ? 'bg-green-100 text-green-700' : appt.status === 'waiting' ? 'bg-amber-100 text-amber-700' : appt.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                    {appt.status === 'completed' ? 'Done' : appt.status === 'waiting' ? 'Waiting' : appt.status === 'in_progress' ? 'Active' : 'Scheduled'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Notifications */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
              <span className="text-[10px] font-medium text-blue-600 cursor-pointer">View all</span>
            </div>
            <div className="p-3 space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 shrink-0">
                  <svg className="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3" /></svg>
                </div>
                <div>
                  <p className="text-xs text-gray-800">Lab results pending review</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">2 reports awaiting</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 shrink-0">
                  <svg className="w-3.5 h-3.5 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25" /></svg>
                </div>
                <div>
                  <p className="text-xs text-gray-800">New appointment request</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">From patient portal</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-green-100 shrink-0">
                  <svg className="w-3.5 h-3.5 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5" /></svg>
                </div>
                <div>
                  <p className="text-xs text-gray-800">Prescription renewal due</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">3 patients pending</p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Links — SVG icons */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Quick Links</h3>
            <div className="grid grid-cols-3 gap-3">
              <Link href="/workspace" className="flex flex-col items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 p-3 hover:bg-blue-50 hover:border-blue-200 transition-colors">
                <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" /></svg>
                <span className="text-[10px] font-medium text-gray-600">Workspace</span>
              </Link>
              <Link href="/patients" className="flex flex-col items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 p-3 hover:bg-blue-50 hover:border-blue-200 transition-colors">
                <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>
                <span className="text-[10px] font-medium text-gray-600">Patients</span>
              </Link>
              <Link href="/appointments" className="flex flex-col items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 p-3 hover:bg-blue-50 hover:border-blue-200 transition-colors">
                <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
                <span className="text-[10px] font-medium text-gray-600">Appointments</span>
              </Link>
              <Link href="/prescriptions" className="flex flex-col items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 p-3 hover:bg-blue-50 hover:border-blue-200 transition-colors">
                <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                <span className="text-[10px] font-medium text-gray-600">Prescriptions</span>
              </Link>
              <Link href="/lab-requests" className="flex flex-col items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 p-3 hover:bg-blue-50 hover:border-blue-200 transition-colors">
                <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21" /></svg>
                <span className="text-[10px] font-medium text-gray-600">Lab</span>
              </Link>
              <Link href="/compte-rendu" className="flex flex-col items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 p-3 hover:bg-blue-50 hover:border-blue-200 transition-colors">
                <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" /></svg>
                <span className="text-[10px] font-medium text-gray-600">Reports</span>
              </Link>
            </div>
          </div>

          {/* Patient Queue Status */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Patient Queue</h3>
            <div className="flex items-center justify-center py-3">
              <div className="relative h-28 w-28">
                <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="14" fill="none" stroke="#f3f4f6" strokeWidth="3" />
                  {stats.today.length > 0 && (<><circle cx="18" cy="18" r="14" fill="none" stroke="#10b981" strokeWidth="3" strokeDasharray={`${(stats.seenCount / stats.today.length) * 88} 88`} strokeLinecap="round" /><circle cx="18" cy="18" r="14" fill="none" stroke="#f59e0b" strokeWidth="3" strokeDasharray={`${(stats.waitingCount / stats.today.length) * 88} 88`} strokeDashoffset={`-${(stats.seenCount / stats.today.length) * 88}`} strokeLinecap="round" /></>)}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xs text-gray-500">Total</span>
                  <span className="text-xl font-bold text-gray-900">{stats.today.length}</span>
                </div>
              </div>
            </div>
            <div className="mt-3 space-y-2 text-xs">
              <div className="flex items-center justify-between"><div className="flex items-center gap-2"><div className="h-2.5 w-2.5 rounded-full bg-amber-400" /><span className="text-gray-600">Waiting</span></div><span className="font-medium text-gray-900">{stats.waitingCount}</span></div>
              <div className="flex items-center justify-between"><div className="flex items-center gap-2"><div className="h-2.5 w-2.5 rounded-full bg-blue-500" /><span className="text-gray-600">In Consultation</span></div><span className="font-medium text-gray-900">{stats.today.filter(a => a.status === 'in_progress').length}</span></div>
              <div className="flex items-center justify-between"><div className="flex items-center gap-2"><div className="h-2.5 w-2.5 rounded-full bg-green-500" /><span className="text-gray-600">Completed</span></div><span className="font-medium text-gray-900">{stats.seenCount}</span></div>
            </div>
          </div>

          {/* View Schedule */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">View Schedule</h3>
            <input type="date" value={selectedDate ?? ''} onChange={(e) => handleDateChange(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
        </div>
      </div>
    </div>
  );
}

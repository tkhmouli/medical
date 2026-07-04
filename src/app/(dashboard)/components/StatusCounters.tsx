'use client';

import type { DashboardAppointment } from '@/lib/services/dashboard-service';

interface StatusCountersProps {
  waitingCount: number;
  seenCount: number;
  todayAppointments?: DashboardAppointment[];
}

export default function StatusCounters({ waitingCount, seenCount, todayAppointments = [] }: StatusCountersProps) {
  const totalToday = todayAppointments.length;
  const inProgressCount = todayAppointments.filter(a => a.status === 'in_progress').length;
  const scheduledCount = todayAppointments.filter(a => a.status === 'scheduled').length;

  const stats = [
    { label: 'Total Patients Today', value: totalToday, color: 'blue' },
    { label: 'Waiting Room', value: waitingCount, color: 'amber' },
    { label: 'In Consultation', value: inProgressCount, color: 'purple' },
    { label: 'Completed', value: seenCount, color: 'green' },
    { label: 'Scheduled', value: scheduledCount, color: 'gray' },
  ];

  const colorMap: Record<string, { bg: string; border: string; text: string; label: string; icon: string }> = {
    blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-900', label: 'text-blue-600', icon: 'text-blue-500' },
    amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-900', label: 'text-amber-600', icon: 'text-amber-500' },
    purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-900', label: 'text-purple-600', icon: 'text-purple-500' },
    green: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-900', label: 'text-green-600', icon: 'text-green-500' },
    gray: { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-900', label: 'text-gray-600', icon: 'text-gray-500' },
  };

  const icons: Record<string, JSX.Element> = {
    blue: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>,
    amber: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    purple: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3" /></svg>,
    green: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    gray: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>,
  };

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {stats.map((stat) => {
        const c = colorMap[stat.color];
        return (
          <div key={stat.label} className={`rounded-xl border ${c.border} ${c.bg} p-4`}>
            <div className="flex items-center gap-2">
              <span className={c.icon}>{icons[stat.color]}</span>
              <p className={`text-xs font-medium ${c.label}`}>{stat.label}</p>
            </div>
            <p className={`mt-2 text-2xl font-bold ${c.text}`}>{stat.value}</p>
          </div>
        );
      })}
    </div>
  );
}

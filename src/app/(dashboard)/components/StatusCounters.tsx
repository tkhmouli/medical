'use client';

/**
 * StatusCounters displays MediCore-style stat cards with icons and labels.
 * Shows: Total Patients Today, Waiting, In Progress, Completed
 */

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
    {
      label: 'Total Patients Today',
      value: totalToday,
      icon: '👥',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      textColor: 'text-blue-900',
      labelColor: 'text-blue-600',
    },
    {
      label: 'Waiting Room',
      value: waitingCount,
      icon: '⏳',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200',
      textColor: 'text-amber-900',
      labelColor: 'text-amber-600',
    },
    {
      label: 'In Consultation',
      value: inProgressCount,
      icon: '🩺',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200',
      textColor: 'text-purple-900',
      labelColor: 'text-purple-600',
    },
    {
      label: 'Completed',
      value: seenCount,
      icon: '✅',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      textColor: 'text-green-900',
      labelColor: 'text-green-600',
    },
    {
      label: 'Scheduled',
      value: scheduledCount,
      icon: '📋',
      bgColor: 'bg-gray-50',
      borderColor: 'border-gray-200',
      textColor: 'text-gray-900',
      labelColor: 'text-gray-600',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className={`rounded-xl border ${stat.borderColor} ${stat.bgColor} p-4`}
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">{stat.icon}</span>
            <p className={`text-xs font-medium ${stat.labelColor}`}>{stat.label}</p>
          </div>
          <p className={`mt-2 text-2xl font-bold ${stat.textColor}`}>{stat.value}</p>
        </div>
      ))}
    </div>
  );
}

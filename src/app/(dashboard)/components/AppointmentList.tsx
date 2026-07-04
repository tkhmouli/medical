'use client';

import { useState } from 'react';
import { type DashboardAppointment, type AppointmentStatus } from '@/lib/services/dashboard-service';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface AppointmentListProps {
  appointments: DashboardAppointment[];
  showStatus?: boolean;
  emptyMessage: string;
  onStatusChange?: (appointmentId: string, newStatus: AppointmentStatus) => void;
}

// ─── Status Flow ──────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<AppointmentStatus, string> = {
  scheduled: 'bg-gray-100 text-gray-700',
  waiting: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
};

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: 'Scheduled',
  waiting: 'Waiting',
  in_progress: 'In Progress',
  completed: 'Completed',
};

/** The next status in the workflow */
const NEXT_STATUS: Record<AppointmentStatus, AppointmentStatus | null> = {
  scheduled: 'waiting',
  waiting: 'in_progress',
  in_progress: 'completed',
  completed: null, // terminal state
};

const NEXT_ACTION_LABEL: Record<AppointmentStatus, string> = {
  scheduled: 'Mark Waiting',
  waiting: 'Start Visit',
  in_progress: 'Complete',
  completed: '',
};

const NEXT_ACTION_STYLE: Record<AppointmentStatus, string> = {
  scheduled: 'bg-amber-500 hover:bg-amber-600 text-white',
  waiting: 'bg-blue-500 hover:bg-blue-600 text-white',
  in_progress: 'bg-green-500 hover:bg-green-600 text-white',
  completed: '',
};

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: AppointmentStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatStartTime(startTime: string): string {
  if (startTime.includes('T')) {
    const date = new Date(startTime);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return startTime;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (remaining === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${remaining}m`;
}

// ─── Status Action Button ─────────────────────────────────────────────────────

function StatusActionButton({
  appointment,
  onStatusChange,
}: {
  appointment: DashboardAppointment;
  onStatusChange: (appointmentId: string, newStatus: AppointmentStatus) => void;
}) {
  const [loading, setLoading] = useState(false);
  const nextStatus = NEXT_STATUS[appointment.status];

  if (!nextStatus) return null;

  const handleClick = async () => {
    setLoading(true);
    try {
      await onStatusChange(appointment.id, nextStatus);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${NEXT_ACTION_STYLE[appointment.status]}`}
    >
      {loading ? '...' : NEXT_ACTION_LABEL[appointment.status]}
    </button>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * AppointmentList renders a list of appointments sorted by start time.
 * Displays patient name, start time, duration, visit type, and status.
 * When `onStatusChange` is provided, shows action buttons to advance status.
 */
export default function AppointmentList({
  appointments,
  showStatus = false,
  emptyMessage,
  onStatusChange,
}: AppointmentListProps) {
  if (appointments.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-gray-400">{emptyMessage}</p>
    );
  }

  return (
    <ul className="divide-y divide-gray-50" role="list">
      {appointments.map((appointment) => (
        <li
          key={appointment.id}
          className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50/50 transition-colors"
        >
          {/* Time */}
          <div className="w-16 shrink-0 text-center">
            <p className="text-sm font-semibold text-gray-900">{formatStartTime(appointment.startTime)}</p>
          </div>

          {/* Color accent line */}
          <div className={`w-1 h-10 rounded-full ${
            appointment.status === 'completed' ? 'bg-green-400' :
            appointment.status === 'in_progress' ? 'bg-blue-400' :
            appointment.status === 'waiting' ? 'bg-amber-400' :
            'bg-gray-200'
          }`} />

          {/* Patient info */}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-900 truncate">
              {appointment.patientName}
            </p>
            <p className="text-xs text-gray-500">
              {appointment.visitType} · {formatDuration(appointment.duration)}
            </p>
          </div>

          {/* Status + Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {showStatus && (
              <StatusBadge status={appointment.status} />
            )}
            {onStatusChange && (
              <StatusActionButton
                appointment={appointment}
                onStatusChange={onStatusChange}
              />
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

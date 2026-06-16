'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { LoadingSpinner } from '@/components/LoadingSpinner';

// --- Types ---

type VisitType = 'new_visit' | 'control_visit' | 'follow_up';
type ViewMode = 'day' | 'week' | 'month';

interface CalendarAppointment {
  id: string;
  patientId: string;
  doctorId: string;
  date: string;
  startTime: string;
  duration: number;
  visitType: VisitType;
  isCancelled: boolean;
  notes: string | null;
}

interface PatientInfo {
  id: string;
  firstName: string;
  lastName: string;
}

// --- Color Coding ---

const VISIT_TYPE_COLORS: Record<VisitType, { bg: string; text: string; border: string; dot: string }> = {
  new_visit: {
    bg: 'bg-blue-50',
    text: 'text-blue-800',
    border: 'border-blue-200',
    dot: 'bg-blue-500',
  },
  control_visit: {
    bg: 'bg-green-50',
    text: 'text-green-800',
    border: 'border-green-200',
    dot: 'bg-green-500',
  },
  follow_up: {
    bg: 'bg-orange-50',
    text: 'text-orange-800',
    border: 'border-orange-200',
    dot: 'bg-orange-500',
  },
};

const VISIT_TYPE_LABELS: Record<VisitType, string> = {
  new_visit: 'New Visit',
  control_visit: 'Control Visit',
  follow_up: 'Follow-up',
};

// --- Utility Functions ---

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  // Start on Monday
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfWeek(date: Date): Date {
  const start = startOfWeek(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function isSameDay(d1: Date, d2: Date): boolean {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();
}

function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

function formatTime(time: string): string {
  const [hours, minutes] = time.split(':');
  const h = parseInt(hours, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayHour}:${minutes} ${ampm}`;
}

function getEndTime(startTime: string, durationMinutes: number): string {
  const [hours, minutes] = startTime.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes + durationMinutes;
  const endHours = Math.floor(totalMinutes / 60) % 24;
  const endMinutes = totalMinutes % 60;
  return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
}

// --- Main Component ---

/**
 * Calendar view page for appointments.
 * Supports day, week, and month view modes with color-coded visit types.
 * Click a date to navigate to day view; click an appointment to see details.
 *
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
 */
export default function AppointmentsCalendarPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [appointments, setAppointments] = useState<CalendarAppointment[]>([]);
  const [patients, setPatients] = useState<Record<string, PatientInfo>>({});
  const [loading, setLoading] = useState(true);
  const [selectedAppointment, setSelectedAppointment] = useState<CalendarAppointment | null>(null);

  // Calculate date range based on view mode
  const dateRange = useMemo(() => {
    switch (viewMode) {
      case 'day':
        return { start: new Date(currentDate), end: new Date(currentDate) };
      case 'week':
        return { start: startOfWeek(currentDate), end: endOfWeek(currentDate) };
      case 'month':
        return { start: startOfMonth(currentDate), end: endOfMonth(currentDate) };
    }
  }, [viewMode, currentDate]);

  // Fetch appointments for the current date range
  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const startStr = formatDate(dateRange.start);
      const endStr = formatDate(dateRange.end);
      const response = await fetch(
        `/api/appointments/calendar?startDate=${startStr}&endDate=${endStr}`
      );

      if (!response.ok) {
        setAppointments([]);
        return;
      }

      const data = await response.json();
      const appts: CalendarAppointment[] = data.data || [];
      setAppointments(appts);

      // Fetch patient info for unique patient IDs
      const uniquePatientIds = Array.from(new Set(appts.map((a) => a.patientId)));
      const newPatients: Record<string, PatientInfo> = { ...patients };
      const unknownIds = uniquePatientIds.filter((id) => !newPatients[id]);

      if (unknownIds.length > 0) {
        await Promise.all(
          unknownIds.map(async (patientId) => {
            try {
              const patientRes = await fetch(`/api/patients/${patientId}`);
              if (patientRes.ok) {
                const patientData = await patientRes.json();
                if (patientData.data) {
                  newPatients[patientId] = {
                    id: patientData.data.id,
                    firstName: patientData.data.firstName,
                    lastName: patientData.data.lastName,
                  };
                }
              }
            } catch {
              // Skip if fetch fails
            }
          })
        );
        setPatients(newPatients);
      }
    } catch {
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  // Navigation handlers
  const goToToday = () => setCurrentDate(new Date());

  const goToPrevious = () => {
    switch (viewMode) {
      case 'day':
        setCurrentDate(addDays(currentDate, -1));
        break;
      case 'week':
        setCurrentDate(addDays(currentDate, -7));
        break;
      case 'month':
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
        break;
    }
  };

  const goToNext = () => {
    switch (viewMode) {
      case 'day':
        setCurrentDate(addDays(currentDate, 1));
        break;
      case 'week':
        setCurrentDate(addDays(currentDate, 7));
        break;
      case 'month':
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
        break;
    }
  };

  const handleDateClick = (date: Date) => {
    setCurrentDate(date);
    setViewMode('day');
  };

  const handleAppointmentClick = (appointment: CalendarAppointment) => {
    setSelectedAppointment(appointment);
  };

  const closeModal = () => setSelectedAppointment(null);

  // Get the header title
  const headerTitle = useMemo(() => {
    const opts: Intl.DateTimeFormatOptions = {};
    switch (viewMode) {
      case 'day':
        return currentDate.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
      case 'week': {
        const weekStart = startOfWeek(currentDate);
        const weekEnd = endOfWeek(currentDate);
        const startMonth = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const endMonth = weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        return `${startMonth} – ${endMonth}`;
      }
      case 'month':
        return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
  }, [viewMode, currentDate]);

  // Get patient display name
  const getPatientName = (patientId: string): string => {
    const patient = patients[patientId];
    return patient ? `${patient.firstName} ${patient.lastName}` : 'Loading...';
  };

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Appointments
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            View and manage your appointment schedule.
          </p>
        </div>
        <Link
          href="/appointments/new"
          className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          + New Appointment
        </Link>
      </div>

      {/* Controls */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        {/* View mode toggles */}
        <div className="inline-flex rounded-md shadow-sm" role="group" aria-label="Calendar view mode">
          {(['day', 'week', 'month'] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className={`px-4 py-2 text-sm font-medium border ${
                mode === 'day' ? 'rounded-l-md' : ''
              } ${mode === 'month' ? 'rounded-r-md' : ''} ${
                viewMode === mode
                  ? 'bg-blue-600 text-white border-blue-600 z-10'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              } ${mode === 'week' ? '-ml-px' : ''} ${mode === 'month' ? '-ml-px' : ''}`}
              aria-pressed={viewMode === mode}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goToPrevious}
            className="rounded-md border border-gray-300 bg-white p-2 text-gray-600 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Previous"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>

          <button
            type="button"
            onClick={goToToday}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Today
          </button>

          <button
            type="button"
            onClick={goToNext}
            className="rounded-md border border-gray-300 bg-white p-2 text-gray-600 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Next"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>

          <span className="ml-2 text-lg font-semibold text-gray-900">{headerTitle}</span>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4" aria-label="Visit type legend">
        {(Object.entries(VISIT_TYPE_COLORS) as [VisitType, typeof VISIT_TYPE_COLORS[VisitType]][]).map(
          ([type, colors]) => (
            <div key={type} className="flex items-center gap-1.5 text-xs text-gray-600">
              <span className={`inline-block h-3 w-3 rounded-full ${colors.dot}`} aria-hidden="true" />
              <span>{VISIT_TYPE_LABELS[type]}</span>
            </div>
          )
        )}
      </div>

      {/* Calendar content */}
      <div className="mt-4">
        {loading ? (
          <LoadingSpinner label="Loading appointments..." />
        ) : viewMode === 'day' ? (
          <DayView
            date={currentDate}
            appointments={appointments}
            getPatientName={getPatientName}
            onAppointmentClick={handleAppointmentClick}
          />
        ) : viewMode === 'week' ? (
          <WeekView
            currentDate={currentDate}
            appointments={appointments}
            getPatientName={getPatientName}
            onDateClick={handleDateClick}
            onAppointmentClick={handleAppointmentClick}
          />
        ) : (
          <MonthView
            currentDate={currentDate}
            appointments={appointments}
            getPatientName={getPatientName}
            onDateClick={handleDateClick}
            onAppointmentClick={handleAppointmentClick}
          />
        )}
      </div>

      {/* Appointment detail modal */}
      {selectedAppointment && (
        <AppointmentDetailModal
          appointment={selectedAppointment}
          patientName={getPatientName(selectedAppointment.patientId)}
          onClose={closeModal}
        />
      )}
    </div>
  );
}

// --- Day View ---

interface DayViewProps {
  date: Date;
  appointments: CalendarAppointment[];
  getPatientName: (patientId: string) => string;
  onAppointmentClick: (appointment: CalendarAppointment) => void;
}

function DayView({ date, appointments, getPatientName, onAppointmentClick }: DayViewProps) {
  const dateStr = formatDate(date);
  const dayAppointments = appointments
    .filter((a) => a.date === dateStr)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  if (dayAppointments.length === 0) {
    return (
      <div className="rounded-md border border-gray-200 bg-gray-50 px-6 py-12 text-center">
        <p className="text-sm text-gray-600">No appointments for this day.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {dayAppointments.map((appt) => {
        const colors = VISIT_TYPE_COLORS[appt.visitType];
        const endTime = getEndTime(appt.startTime, appt.duration);

        return (
          <button
            key={appt.id}
            type="button"
            onClick={() => onAppointmentClick(appt)}
            className={`w-full rounded-md border p-4 text-left transition-shadow hover:shadow-md ${colors.bg} ${colors.border}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`inline-block h-3 w-3 rounded-full ${colors.dot}`} aria-hidden="true" />
                <div>
                  <p className={`text-sm font-medium ${colors.text}`}>
                    {getPatientName(appt.patientId)}
                  </p>
                  <p className="text-xs text-gray-600">
                    {formatTime(appt.startTime)} – {formatTime(endTime)} ({appt.duration} min)
                  </p>
                </div>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${colors.bg} ${colors.text}`}>
                {VISIT_TYPE_LABELS[appt.visitType]}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// --- Week View ---

interface WeekViewProps {
  currentDate: Date;
  appointments: CalendarAppointment[];
  getPatientName: (patientId: string) => string;
  onDateClick: (date: Date) => void;
  onAppointmentClick: (appointment: CalendarAppointment) => void;
}

function WeekView({ currentDate, appointments, getPatientName, onDateClick, onAppointmentClick }: WeekViewProps) {
  const weekStart = startOfWeek(currentDate);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="grid grid-cols-7 gap-px overflow-hidden rounded-md border border-gray-200 bg-gray-200">
      {/* Day headers */}
      {days.map((day) => (
        <div key={day.toISOString()} className="bg-gray-50 px-2 py-2 text-center">
          <p className="text-xs font-medium uppercase text-gray-500">
            {day.toLocaleDateString('en-US', { weekday: 'short' })}
          </p>
          <button
            type="button"
            onClick={() => onDateClick(day)}
            className={`mt-1 inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium transition-colors ${
              isToday(day)
                ? 'bg-blue-600 text-white'
                : 'text-gray-900 hover:bg-gray-200'
            }`}
            aria-label={`View ${day.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`}
          >
            {day.getDate()}
          </button>
        </div>
      ))}

      {/* Day content cells */}
      {days.map((day) => {
        const dateStr = formatDate(day);
        const dayAppts = appointments
          .filter((a) => a.date === dateStr)
          .sort((a, b) => a.startTime.localeCompare(b.startTime));

        return (
          <div
            key={`content-${day.toISOString()}`}
            className="min-h-[120px] bg-white p-1"
          >
            {dayAppts.length === 0 ? (
              <button
                type="button"
                onClick={() => onDateClick(day)}
                className="flex h-full w-full items-center justify-center"
                aria-label={`No appointments. View ${day.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`}
              >
                <span className="text-xs text-gray-600">—</span>
              </button>
            ) : (
              <div className="space-y-1">
                {dayAppts.slice(0, 3).map((appt) => {
                  const colors = VISIT_TYPE_COLORS[appt.visitType];
                  return (
                    <button
                      key={appt.id}
                      type="button"
                      onClick={() => onAppointmentClick(appt)}
                      className={`w-full rounded px-1.5 py-1 text-left text-xs truncate border ${colors.bg} ${colors.text} ${colors.border} hover:opacity-80 transition-opacity`}
                      title={`${getPatientName(appt.patientId)} - ${formatTime(appt.startTime)}`}
                    >
                      <span className="font-medium">{formatTime(appt.startTime)}</span>{' '}
                      <span className="truncate">{getPatientName(appt.patientId)}</span>
                    </button>
                  );
                })}
                {dayAppts.length > 3 && (
                  <button
                    type="button"
                    onClick={() => onDateClick(day)}
                    className="w-full rounded px-1.5 py-0.5 text-xs text-gray-600 hover:bg-gray-100"
                  >
                    +{dayAppts.length - 3} more
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// --- Month View ---

interface MonthViewProps {
  currentDate: Date;
  appointments: CalendarAppointment[];
  getPatientName: (patientId: string) => string;
  onDateClick: (date: Date) => void;
  onAppointmentClick: (appointment: CalendarAppointment) => void;
}

function MonthView({ currentDate, appointments, getPatientName, onDateClick, onAppointmentClick }: MonthViewProps) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);

  // Build a 6-row calendar grid starting from the Monday before the month starts
  const calendarStart = startOfWeek(monthStart);
  const weeks: Date[][] = [];
  let currentWeek: Date[] = [];
  let day = new Date(calendarStart);

  // Generate up to 6 weeks
  for (let i = 0; i < 42; i++) {
    currentWeek.push(new Date(day));
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
    day = addDays(day, 1);
  }

  const isCurrentMonth = (d: Date) =>
    d.getMonth() === currentDate.getMonth() && d.getFullYear() === currentDate.getFullYear();

  return (
    <div className="overflow-hidden rounded-md border border-gray-200">
      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((dayName) => (
          <div key={dayName} className="px-2 py-2 text-center text-xs font-medium uppercase text-gray-500">
            {dayName}
          </div>
        ))}
      </div>

      {/* Weeks */}
      {weeks.map((week, weekIdx) => (
        <div key={weekIdx} className="grid grid-cols-7 divide-x divide-gray-200 border-b border-gray-200 last:border-b-0">
          {week.map((cellDate) => {
            const dateStr = formatDate(cellDate);
            const dayAppts = appointments
              .filter((a) => a.date === dateStr)
              .sort((a, b) => a.startTime.localeCompare(b.startTime));
            const inMonth = isCurrentMonth(cellDate);

            return (
              <div
                key={cellDate.toISOString()}
                className={`min-h-[80px] p-1 ${inMonth ? 'bg-white' : 'bg-gray-50'}`}
              >
                <button
                  type="button"
                  onClick={() => onDateClick(cellDate)}
                  className={`mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                    isToday(cellDate)
                      ? 'bg-blue-600 text-white'
                      : inMonth
                      ? 'text-gray-900 hover:bg-gray-200'
                      : 'text-gray-600 hover:bg-gray-200'
                  }`}
                  aria-label={`View ${cellDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`}
                >
                  {cellDate.getDate()}
                </button>

                <div className="space-y-0.5">
                  {dayAppts.slice(0, 2).map((appt) => {
                    const colors = VISIT_TYPE_COLORS[appt.visitType];
                    return (
                      <button
                        key={appt.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAppointmentClick(appt);
                        }}
                        className={`w-full rounded px-1 py-0.5 text-left truncate text-[10px] leading-tight border ${colors.bg} ${colors.text} ${colors.border} hover:opacity-80 transition-opacity`}
                        title={`${getPatientName(appt.patientId)} - ${formatTime(appt.startTime)}`}
                      >
                        {formatTime(appt.startTime)}
                      </button>
                    );
                  })}
                  {dayAppts.length > 2 && (
                    <button
                      type="button"
                      onClick={() => onDateClick(cellDate)}
                      className="w-full text-[10px] text-gray-600 hover:text-gray-700"
                    >
                      +{dayAppts.length - 2} more
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// --- Appointment Detail Modal ---

interface AppointmentDetailModalProps {
  appointment: CalendarAppointment;
  patientName: string;
  onClose: () => void;
}

function AppointmentDetailModal({ appointment, patientName, onClose }: AppointmentDetailModalProps) {
  const colors = VISIT_TYPE_COLORS[appointment.visitType];
  const endTime = getEndTime(appointment.startTime, appointment.duration);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="appointment-detail-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal content */}
      <div className="relative mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded p-1 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Close"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Title */}
        <h2 id="appointment-detail-title" className="text-lg font-semibold text-gray-900">
          Appointment Details
        </h2>

        {/* Content */}
        <div className="mt-4 space-y-3">
          {/* Patient name */}
          <div>
            <p className="text-xs font-medium uppercase text-gray-500">Patient</p>
            <p className="text-sm font-medium text-gray-900">{patientName}</p>
          </div>

          {/* Visit type */}
          <div>
            <p className="text-xs font-medium uppercase text-gray-500">Visit Type</p>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${colors.bg} ${colors.text}`}>
              <span className={`h-2 w-2 rounded-full ${colors.dot}`} aria-hidden="true" />
              {VISIT_TYPE_LABELS[appointment.visitType]}
            </span>
          </div>

          {/* Date */}
          <div>
            <p className="text-xs font-medium uppercase text-gray-500">Date</p>
            <p className="text-sm text-gray-900">
              {new Date(appointment.date + 'T00:00:00').toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>

          {/* Time */}
          <div>
            <p className="text-xs font-medium uppercase text-gray-500">Time</p>
            <p className="text-sm text-gray-900">
              {formatTime(appointment.startTime)} – {formatTime(endTime)}
            </p>
          </div>

          {/* Duration */}
          <div>
            <p className="text-xs font-medium uppercase text-gray-500">Duration</p>
            <p className="text-sm text-gray-900">{appointment.duration} minutes</p>
          </div>

          {/* Notes */}
          {appointment.notes && (
            <div>
              <p className="text-xs font-medium uppercase text-gray-500">Notes</p>
              <p className="text-sm text-gray-700">{appointment.notes}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

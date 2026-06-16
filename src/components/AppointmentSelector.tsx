'use client';

import { useState, useEffect, useRef } from 'react';

// ----------------------------
// Types
// ----------------------------

interface Appointment {
  id: string;
  date: string;
  startTime: string;
  visitType: string;
}

export interface AppointmentSelectorProps {
  /** The selected patient's ID (null = disabled state) */
  patientId: string | null;
  /** Currently selected appointment ID */
  value: string | null;
  /** Callback when an appointment is selected */
  onChange: (appointmentId: string | null) => void;
  /** Pre-select this appointment ID from URL params */
  preSelectId?: string;
  /** Error message to show */
  error?: string;
}

// ----------------------------
// Helpers
// ----------------------------

function formatVisitType(visitType: string): string {
  return visitType
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${minutes.toString().padStart(2, '0')} ${period}`;
}

// ----------------------------
// Component
// ----------------------------

/**
 * Dropdown listing non-cancelled appointments for a selected patient.
 * Disabled when no patient is selected; fetches appointments when patientId changes.
 * Supports pre-selection via URL params and clears selection on patient change.
 *
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 */
export function AppointmentSelector({
  patientId,
  value,
  onChange,
  preSelectId,
  error,
}: AppointmentSelectorProps) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const previousPatientIdRef = useRef<string | null>(null);
  const hasPreSelected = useRef(false);

  // Fetch appointments when patientId changes
  useEffect(() => {
    // Clear selection when patientId changes (but not on initial mount with preSelectId)
    if (previousPatientIdRef.current !== null && previousPatientIdRef.current !== patientId) {
      onChange(null);
      hasPreSelected.current = false;
    }
    previousPatientIdRef.current = patientId;

    if (!patientId) {
      setAppointments([]);
      setFetchError(null);
      return;
    }

    let cancelled = false;

    async function fetchAppointments() {
      setIsLoading(true);
      setFetchError(null);

      try {
        const response = await fetch(
          `/api/appointments?patientId=${encodeURIComponent(patientId!)}&excludeCancelled=true`
        );

        if (cancelled) return;

        if (!response.ok) {
          throw new Error('Failed to load appointments');
        }

        const json = await response.json();
        const data: Appointment[] = json.data ?? [];
        setAppointments(data);

        // Pre-select if preSelectId is provided and valid
        if (preSelectId && !hasPreSelected.current) {
          const match = data.find((apt) => apt.id === preSelectId);
          if (match) {
            onChange(match.id);
          }
          hasPreSelected.current = true;
        }
      } catch {
        if (!cancelled) {
          setFetchError('Failed to load appointments');
          setAppointments([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchAppointments();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, preSelectId]);

  const isDisabled = !patientId;

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = e.target.value;
    onChange(selectedValue || null);
  };

  return (
    <div>
      <label
        htmlFor="appointment-selector"
        className="block text-sm font-medium text-gray-700"
      >
        Appointment
      </label>

      <select
        id="appointment-selector"
        value={value ?? ''}
        onChange={handleChange}
        disabled={isDisabled || isLoading}
        className={`mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 ${
          error || fetchError
            ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
            : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
        } ${isDisabled ? 'cursor-not-allowed bg-gray-100 text-gray-500' : 'bg-white'}`}
        aria-describedby={error || fetchError ? 'appointment-selector-error' : undefined}
      >
        {isDisabled && (
          <option value="">Select a patient first</option>
        )}

        {!isDisabled && isLoading && (
          <option value="">Loading appointments...</option>
        )}

        {!isDisabled && !isLoading && appointments.length === 0 && !fetchError && (
          <option value="">No appointments found for this patient</option>
        )}

        {!isDisabled && !isLoading && appointments.length > 0 && (
          <>
            <option value="">Select an appointment</option>
            {appointments.map((apt) => (
              <option key={apt.id} value={apt.id}>
                {formatDate(apt.date)} at {formatTime(apt.startTime)} — {formatVisitType(apt.visitType)}
              </option>
            ))}
          </>
        )}

        {!isDisabled && !isLoading && fetchError && (
          <option value="">Failed to load appointments</option>
        )}
      </select>

      {(error || fetchError) && (
        <p
          id="appointment-selector-error"
          className="mt-1 text-sm text-red-600"
          role="alert"
        >
          {error || fetchError}
        </p>
      )}
    </div>
  );
}

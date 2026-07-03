'use client';

import { useState, useEffect, useCallback, useRef, type FormEvent } from 'react';
import { DoctorSelectorDropdown } from '@/components/DoctorSelectorDropdown';
import { validateAppointment, type VisitType } from './validation';
import type { VisitContextState, VisitContextAction } from './visit-context';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AppointmentStepProps {
  state: VisitContextState;
  dispatch: React.Dispatch<VisitContextAction>;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    tenantId: string;
  };
}

interface Doctor {
  id: string;
  name: string;
}

interface AppointmentFormData {
  doctorId: string;
  date: string;
  startTime: string;
  duration: string;
  visitType: VisitType | '';
}

interface ConflictWarning {
  hasConflict: boolean;
  conflictingAppointment?: {
    id: string;
    date: string;
    startTime: string;
    duration: number;
    visitType: string;
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const VISIT_TYPE_OPTIONS: { value: VisitType; label: string }[] = [
  { value: 'new_visit', label: 'New Visit' },
  { value: 'control_visit', label: 'Control Visit' },
  { value: 'follow_up', label: 'Follow-up' },
];

const INITIAL_FORM_DATA: AppointmentFormData = {
  doctorId: '',
  date: '',
  startTime: '',
  duration: '30',
  visitType: '',
};

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * AppointmentStep component for the unified patient workflow.
 * Allows booking an appointment for the selected patient.
 * Displays overlap conflict warnings (non-blocking).
 * Supports skipping to advance without creating an appointment.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10
 */
export function AppointmentStep({ state, dispatch, user }: AppointmentStepProps) {
  const [formData, setFormData] = useState<AppointmentFormData>(INITIAL_FORM_DATA);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [conflictWarning, setConflictWarning] = useState<ConflictWarning | null>(null);
  const [doctorLoadError, setDoctorLoadError] = useState<string | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const doctorsFetched = useRef(false);

  // Fetch doctors list independently for name lookup
  useEffect(() => {
    if (doctorsFetched.current) return;
    doctorsFetched.current = true;

    async function fetchDoctors() {
      try {
        const response = await fetch('/api/doctors');
        if (response.ok) {
          const json = await response.json();
          if (json.success && Array.isArray(json.data)) {
            setDoctors(json.data);
          }
        }
      } catch {
        // DoctorSelectorDropdown handles its own error state
      }
    }
    fetchDoctors();
  }, []);

  // If the user navigated back and appointment data already exists, show read-only view
  const isReadOnly = state.completedSteps.has('appointment');

  // Patient info from context
  const patientName = state.patient
    ? `${state.patient.firstName} ${state.patient.lastName}`
    : 'Unknown Patient';

  // ─── Handlers ─────────────────────────────────────────────────────────────

  function handleChange(field: keyof AppointmentFormData, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  const handleDoctorChange = useCallback((doctorId: string | null) => {
    setFormData((prev) => ({ ...prev, doctorId: doctorId || '' }));
    setErrors((prev) => {
      if (prev.doctorId) {
        const next = { ...prev };
        delete next.doctorId;
        return next;
      }
      return prev;
    });
  }, []);

  const handleDoctorLoadError = useCallback((error: string | null) => {
    setDoctorLoadError(error);
  }, []);

  function handleSkip() {
    dispatch({ type: 'SKIP_APPOINTMENT' });
    dispatch({ type: 'ADVANCE_STEP', payload: { role: user.role as 'Admin' | 'Doctor' | 'Medical_Assistant' } });
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (doctorLoadError) return;

    // Client-side validation
    const validationData = {
      date: formData.date,
      startTime: formData.startTime,
      duration: formData.duration ? parseInt(formData.duration, 10) : undefined,
      visitType: formData.visitType || undefined,
      doctorId: formData.doctorId,
    };

    const validationErrors = validateAppointment(validationData);
    if (validationErrors) {
      setErrors(validationErrors);
      return;
    }

    setSubmitting(true);
    setErrors({});
    setConflictWarning(null);

    try {
      const payload = {
        patientId: state.patient!.id,
        doctorId: formData.doctorId.trim(),
        date: formData.date,
        startTime: formData.startTime,
        duration: parseInt(formData.duration, 10),
        visitType: formData.visitType,
      };

      const response = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        // Map API field errors to form errors
        if (result.error?.fields) {
          const apiErrors: Record<string, string> = {};
          for (const [key, msg] of Object.entries(result.error.fields)) {
            apiErrors[key] = msg as string;
          }
          if (Object.keys(apiErrors).length > 0) {
            setErrors(apiErrors);
          }
        } else {
          setErrors({ _form: result.error?.message || 'Failed to create appointment' });
        }
        return;
      }

      // Check for conflict warning (non-blocking)
      if (result.data?.conflictWarning) {
        setConflictWarning(result.data.conflictWarning);
      }

      // Get doctor name for context storage
      const selectedDoctor = doctors.find((d) => d.id === formData.doctorId);
      const resolvedDoctorName = selectedDoctor?.name || formData.doctorId;

      // Store appointment in Visit_Context and advance
      dispatch({
        type: 'SET_APPOINTMENT',
        payload: {
          id: result.data?.appointment?.id || result.data?.id || '',
          date: formData.date,
          startTime: formData.startTime,
          duration: parseInt(formData.duration, 10),
          visitType: formData.visitType as 'new_visit' | 'control_visit' | 'follow_up',
          doctorId: formData.doctorId,
          doctorName: resolvedDoctorName,
        },
      });
      dispatch({ type: 'ADVANCE_STEP', payload: { role: user.role as 'Admin' | 'Doctor' | 'Medical_Assistant' } });
    } catch {
      setErrors({ _form: 'An unexpected error occurred. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Read-Only View (navigated back) ─────────────────────────────────────

  if (isReadOnly) {
    const appt = state.appointment;
    const skipped = state.appointmentSkipped;

    return (
      <div
        data-testid="appointment-step"
        className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
      >
        {/* Patient Header */}
        <div className="mb-4 rounded-md bg-gray-50 px-4 py-3">
          <p className="text-sm text-gray-600">Patient</p>
          <p className="text-base font-medium text-gray-900">{patientName}</p>
        </div>

        {skipped ? (
          <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm text-gray-600">Appointment was skipped</p>
          </div>
        ) : appt ? (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">Appointment Details</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <p className="text-xs text-gray-500">Doctor</p>
                <p className="text-sm font-medium text-gray-900">{appt.doctorName}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Date</p>
                <p className="text-sm font-medium text-gray-900">{appt.date}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Start Time</p>
                <p className="text-sm font-medium text-gray-900">{appt.startTime}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Duration</p>
                <p className="text-sm font-medium text-gray-900">{appt.duration} minutes</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Visit Type</p>
                <p className="text-sm font-medium text-gray-900">
                  {VISIT_TYPE_OPTIONS.find((o) => o.value === appt.visitType)?.label || appt.visitType}
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  // ─── Form View ────────────────────────────────────────────────────────────

  const isSubmitDisabled = submitting || !!doctorLoadError;

  return (
    <div
      data-testid="appointment-step"
      className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
    >
      {/* Patient Header (read-only) */}
      <div className="mb-6 rounded-md bg-gray-50 px-4 py-3">
        <p className="text-sm text-gray-600">Patient</p>
        <p className="text-base font-medium text-gray-900">{patientName}</p>
      </div>

      {/* Conflict Warning */}
      {conflictWarning && conflictWarning.hasConflict && (
        <div
          className="mb-6 rounded-md border border-yellow-300 bg-yellow-50 p-4"
          role="alert"
          aria-live="polite"
        >
          <div className="flex items-start gap-3">
            <svg
              className="h-5 w-5 flex-shrink-0 text-yellow-600"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
            <div>
              <h3 className="text-sm font-medium text-yellow-800">
                Scheduling Conflict Detected
              </h3>
              <p className="mt-1 text-sm text-yellow-700">
                This appointment overlaps with an existing appointment for the same doctor.
                {conflictWarning.conflictingAppointment && (
                  <>
                    {' '}The conflicting appointment is on{' '}
                    {conflictWarning.conflictingAppointment.date} at{' '}
                    {conflictWarning.conflictingAppointment.startTime} (
                    {conflictWarning.conflictingAppointment.duration} min).
                  </>
                )}
                {' '}The appointment was created, but you may want to reschedule.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* General form error */}
      {errors._form && (
        <div
          className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3"
          role="alert"
        >
          <p className="text-sm text-red-700">{errors._form}</p>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} noValidate>
        <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
          {/* Doctor Selector */}
          <div className="md:col-span-2">
            <DoctorSelectorDropdown
              value={formData.doctorId || null}
              onChange={handleDoctorChange}
              onLoadError={handleDoctorLoadError}
              error={errors.doctorId}
            />
          </div>

          {/* Date */}
          <div>
            <label
              htmlFor="appointment-date"
              className="block text-sm font-medium text-gray-700"
            >
              Date <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <input
              id="appointment-date"
              type="date"
              value={formData.date}
              onChange={(e) => handleChange('date', e.target.value)}
              className={inputClassName(errors.date)}
              aria-required="true"
              aria-invalid={!!errors.date}
              aria-describedby={errors.date ? 'appointment-date-error' : undefined}
            />
            {errors.date && (
              <p
                id="appointment-date-error"
                className="mt-1 text-sm text-red-600"
                role="alert"
              >
                {errors.date}
              </p>
            )}
          </div>

          {/* Start Time */}
          <div>
            <label
              htmlFor="appointment-startTime"
              className="block text-sm font-medium text-gray-700"
            >
              Start Time <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <input
              id="appointment-startTime"
              type="time"
              value={formData.startTime}
              onChange={(e) => handleChange('startTime', e.target.value)}
              className={inputClassName(errors.startTime)}
              aria-required="true"
              aria-invalid={!!errors.startTime}
              aria-describedby={errors.startTime ? 'appointment-startTime-error' : undefined}
            />
            {errors.startTime && (
              <p
                id="appointment-startTime-error"
                className="mt-1 text-sm text-red-600"
                role="alert"
              >
                {errors.startTime}
              </p>
            )}
          </div>

          {/* Duration */}
          <div>
            <label
              htmlFor="appointment-duration"
              className="block text-sm font-medium text-gray-700"
            >
              Duration (minutes) <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <input
              id="appointment-duration"
              type="number"
              min={5}
              max={480}
              value={formData.duration}
              onChange={(e) => handleChange('duration', e.target.value)}
              className={inputClassName(errors.duration)}
              placeholder="30"
              aria-required="true"
              aria-invalid={!!errors.duration}
              aria-describedby={errors.duration ? 'appointment-duration-error' : undefined}
            />
            {errors.duration && (
              <p
                id="appointment-duration-error"
                className="mt-1 text-sm text-red-600"
                role="alert"
              >
                {errors.duration}
              </p>
            )}
          </div>

          {/* Visit Type */}
          <div>
            <label
              htmlFor="appointment-visitType"
              className="block text-sm font-medium text-gray-700"
            >
              Visit Type <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <select
              id="appointment-visitType"
              value={formData.visitType}
              onChange={(e) => handleChange('visitType', e.target.value)}
              className={inputClassName(errors.visitType)}
              aria-required="true"
              aria-invalid={!!errors.visitType}
              aria-describedby={errors.visitType ? 'appointment-visitType-error' : undefined}
            >
              <option value="">Select visit type</option>
              {VISIT_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {errors.visitType && (
              <p
                id="appointment-visitType-error"
                className="mt-1 text-sm text-red-600"
                role="alert"
              >
                {errors.visitType}
              </p>
            )}
          </div>
        </div>

        {/* Form Actions */}
        <div className="mt-6 flex items-center gap-4 border-t border-gray-200 pt-6">
          <button
            type="submit"
            disabled={isSubmitDisabled}
            className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? (
              <>
                <svg
                  className="-ml-0.5 mr-2 h-4 w-4 animate-spin"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Creating...
              </>
            ) : (
              'Book Appointment'
            )}
          </button>

          <button
            type="button"
            onClick={handleSkip}
            disabled={submitting}
            className="text-sm font-medium text-gray-600 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Skip
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Styling Utility ──────────────────────────────────────────────────────────

function inputClassName(error?: string): string {
  const base =
    'mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-0';
  if (error) {
    return `${base} border-red-300 text-red-900 focus:border-red-500 focus:ring-red-500`;
  }
  return `${base} border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-blue-500`;
}

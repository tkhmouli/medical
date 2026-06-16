'use client';

import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '@/components/NotificationToast';
import { PatientSelectorDropdown } from '@/components/PatientSelectorDropdown';
import { DoctorSelectorDropdown } from '@/components/DoctorSelectorDropdown';

// ----------------------------
// Types
// ----------------------------

type VisitType = 'new_visit' | 'control_visit' | 'follow_up' | '';

interface AppointmentFormData {
  patientId: string;
  doctorId: string;
  date: string;
  startTime: string;
  duration: string;
  visitType: VisitType;
  notes: string;
}

type FieldErrors = Partial<Record<keyof AppointmentFormData, string>>;

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

interface CreatedAppointment {
  id: string;
  patientId: string;
}

interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: string;
  tenantId: string;
}

// ----------------------------
// Constants
// ----------------------------

const VISIT_TYPE_OPTIONS: { value: VisitType; label: string }[] = [
  { value: 'new_visit', label: 'New Visit' },
  { value: 'control_visit', label: 'Control Visit' },
  { value: 'follow_up', label: 'Follow-up' },
];

const INITIAL_FORM_DATA: AppointmentFormData = {
  patientId: '',
  doctorId: '',
  date: '',
  startTime: '',
  duration: '30',
  visitType: '',
  notes: '',
};

// ----------------------------
// Validation
// ----------------------------

function validateForm(data: AppointmentFormData): FieldErrors {
  const errors: FieldErrors = {};

  if (!data.patientId.trim()) {
    errors.patientId = 'Patient is required';
  }
  if (!data.doctorId.trim()) {
    errors.doctorId = 'Doctor is required';
  }
  if (!data.date) {
    errors.date = 'Date is required';
  }
  if (!data.startTime) {
    errors.startTime = 'Start time is required';
  } else if (!/^\d{2}:\d{2}$/.test(data.startTime)) {
    errors.startTime = 'Time must be in HH:MM format';
  }
  if (!data.duration.trim()) {
    errors.duration = 'Duration is required';
  } else {
    const durationNum = parseInt(data.duration, 10);
    if (isNaN(durationNum) || durationNum < 5 || durationNum > 480) {
      errors.duration = 'Duration must be between 5 and 480 minutes';
    }
  }
  if (!data.visitType) {
    errors.visitType = 'Visit type is required';
  }

  return errors;
}

// ----------------------------
// Page Component
// ----------------------------

/**
 * Appointment create form page.
 * Submits to POST /api/appointments.
 * Uses PatientSelectorDropdown and DoctorSelectorDropdown for patient/doctor selection.
 * Supports pre-filling patient from URL params (patientId).
 * Displays overlap warning (non-blocking) when a conflict is detected.
 *
 * Requirements: 1.4, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */
export default function NewAppointmentPage() {
  const searchParams = useSearchParams();
  const { showToast } = useToast();

  const [formData, setFormData] = useState<AppointmentFormData>(INITIAL_FORM_DATA);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [conflictWarning, setConflictWarning] = useState<ConflictWarning | null>(null);

  // Patient pre-fill state
  const [patientLocked, setPatientLocked] = useState(false);
  const [patientDisplayName, setPatientDisplayName] = useState<string | undefined>(undefined);
  const [patientError, setPatientError] = useState<string | undefined>(undefined);

  // Doctor load error state (for disabling submission)
  const [doctorLoadError, setDoctorLoadError] = useState<string | null>(null);

  // Success view state
  const [createdAppointment, setCreatedAppointment] = useState<CreatedAppointment | null>(null);

  // Session state for role-based UI
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);

  // Fetch user session on mount to get role
  useEffect(() => {
    async function fetchSession() {
      try {
        const response = await fetch('/api/auth/session');
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            setSessionUser(data.data);
          }
        }
      } catch {
        // Session fetch failed — non-critical for form functionality
      }
    }
    fetchSession();
  }, []);

  // Pre-fill patient from URL params
  useEffect(() => {
    const patientIdParam = searchParams.get('patientId');
    if (!patientIdParam) return;

    async function validateAndPrefillPatient(patientId: string) {
      try {
        const response = await fetch(`/api/patients/${patientId}`);
        if (!response.ok) {
          setPatientError('Patient not found');
          setPatientLocked(false);
          return;
        }

        const data = await response.json();
        if (!data.success || !data.data) {
          setPatientError('Patient not found');
          setPatientLocked(false);
          return;
        }

        const patient = data.data;
        setFormData((prev) => ({ ...prev, patientId: patient.id }));
        setPatientDisplayName(`${patient.firstName} ${patient.lastName}`);
        setPatientLocked(true);
        setPatientError(undefined);
      } catch {
        setPatientError('Patient not found');
        setPatientLocked(false);
      }
    }

    validateAndPrefillPatient(patientIdParam);
  }, [searchParams]);

  /**
   * Handle field change and clear field-level error on interaction.
   */
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

  /**
   * Handle patient selection from PatientSelectorDropdown.
   */
  function handlePatientChange(patient: { id: string; firstName: string; lastName: string } | null) {
    if (patient) {
      setFormData((prev) => ({ ...prev, patientId: patient.id }));
      setPatientError(undefined);
    } else {
      setFormData((prev) => ({ ...prev, patientId: '' }));
    }
    if (errors.patientId) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.patientId;
        return next;
      });
    }
  }

  /**
   * Handle doctor selection from DoctorSelectorDropdown.
   */
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

  /**
   * Handle doctor load error from DoctorSelectorDropdown.
   */
  const handleDoctorLoadError = useCallback((error: string | null) => {
    setDoctorLoadError(error);
  }, []);

  /**
   * Submit handler: validates client-side, then POSTs to API.
   */
  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    // Prevent submission if patient not found
    if (patientError) {
      return;
    }

    // Prevent submission if doctor list failed to load or is empty
    if (doctorLoadError) {
      return;
    }

    // Client-side validation
    const validationErrors = validateForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSubmitting(true);
    setErrors({});
    setConflictWarning(null);

    try {
      const payload = {
        patientId: formData.patientId.trim(),
        doctorId: formData.doctorId.trim(),
        date: formData.date,
        startTime: formData.startTime,
        duration: parseInt(formData.duration, 10),
        visitType: formData.visitType,
        ...(formData.notes.trim() ? { notes: formData.notes.trim() } : {}),
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
          const apiErrors: FieldErrors = {};
          for (const [key, msg] of Object.entries(result.error.fields)) {
            if (key in INITIAL_FORM_DATA) {
              apiErrors[key as keyof AppointmentFormData] = msg as string;
            }
          }
          if (Object.keys(apiErrors).length > 0) {
            setErrors(apiErrors);
          } else {
            showToast('error', result.error?.message || 'Failed to create appointment');
          }
        } else {
          showToast('error', result.error?.message || 'Failed to create appointment');
        }
        return;
      }

      // Check for conflict warning (non-blocking)
      if (result.data?.conflictWarning) {
        setConflictWarning(result.data.conflictWarning);
      }

      // Success — show confirmation view with navigation links
      showToast('success', 'Appointment created successfully');
      setCreatedAppointment({
        id: result.data?.id || '',
        patientId: formData.patientId,
      });
    } catch {
      showToast('error', 'An unexpected error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // Determine if form submission should be disabled
  const isSubmitDisabled = submitting || !!patientError || !!doctorLoadError;

  // --- Success view ---

  if (createdAppointment) {
    const showCreatePrescription = sessionUser?.role === 'Admin' || sessionUser?.role === 'Doctor';
    const prescriptionUrl = `/prescriptions/new?patientId=${encodeURIComponent(createdAppointment.patientId)}&appointmentId=${encodeURIComponent(createdAppointment.id)}`;

    return (
      <div>
        <div className="mb-8">
          <Link
            href="/appointments"
            className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
          >
            ← Back to Appointments
          </Link>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-900">
            Appointment Created
          </h1>
        </div>

        <div className="max-w-lg rounded-md border border-green-200 bg-green-50 p-6">
          <div className="flex items-center gap-3">
            <svg
              className="h-6 w-6 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-sm font-medium text-green-800">
              Appointment has been created successfully.
            </p>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            {showCreatePrescription && (
              <Link
                href={prescriptionUrl}
                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                  />
                </svg>
                Create Prescription
              </Link>
            )}

            <Link
              href="/appointments"
              className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              View All Appointments
            </Link>

            <button
              type="button"
              onClick={() => {
                setCreatedAppointment(null);
                setFormData(INITIAL_FORM_DATA);
                setErrors({});
                setConflictWarning(null);
                if (!patientLocked) {
                  setPatientError(undefined);
                }
              }}
              className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
            >
              Create Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Page header */}
      <div className="mb-8">
        <Link
          href="/appointments"
          className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
        >
          ← Back to Appointments
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-900">
          New Appointment
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Schedule a new appointment. Fields marked with * are required.
        </p>
      </div>

      {/* Conflict warning alert (non-blocking) */}
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
                  <> The conflicting appointment is on{' '}
                  {conflictWarning.conflictingAppointment.date} at{' '}
                  {conflictWarning.conflictingAppointment.startTime} ({conflictWarning.conflictingAppointment.duration} min).</>
                )}
                {' '}The appointment was created, but you may want to reschedule.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} noValidate className="max-w-2xl space-y-8">
        {/* Appointment Details Section */}
        <fieldset>
          <legend className="text-base font-semibold text-gray-900">
            Appointment Details
          </legend>
          <p className="mt-1 text-sm text-gray-500">
            Assign the patient, doctor, and scheduling information.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
            {/* Patient Selector */}
            <FormField
              id="patientId"
              label="Patient"
              required
              error={errors.patientId}
            >
              <PatientSelectorDropdown
                value={formData.patientId || null}
                onChange={handlePatientChange}
                limit={20}
                disabled={patientLocked}
                displayName={patientDisplayName}
                error={patientError || errors.patientId}
              />
            </FormField>

            {/* Doctor Selector */}
            <div>
              <DoctorSelectorDropdown
                value={formData.doctorId || null}
                onChange={handleDoctorChange}
                onLoadError={handleDoctorLoadError}
                error={errors.doctorId}
              />
            </div>

            {/* Date */}
            <FormField
              id="date"
              label="Date"
              required
              error={errors.date}
            >
              <input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => handleChange('date', e.target.value)}
                className={inputClassName(errors.date)}
                aria-required="true"
                aria-invalid={!!errors.date}
                aria-describedby={errors.date ? 'date-error' : undefined}
              />
            </FormField>

            {/* Start Time */}
            <FormField
              id="startTime"
              label="Start Time"
              required
              error={errors.startTime}
            >
              <input
                id="startTime"
                type="time"
                value={formData.startTime}
                onChange={(e) => handleChange('startTime', e.target.value)}
                className={inputClassName(errors.startTime)}
                aria-required="true"
                aria-invalid={!!errors.startTime}
                aria-describedby={errors.startTime ? 'startTime-error' : undefined}
              />
            </FormField>

            {/* Duration */}
            <FormField
              id="duration"
              label="Duration (minutes)"
              required
              error={errors.duration}
            >
              <input
                id="duration"
                type="number"
                min={5}
                max={480}
                value={formData.duration}
                onChange={(e) => handleChange('duration', e.target.value)}
                className={inputClassName(errors.duration)}
                placeholder="30"
                aria-required="true"
                aria-invalid={!!errors.duration}
                aria-describedby={errors.duration ? 'duration-error' : undefined}
              />
            </FormField>

            {/* Visit Type */}
            <FormField
              id="visitType"
              label="Visit Type"
              required
              error={errors.visitType}
            >
              <select
                id="visitType"
                value={formData.visitType}
                onChange={(e) => handleChange('visitType', e.target.value)}
                className={inputClassName(errors.visitType)}
                aria-required="true"
                aria-invalid={!!errors.visitType}
                aria-describedby={errors.visitType ? 'visitType-error' : undefined}
              >
                <option value="">Select visit type</option>
                {VISIT_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
        </fieldset>

        {/* Notes Section */}
        <fieldset>
          <legend className="text-base font-semibold text-gray-900">
            Additional Information
          </legend>
          <p className="mt-1 text-sm text-gray-500">
            Optional notes for this appointment.
          </p>

          <div className="mt-4">
            <FormField
              id="notes"
              label="Notes"
              error={errors.notes}
            >
              <textarea
                id="notes"
                rows={3}
                value={formData.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                className={inputClassName(errors.notes)}
                placeholder="Additional notes or reason for visit"
              />
            </FormField>
          </div>
        </fieldset>

        {/* Form Actions */}
        <div className="flex items-center gap-4 border-t border-gray-200 pt-6">
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
              'Create Appointment'
            )}
          </button>
          <Link
            href="/appointments"
            className="text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

// ----------------------------
// Helper Components
// ----------------------------

interface FormFieldProps {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}

/**
 * Reusable form field wrapper with label and error message display.
 */
function FormField({ id, label, required, error, children }: FormFieldProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-gray-700"
      >
        {label}
        {required && <span className="ml-0.5 text-red-500" aria-hidden="true">*</span>}
      </label>
      <div className="mt-1">{children}</div>
      {error && (
        <p
          id={`${id}-error`}
          className="mt-1 text-sm text-red-600"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}

// ----------------------------
// Styling Utilities
// ----------------------------

/**
 * Returns Tailwind classes for input/select/textarea elements,
 * with error styling when a validation error is present.
 */
function inputClassName(error?: string): string {
  const base =
    'block w-full rounded-md border px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-0';
  if (error) {
    return `${base} border-red-300 text-red-900 focus:border-red-500 focus:ring-red-500`;
  }
  return `${base} border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-blue-500`;
}

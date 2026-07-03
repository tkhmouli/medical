'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { PatientSelectorDropdown } from '@/components/PatientSelectorDropdown';
import { useToast } from '@/components/NotificationToast';
import { validatePatientRegistration } from './validation';
import type { PatientInfo, VisitContextState, VisitContextAction } from './visit-context';
import type { Role } from '@/lib/auth/permissions';

// ─── Types ────────────────────────────────────────────────────────────────────

type Mode = 'search' | 'register';

interface PatientFormData {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  phoneNumber: string;
  gender: 'male' | 'female' | 'other' | '';
  secondaryPhone: string;
  cinNumber: string;
  email: string;
  address: string;
  notes: string;
}

type FieldErrors = Record<string, string>;

export interface PatientStepProps {
  state: VisitContextState;
  dispatch: React.Dispatch<VisitContextAction>;
  user: {
    id: string;
    name: string;
    email: string;
    role: Role;
    tenantId: string;
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const INITIAL_FORM_DATA: PatientFormData = {
  firstName: '',
  lastName: '',
  dateOfBirth: '',
  phoneNumber: '',
  gender: '',
  secondaryPhone: '',
  cinNumber: '',
  email: '',
  address: '',
  notes: '',
};

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * PatientStep handles patient search/selection and new patient registration
 * within the unified workspace workflow.
 *
 * For Doctors: Shows today's patient queue (waiting/scheduled) for quick selection.
 * For all: Search existing or register new patient.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10
 */
export default function PatientStep({ state, dispatch, user }: PatientStepProps) {
  const { showToast } = useToast();

  // If patient is already selected (navigated back to completed step), show read-only view
  if (state.patient && state.completedSteps.has('patient')) {
    return (
      <div data-testid="patient-step-readonly" className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Patient Selected</h2>
        <PatientConfirmation patient={state.patient} />
        <button
          type="button"
          onClick={() => dispatch({ type: 'NAVIGATE_TO_STEP', payload: 'visit_notes' })}
          className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
        >
          Go to Notes →
        </button>
      </div>
    );
  }

  return <PatientStepActive state={state} dispatch={dispatch} user={user} showToast={showToast} />;
}

// ─── Active Step (search/register modes) ──────────────────────────────────────

interface PatientStepActiveProps extends PatientStepProps {
  showToast: (type: 'success' | 'error', message: string) => void;
}

function PatientStepActive({ state, dispatch, user, showToast }: PatientStepActiveProps) {
  const [mode, setMode] = useState<Mode>('search');
  const [selectedPatient, setSelectedPatient] = useState<PatientInfo | null>(state.patient);
  const [formData, setFormData] = useState<PatientFormData>(INITIAL_FORM_DATA);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | undefined>(undefined);
  const [todayQueue, setTodayQueue] = useState<Array<{ id: string; patientName: string; startTime: string; status: string; appointmentId: string }>>([]);
  const [queueLoading, setQueueLoading] = useState(user.role === 'Doctor' || user.role === 'Admin');

  // Fetch today's patient queue for doctors
  useEffect(() => {
    if (user.role !== 'Doctor' && user.role !== 'Admin') return;

    async function fetchQueue() {
      try {
        const response = await fetch('/api/dashboard/stats');
        if (response.ok) {
          const json = await response.json();
          if (json.success && json.data?.today) {
            setTodayQueue(
              json.data.today.map((a: any) => ({
                id: a.id,
                patientName: a.patientName,
                startTime: a.startTime,
                status: a.status,
                appointmentId: a.id,
              }))
            );
          }
        }
      } catch {
        // Silently fail
      } finally {
        setQueueLoading(false);
      }
    }
    fetchQueue();
  }, [user.role]);

  // Handle quick-select from today's queue
  async function handleQueueSelect(item: { id: string; patientName: string; appointmentId: string }) {
    // We need the patientId — fetch from the appointment
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await fetch(`/api/appointments/calendar?startDate=${today}&endDate=${today}`);
      if (response.ok) {
        const data = await response.json();
        const appt = (data.data || []).find((a: any) => a.id === item.appointmentId);
        if (appt) {
          // Fetch patient details
          const patientRes = await fetch(`/api/patients/${appt.patientId}`);
          if (patientRes.ok) {
            const patientData = await patientRes.json();
            if (patientData.data) {
              const patientInfo: PatientInfo = {
                id: patientData.data.id,
                firstName: patientData.data.firstName,
                lastName: patientData.data.lastName,
                phoneNumber: patientData.data.phoneNumber,
                dateOfBirth: patientData.data.dateOfBirth,
              };
              setSelectedPatient(patientInfo);
              dispatch({ type: 'SET_PATIENT', payload: patientInfo });
              // Also set the appointment
              dispatch({
                type: 'SET_APPOINTMENT',
                payload: {
                  id: appt.id,
                  date: appt.date,
                  startTime: appt.startTime,
                  duration: appt.duration,
                  visitType: appt.visitType,
                  doctorId: appt.doctorId,
                  doctorName: user.name,
                },
              });
              // Load vitals if they exist on the appointment
              if (appt.bloodPressure || appt.weightKg || appt.heightCm || appt.temperatureC) {
                dispatch({
                  type: 'SET_VITALS',
                  payload: {
                    bloodPressure: appt.bloodPressure || undefined,
                    temperatureC: appt.temperatureC || undefined,
                    weightKg: appt.weightKg || undefined,
                    heightCm: appt.heightCm || undefined,
                  },
                });
              }
              // Auto-mark appointment as in_progress
              fetch(`/api/appointments/${appt.id}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'in_progress' }),
              }).catch(() => {});

              // Load existing notes and compte rendu from the appointment
              if (appt.notes) {
                dispatch({ type: 'SET_VISIT_NOTES', payload: appt.notes });
              }
              if (appt.compteRendu) {
                dispatch({ type: 'SET_COMPTE_RENDU', payload: appt.compteRendu });
              }

              // Load existing prescription for this appointment
              try {
                const rxRes = await fetch(`/api/patients/${patientData.data.id}/prescriptions`);
                if (rxRes.ok) {
                  const rxData = await rxRes.json();
                  const prescriptions = rxData.data || [];
                  // Find prescription for today's appointment
                  const todayRx = prescriptions.find((rx: any) => rx.appointmentId === appt.id);
                  if (todayRx) {
                    // Fetch full prescription details with items
                    const fullRxRes = await fetch(`/api/prescriptions/${todayRx.id}`);
                    if (fullRxRes.ok) {
                      const fullRxData = await fullRxRes.json();
                      const fullRx = fullRxData.data;
                      if (fullRx && fullRx.items) {
                        dispatch({
                          type: 'SET_PRESCRIPTION',
                          payload: {
                            id: fullRx.id,
                            items: fullRx.items.map((item: any) => ({
                              medicationId: item.medicationId || '',
                              medicationName: item.medicationName || '',
                              dosage: item.dosage || '',
                              frequency: item.frequency || '',
                              duration: item.duration || '',
                              instructions: item.instructions || '',
                            })),
                          },
                        });
                      }
                    }
                  }
                }
              } catch {}

              // Skip straight to notes for the doctor (past vitals + history)
              dispatch({ type: 'ADVANCE_STEP', payload: { role: user.role } }); // → appointment
              dispatch({ type: 'ADVANCE_STEP', payload: { role: user.role } }); // → vitals
              dispatch({ type: 'ADVANCE_STEP', payload: { role: user.role } }); // → history
              dispatch({ type: 'ADVANCE_STEP', payload: { role: user.role } }); // → notes
            }
          }
        }
      }
    } catch {
      showToast('error', 'Failed to load patient. Try searching instead.');
    }
  }

  // Patient has been confirmed (selected from search or registered)
  const patientConfirmed = selectedPatient !== null;

  // ─── Search mode handlers ─────────────────────────────────────────────────

  function handlePatientSelect(patient: { id: string; firstName: string; lastName: string } | null) {
    if (patient) {
      // Fetch full patient details for confirmation display
      fetchPatientDetails(patient.id);
    } else {
      setSelectedPatient(null);
      setSearchError(undefined);
    }
  }

  async function fetchPatientDetails(patientId: string) {
    try {
      setSearchError(undefined);
      const response = await fetch(`/api/patients/${patientId}`);
      if (!response.ok) {
        setSearchError('Failed to load patient details. Please try again.');
        return;
      }
      const result = await response.json();
      if (result.success && result.data) {
        const patientInfo: PatientInfo = {
          id: result.data.id,
          firstName: result.data.firstName,
          lastName: result.data.lastName,
          phoneNumber: result.data.phoneNumber,
          dateOfBirth: result.data.dateOfBirth,
        };
        setSelectedPatient(patientInfo);
        dispatch({ type: 'SET_PATIENT', payload: patientInfo });
      } else {
        setSearchError('Patient not found. Please try again.');
      }
    } catch {
      setSearchError('Search is unavailable. Please try again.');
    }
  }

  // ─── Registration mode handlers ────────────────────────────────────────────

  function handleFieldChange(field: keyof PatientFormData, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  async function handleRegistrationSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    // Validate using schema from ./validation
    const errors = validatePatientRegistration(formData);
    if (errors) {
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);
    setRegistrationError(null);
    setFieldErrors({});

    try {
      const payload: Record<string, string> = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        dateOfBirth: formData.dateOfBirth,
        phoneNumber: formData.phoneNumber.trim(),
        gender: formData.gender,
      };

      if (formData.secondaryPhone.trim()) payload.secondaryPhone = formData.secondaryPhone.trim();
      if (formData.cinNumber.trim()) payload.cinNumber = formData.cinNumber.trim();
      if (formData.email.trim()) payload.email = formData.email.trim();
      if (formData.address.trim()) payload.address = formData.address.trim();
      if (formData.notes.trim()) payload.notes = formData.notes.trim();

      const response = await fetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        // Map API field errors
        if (result.error?.details) {
          const apiErrors: FieldErrors = {};
          for (const [key, msg] of Object.entries(result.error.details)) {
            apiErrors[key] = msg as string;
          }
          setFieldErrors(apiErrors);
        } else {
          setRegistrationError(result.error?.message || 'Registration failed. Please try again.');
        }
        return;
      }

      // Success — populate Visit_Context
      const patientInfo: PatientInfo = {
        id: result.data.id,
        firstName: result.data.firstName,
        lastName: result.data.lastName,
        phoneNumber: result.data.phoneNumber,
        dateOfBirth: result.data.dateOfBirth,
      };
      setSelectedPatient(patientInfo);
      dispatch({ type: 'SET_PATIENT', payload: patientInfo });
      showToast('success', 'Patient registered successfully');
    } catch {
      setRegistrationError('An unexpected error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Continue handler ───────────────────────────────────────────────────────

  function handleContinue() {
    dispatch({ type: 'ADVANCE_STEP', payload: { role: user.role } });
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div data-testid="patient-step" className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Patient Selection</h2>
        <p className="mt-1 text-sm text-gray-600">
          Search for an existing patient or register a new one.
        </p>
      </div>

      {/* If patient is confirmed, show confirmation instead of form */}
      {patientConfirmed ? (
        <div className="space-y-4">
          <PatientConfirmation patient={selectedPatient!} />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleContinue}
              className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Continue
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedPatient(null);
              }}
              className="text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              Change Patient
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Mode toggle — Search/Register always on top */}
          <div className="flex rounded-lg border border-gray-200 p-1 bg-gray-50" role="tablist" aria-label="Patient mode">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'search'}
              onClick={() => setMode('search')}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                mode === 'search'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Search Existing
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'register'}
              onClick={() => setMode('register')}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                mode === 'register'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Register New
            </button>
          </div>

          {/* Mode content */}
          {mode === 'search' ? (
            <SearchMode
              searchError={searchError}
              onPatientSelect={handlePatientSelect}
            />
          ) : (
            <RegistrationForm
              formData={formData}
              fieldErrors={fieldErrors}
              submitting={submitting}
              registrationError={registrationError}
              onFieldChange={handleFieldChange}
              onSubmit={handleRegistrationSubmit}
            />
          )}

          {/* Today's Queue for Doctors */}
          {(user.role === 'Doctor' || user.role === 'Admin') && todayQueue.length > 0 && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <h3 className="text-sm font-semibold text-blue-800 mb-3">Today&apos;s Patients — Quick Select</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {todayQueue.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleQueueSelect(item)}
                    className="w-full flex items-center justify-between rounded-md border border-blue-100 bg-white px-4 py-3 text-left hover:bg-blue-50 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">{item.patientName}</p>
                      <p className="text-xs text-gray-500">{item.startTime}</p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      item.status === 'waiting' ? 'bg-amber-100 text-amber-800' :
                      item.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {item.status === 'waiting' ? 'Waiting' : item.status === 'in_progress' ? 'In Progress' : 'Scheduled'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {queueLoading && (user.role === 'Doctor' || user.role === 'Admin') && (
            <p className="text-sm text-gray-500">Loading today&apos;s queue...</p>
          )}
        </>
      )}
    </div>
  );
}

// ─── Search Mode ──────────────────────────────────────────────────────────────

interface SearchModeProps {
  searchError: string | undefined;
  onPatientSelect: (patient: { id: string; firstName: string; lastName: string } | null) => void;
}

function SearchMode({ searchError, onPatientSelect }: SearchModeProps) {
  return (
    <div data-testid="patient-search-mode" className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        Search by name or phone number
      </label>
      <PatientSelectorDropdown
        value={null}
        onChange={onPatientSelect}
        limit={20}
        error={searchError}
        placeholder="Type at least 2 characters to search..."
      />
      <p className="text-xs text-gray-500">
        Start typing to search patients by first name, last name, or phone number.
      </p>
    </div>
  );
}

// ─── Registration Form ────────────────────────────────────────────────────────

interface RegistrationFormProps {
  formData: PatientFormData;
  fieldErrors: FieldErrors;
  submitting: boolean;
  registrationError: string | null;
  onFieldChange: (field: keyof PatientFormData, value: string) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}

function RegistrationForm({
  formData,
  fieldErrors,
  submitting,
  registrationError,
  onFieldChange,
  onSubmit,
}: RegistrationFormProps) {
  return (
    <form onSubmit={onSubmit} noValidate data-testid="patient-registration-form" className="space-y-6">
      {/* Registration error banner */}
      {registrationError && (
        <div className="rounded-md bg-red-50 p-3" role="alert">
          <p className="text-sm text-red-700">{registrationError}</p>
        </div>
      )}

      {/* Required fields */}
      <fieldset>
        <legend className="text-sm font-semibold text-gray-900">
          Required Information
        </legend>
        <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
          <FormField id="firstName" label="First Name" required error={fieldErrors.firstName}>
            <input
              id="firstName"
              type="text"
              value={formData.firstName}
              onChange={(e) => onFieldChange('firstName', e.target.value)}
              className={inputClassName(fieldErrors.firstName)}
              placeholder="Enter first name"
              aria-required="true"
              aria-invalid={!!fieldErrors.firstName}
              aria-describedby={fieldErrors.firstName ? 'firstName-error' : undefined}
            />
          </FormField>

          <FormField id="lastName" label="Last Name" required error={fieldErrors.lastName}>
            <input
              id="lastName"
              type="text"
              value={formData.lastName}
              onChange={(e) => onFieldChange('lastName', e.target.value)}
              className={inputClassName(fieldErrors.lastName)}
              placeholder="Enter last name"
              aria-required="true"
              aria-invalid={!!fieldErrors.lastName}
              aria-describedby={fieldErrors.lastName ? 'lastName-error' : undefined}
            />
          </FormField>

          <FormField id="dateOfBirth" label="Date of Birth" required error={fieldErrors.dateOfBirth}>
            <input
              id="dateOfBirth"
              type="date"
              value={formData.dateOfBirth}
              onChange={(e) => onFieldChange('dateOfBirth', e.target.value)}
              className={inputClassName(fieldErrors.dateOfBirth)}
              aria-required="true"
              aria-invalid={!!fieldErrors.dateOfBirth}
              aria-describedby={fieldErrors.dateOfBirth ? 'dateOfBirth-error' : undefined}
            />
          </FormField>

          <FormField id="phoneNumber" label="Phone Number" required error={fieldErrors.phoneNumber}>
            <input
              id="phoneNumber"
              type="tel"
              value={formData.phoneNumber}
              onChange={(e) => onFieldChange('phoneNumber', e.target.value)}
              className={inputClassName(fieldErrors.phoneNumber)}
              placeholder="e.g. +212 6XX XXX XXX"
              aria-required="true"
              aria-invalid={!!fieldErrors.phoneNumber}
              aria-describedby={fieldErrors.phoneNumber ? 'phoneNumber-error' : undefined}
            />
          </FormField>

          <FormField id="gender" label="Gender" required error={fieldErrors.gender}>
            <select
              id="gender"
              value={formData.gender}
              onChange={(e) => onFieldChange('gender', e.target.value)}
              className={inputClassName(fieldErrors.gender)}
              aria-required="true"
              aria-invalid={!!fieldErrors.gender}
              aria-describedby={fieldErrors.gender ? 'gender-error' : undefined}
            >
              <option value="">Select gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </FormField>
        </div>
      </fieldset>

      {/* Optional fields */}
      <fieldset>
        <legend className="text-sm font-semibold text-gray-900">
          Additional Information
        </legend>
        <p className="mt-1 text-xs text-gray-500">Optional fields for a more complete record.</p>
        <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
          <FormField id="secondaryPhone" label="Secondary Phone" error={fieldErrors.secondaryPhone}>
            <input
              id="secondaryPhone"
              type="tel"
              value={formData.secondaryPhone}
              onChange={(e) => onFieldChange('secondaryPhone', e.target.value)}
              className={inputClassName(fieldErrors.secondaryPhone)}
              placeholder="e.g. +212 5XX XXX XXX"
            />
          </FormField>

          <FormField id="cinNumber" label="CIN Number" error={fieldErrors.cinNumber}>
            <input
              id="cinNumber"
              type="text"
              value={formData.cinNumber}
              onChange={(e) => onFieldChange('cinNumber', e.target.value)}
              className={inputClassName(fieldErrors.cinNumber)}
              placeholder="National ID number"
            />
          </FormField>

          <FormField id="email" label="Email" error={fieldErrors.email}>
            <input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => onFieldChange('email', e.target.value)}
              className={inputClassName(fieldErrors.email)}
              placeholder="patient@example.com"
              aria-invalid={!!fieldErrors.email}
              aria-describedby={fieldErrors.email ? 'email-error' : undefined}
            />
          </FormField>
        </div>

        <div className="mt-4">
          <FormField id="address" label="Address" error={fieldErrors.address}>
            <textarea
              id="address"
              rows={2}
              value={formData.address}
              onChange={(e) => onFieldChange('address', e.target.value)}
              className={inputClassName(fieldErrors.address)}
              placeholder="Street address, city, postal code"
            />
          </FormField>
        </div>

        <div className="mt-4">
          <FormField id="notes" label="Notes" error={fieldErrors.notes}>
            <textarea
              id="notes"
              rows={2}
              value={formData.notes}
              onChange={(e) => onFieldChange('notes', e.target.value)}
              className={inputClassName(fieldErrors.notes)}
              placeholder="Additional remarks"
            />
          </FormField>
        </div>
      </fieldset>

      {/* Submit button */}
      <div className="border-t border-gray-200 pt-4">
        <button
          type="submit"
          disabled={submitting}
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
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Registering...
            </>
          ) : (
            'Register Patient'
          )}
        </button>
      </div>
    </form>
  );
}

// ─── Patient Confirmation ─────────────────────────────────────────────────────

interface PatientConfirmationProps {
  patient: PatientInfo;
}

function PatientConfirmation({ patient }: PatientConfirmationProps) {
  return (
    <div
      data-testid="patient-confirmation"
      className="rounded-md border border-green-200 bg-green-50 p-4"
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <svg
            className="h-5 w-5 text-green-600"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <h3 className="text-sm font-medium text-green-800">Patient Confirmed</h3>
          <dl className="mt-2 space-y-1 text-sm text-green-700">
            <div className="flex gap-2">
              <dt className="font-medium">Name:</dt>
              <dd>{patient.firstName} {patient.lastName}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-medium">Phone:</dt>
              <dd>{patient.phoneNumber}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-medium">Date of Birth:</dt>
              <dd>{patient.dateOfBirth}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}

// ─── Helper Components ────────────────────────────────────────────────────────

interface FormFieldProps {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}

function FormField({ id, label, required, error, children }: FormFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="ml-0.5 text-red-500" aria-hidden="true">*</span>}
      </label>
      <div className="mt-1">{children}</div>
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// ─── Styling Utilities ────────────────────────────────────────────────────────

function inputClassName(error?: string): string {
  const base =
    'block w-full rounded-md border px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-0';
  if (error) {
    return `${base} border-red-300 text-red-900 focus:border-red-500 focus:ring-red-500`;
  }
  return `${base} border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-blue-500`;
}

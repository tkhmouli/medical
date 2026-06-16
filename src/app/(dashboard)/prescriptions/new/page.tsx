'use client';

import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '@/components/NotificationToast';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { PatientSelectorDropdown } from '@/components/PatientSelectorDropdown';
import { DoctorSelectorDropdown } from '@/components/DoctorSelectorDropdown';
import { AppointmentSelector } from '@/components/AppointmentSelector';

// --- Types ---

interface Medication {
  id: string;
  name: string;
  dosageForm: string;
  defaultInstructions: string | null;
  isActive: boolean;
}

interface PrescriptionItemForm {
  medicationId: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: string;
  tenantId: string;
}

// --- Initial empty item ---

function createEmptyItem(): PrescriptionItemForm {
  return {
    medicationId: '',
    dosage: '',
    frequency: '',
    duration: '',
    instructions: '',
  };
}

// --- Main Component ---

/**
 * Create Prescription page.
 * Allows Admin/Doctor to create a prescription associated with a patient and appointment.
 * Uses PatientSelectorDropdown, DoctorSelectorDropdown, and AppointmentSelector components.
 * Supports pre-fill from URL params (patientId, appointmentId).
 *
 * Requirements: 1.5, 1.6, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 5.2, 5.3, 5.4, 5.5,
 *              6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 7.4, 12.1, 12.2, 12.3, 12.4, 12.5, 13.5
 */
export default function NewPrescriptionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();

  // URL params for pre-fill
  const urlPatientId = searchParams.get('patientId') || '';
  const urlAppointmentId = searchParams.get('appointmentId') || '';

  // Form state
  const [patientId, setPatientId] = useState<string | null>(urlPatientId || null);
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [appointmentId, setAppointmentId] = useState<string | null>(urlAppointmentId || null);
  const [items, setItems] = useState<PrescriptionItemForm[]>([createEmptyItem()]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Patient pre-fill state
  const [patientLocked, setPatientLocked] = useState(false);
  const [patientDisplayName, setPatientDisplayName] = useState('');
  const [patientError, setPatientError] = useState<string | undefined>(undefined);

  // Session state
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  // Data state
  const [medications, setMedications] = useState<Medication[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Result state
  const [createdPrescriptionId, setCreatedPrescriptionId] = useState<string | null>(null);

  // Error state
  const [formError, setFormError] = useState<string | null>(null);
  const [doctorError, setDoctorError] = useState<string | undefined>(undefined);

  // Fetch session user info
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
        // Session fetch failed — user may not be authenticated
      } finally {
        setSessionLoading(false);
      }
    }
    fetchSession();
  }, []);

  // Validate patient from URL param
  useEffect(() => {
    if (!urlPatientId) return;

    async function validatePatient() {
      try {
        const response = await fetch(`/api/patients/${encodeURIComponent(urlPatientId)}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            const patient = data.data;
            setPatientDisplayName(`${patient.firstName} ${patient.lastName}`);
            setPatientLocked(true);
            setPatientId(patient.id);
            setPatientError(undefined);
          } else {
            setPatientError('Patient not found');
            setPatientLocked(false);
            setPatientId(null);
          }
        } else {
          setPatientError('Patient not found');
          setPatientLocked(false);
          setPatientId(null);
        }
      } catch {
        setPatientError('Patient not found');
        setPatientLocked(false);
        setPatientId(null);
      }
    }

    validatePatient();
  }, [urlPatientId]);

  // Fetch medications (active only)
  const fetchFormData = useCallback(async () => {
    setLoadingData(true);
    try {
      const medsResponse = await fetch('/api/medications');

      if (medsResponse.ok) {
        const medsData = await medsResponse.json();
        const allMeds: Medication[] = medsData.data || [];
        setMedications(allMeds.filter((m) => m.isActive));
      }
    } catch {
      showToast('error', 'Failed to load form data');
    } finally {
      setLoadingData(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchFormData();
  }, [fetchFormData]);

  // --- Patient selection handler ---

  function handlePatientChange(patient: { id: string; firstName: string; lastName: string } | null) {
    if (patient) {
      setPatientId(patient.id);
      setPatientError(undefined);
    } else {
      setPatientId(null);
      setAppointmentId(null);
    }
  }

  // --- Doctor selection handler ---

  function handleDoctorChange(newDoctorId: string | null) {
    setDoctorId(newDoctorId);
    if (newDoctorId) {
      setDoctorError(undefined);
    }
  }

  // --- Appointment selection handler ---

  function handleAppointmentChange(newAppointmentId: string | null) {
    setAppointmentId(newAppointmentId);
  }

  // --- Item management ---

  const addItem = () => {
    setItems((prev) => [...prev, createEmptyItem()]);
  };

  const removeItem = (index: number) => {
    setItems((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  };

  const updateItem = (index: number, field: keyof PrescriptionItemForm, value: string) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const updated = { ...item, [field]: value };

        // Auto-fill default instructions when a medication is selected
        if (field === 'medicationId' && value) {
          const medication = medications.find((m) => m.id === value);
          if (medication?.defaultInstructions && !item.instructions) {
            updated.instructions = medication.defaultInstructions;
          }
        }

        return updated;
      })
    );
  };

  // --- Validation ---

  function validate(): boolean {
    if (!patientId) {
      setFormError('Please select a patient.');
      return false;
    }
    if (patientError) {
      setFormError('Cannot submit: patient not found.');
      return false;
    }
    if (!doctorId) {
      setFormError('Please select a prescribing doctor.');
      setDoctorError('A prescribing doctor is required');
      return false;
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.medicationId) {
        setFormError(`Item ${i + 1}: Please select a medication.`);
        return false;
      }
      if (!item.dosage.trim()) {
        setFormError(`Item ${i + 1}: Dosage is required.`);
        return false;
      }
      if (!item.frequency.trim()) {
        setFormError(`Item ${i + 1}: Frequency is required.`);
        return false;
      }
      if (!item.duration.trim()) {
        setFormError(`Item ${i + 1}: Duration is required.`);
        return false;
      }
    }

    setFormError(null);
    return true;
  }

  // --- Submit ---

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!validate()) return;

    setSubmitting(true);
    setFormError(null);

    try {
      const payload = {
        patientId,
        doctorId,
        appointmentId: appointmentId || undefined,
        notes: notes.trim() || undefined,
        items: items.map((item) => ({
          medicationId: item.medicationId,
          dosage: item.dosage.trim(),
          frequency: item.frequency.trim(),
          duration: item.duration.trim(),
          instructions: item.instructions.trim() || undefined,
        })),
      };

      const response = await fetch('/api/prescriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        const errorMsg = result.error?.message || 'Failed to create prescription.';
        setFormError(errorMsg);
        showToast('error', errorMsg);
        return;
      }

      showToast('success', 'Prescription created successfully');
      setCreatedPrescriptionId(result.data?.id || null);
    } catch {
      setFormError('An unexpected error occurred. Please try again.');
      showToast('error', 'An unexpected error occurred.');
    } finally {
      setSubmitting(false);
    }
  }

  // --- PDF Download ---

  const handleDownloadPdf = async () => {
    if (!createdPrescriptionId) return;
    try {
      const response = await fetch(`/api/prescriptions/${createdPrescriptionId}/pdf`);
      if (!response.ok) {
        showToast('error', 'Failed to generate PDF');
        return;
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `prescription-${createdPrescriptionId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
      showToast('error', 'Failed to download PDF');
    }
  };

  // --- Loading state ---

  if (loadingData || sessionLoading) {
    return (
      <div>
        <div className="mb-8">
          <Link
            href="/prescriptions"
            className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
          >
            ← Back to Prescriptions
          </Link>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-900">
            New Prescription
          </h1>
        </div>
        <LoadingSpinner label="Loading form data..." />
      </div>
    );
  }

  // --- Success state ---

  if (createdPrescriptionId) {
    return (
      <div>
        <div className="mb-8">
          <Link
            href="/prescriptions"
            className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
          >
            ← Back to Prescriptions
          </Link>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-900">
            Prescription Created
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
              Prescription has been created successfully.
            </p>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleDownloadPdf}
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
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                />
              </svg>
              Download PDF
            </button>

            <Link
              href="/prescriptions"
              className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              View All Prescriptions
            </Link>

            <button
              type="button"
              onClick={() => {
                setCreatedPrescriptionId(null);
                setItems([createEmptyItem()]);
                setNotes('');
                setAppointmentId(null);
                if (!patientLocked) {
                  setPatientId(null);
                }
                setDoctorId(sessionUser?.role === 'Doctor' ? sessionUser.id : null);
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

  // Determine if doctor should be auto-selected
  const doctorAutoSelectId = sessionUser?.role === 'Doctor' ? sessionUser.id : undefined;

  // Determine if form can be submitted
  const isSubmitDisabled = submitting || !!patientError;

  // --- Form state ---

  return (
    <div>
      {/* Page header */}
      <div className="mb-8">
        <Link
          href="/prescriptions"
          className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
        >
          ← Back to Prescriptions
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-900">
          New Prescription
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Select a patient, doctor, and optionally an appointment, then add medications from the catalog.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="max-w-3xl space-y-8">
        {/* Error banner */}
        {formError && (
          <div
            className="rounded-md border border-red-200 bg-red-50 px-4 py-3"
            role="alert"
          >
            <p className="text-sm text-red-700">{formError}</p>
          </div>
        )}

        {/* Patient, Doctor & Appointment Selection */}
        <fieldset>
          <legend className="text-base font-semibold text-gray-900">
            Patient, Doctor & Appointment
          </legend>
          <p className="mt-1 text-sm text-gray-500">
            Associate this prescription with a patient, prescribing doctor, and optionally an appointment.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
            {/* Patient Selection */}
            <div>
              <label
                htmlFor="patient-selector"
                className="block text-sm font-medium text-gray-700"
              >
                Patient <span className="text-red-500" aria-hidden="true">*</span>
              </label>
              <div className="mt-1">
                <PatientSelectorDropdown
                  value={patientId}
                  onChange={handlePatientChange}
                  limit={50}
                  disabled={patientLocked}
                  displayName={patientDisplayName}
                  error={patientError}
                  placeholder="Search patients by name or phone..."
                />
              </div>
            </div>

            {/* Doctor Selection */}
            <div>
              <DoctorSelectorDropdown
                value={doctorId}
                onChange={handleDoctorChange}
                autoSelectId={doctorAutoSelectId}
                error={doctorError}
              />
            </div>

            {/* Appointment Selection */}
            <div className="sm:col-span-2">
              <AppointmentSelector
                patientId={patientId}
                value={appointmentId}
                onChange={handleAppointmentChange}
                preSelectId={urlAppointmentId || undefined}
              />
            </div>
          </div>
        </fieldset>

        {/* Medications */}
        <fieldset>
          <legend className="text-base font-semibold text-gray-900">
            Medications
          </legend>
          <p className="mt-1 text-sm text-gray-500">
            Add one or more medications from the active catalog.
          </p>

          <div className="mt-4 space-y-4">
            {items.map((item, index) => (
              <MedicationItemRow
                key={index}
                index={index}
                item={item}
                medications={medications}
                onUpdate={updateItem}
                onRemove={removeItem}
                canRemove={items.length > 1}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={addItem}
            className="mt-4 inline-flex items-center gap-1 rounded-md border border-dashed border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:border-gray-400 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Medication
          </button>
        </fieldset>

        {/* Notes */}
        <div>
          <label
            htmlFor="notes"
            className="block text-sm font-medium text-gray-700"
          >
            Additional Notes
          </label>
          <div className="mt-1">
            <textarea
              id="notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Optional notes for this prescription"
            />
          </div>
        </div>

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
              'Create Prescription'
            )}
          </button>
          <Link
            href="/prescriptions"
            className="text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

// --- Medication Item Row ---

interface MedicationItemRowProps {
  index: number;
  item: PrescriptionItemForm;
  medications: Medication[];
  onUpdate: (index: number, field: keyof PrescriptionItemForm, value: string) => void;
  onRemove: (index: number) => void;
  canRemove: boolean;
}

function MedicationItemRow({
  index,
  item,
  medications,
  onUpdate,
  onRemove,
  canRemove,
}: MedicationItemRowProps) {
  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-700">
          Medication {index + 1}
        </h4>
        {canRemove && (
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="rounded p-1 text-gray-400 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500"
            aria-label={`Remove medication ${index + 1}`}
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        {/* Medication select */}
        <div className="sm:col-span-2 lg:col-span-3">
          <label
            htmlFor={`medication-${index}`}
            className="block text-xs font-medium text-gray-600"
          >
            Medication <span className="text-red-500" aria-hidden="true">*</span>
          </label>
          <select
            id={`medication-${index}`}
            value={item.medicationId}
            onChange={(e) => onUpdate(index, 'medicationId', e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-required="true"
          >
            <option value="">Select medication</option>
            {medications.map((med) => (
              <option key={med.id} value={med.id}>
                {med.name} ({med.dosageForm})
              </option>
            ))}
          </select>
        </div>

        {/* Dosage */}
        <div>
          <label
            htmlFor={`dosage-${index}`}
            className="block text-xs font-medium text-gray-600"
          >
            Dosage <span className="text-red-500" aria-hidden="true">*</span>
          </label>
          <input
            id={`dosage-${index}`}
            type="text"
            value={item.dosage}
            onChange={(e) => onUpdate(index, 'dosage', e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g. 500mg"
            aria-required="true"
          />
        </div>

        {/* Frequency */}
        <div>
          <label
            htmlFor={`frequency-${index}`}
            className="block text-xs font-medium text-gray-600"
          >
            Frequency <span className="text-red-500" aria-hidden="true">*</span>
          </label>
          <input
            id={`frequency-${index}`}
            type="text"
            value={item.frequency}
            onChange={(e) => onUpdate(index, 'frequency', e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g. 3 times daily"
            aria-required="true"
          />
        </div>

        {/* Duration */}
        <div>
          <label
            htmlFor={`duration-${index}`}
            className="block text-xs font-medium text-gray-600"
          >
            Duration <span className="text-red-500" aria-hidden="true">*</span>
          </label>
          <input
            id={`duration-${index}`}
            type="text"
            value={item.duration}
            onChange={(e) => onUpdate(index, 'duration', e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g. 7 days"
            aria-required="true"
          />
        </div>

        {/* Instructions */}
        <div className="sm:col-span-2 lg:col-span-3">
          <label
            htmlFor={`instructions-${index}`}
            className="block text-xs font-medium text-gray-600"
          >
            Instructions
          </label>
          <input
            id={`instructions-${index}`}
            type="text"
            value={item.instructions}
            onChange={(e) => onUpdate(index, 'instructions', e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g. Take after meals"
          />
        </div>
      </div>
    </div>
  );
}

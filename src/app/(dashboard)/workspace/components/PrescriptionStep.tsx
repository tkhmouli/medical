'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { DoctorSelectorDropdown } from '@/components/DoctorSelectorDropdown';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { validatePrescription } from './validation';
import type { VisitContextState, VisitContextAction, PrescriptionItemInfo } from './visit-context';

// ─── Types ────────────────────────────────────────────────────────────────────

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

export interface PrescriptionStepProps {
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createEmptyItem(): PrescriptionItemForm {
  return {
    medicationId: '',
    dosage: '',
    frequency: '',
    duration: '',
    instructions: '',
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * PrescriptionStep component for the unified patient workflow.
 * Allows Doctor/Admin to create a prescription with medication items.
 * Auto-selects the logged-in doctor for Doctor role, leaves empty for Admin.
 * Fetches medication catalog on mount. Supports skip action.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10
 */
export function PrescriptionStep({ state, dispatch, user }: PrescriptionStepProps) {
  // ─── Allow editing even when navigated back ─────────────────────────────────
  const isReadOnly = false; // Always allow editing — doctor can re-do prescription

  // ─── Form state ─────────────────────────────────────────────────────────────
  const [doctorId] = useState<string | null>(user.id); // Always the signed-in user
  const [items, setItems] = useState<PrescriptionItemForm[]>(() => {
    // Load from state if prescription items exist (re-opening patient)
    if (state.prescriptionItems && state.prescriptionItems.length > 0) {
      return state.prescriptionItems.map(item => ({
        medicationId: item.medicationId,
        dosage: item.dosage,
        frequency: item.frequency,
        duration: item.duration,
        instructions: item.instructions,
      }));
    }
    return [createEmptyItem()];
  });
  const [submitting, setSubmitting] = useState(false);
  const itemsRef = useRef(items);
  const doctorIdRef = useRef(doctorId);
  const stateRef = useRef(state);
  itemsRef.current = items;
  doctorIdRef.current = doctorId;
  stateRef.current = state;

  // Auto-save prescription on unmount if any medication is selected
  useEffect(() => {
    return () => {
      // Don't auto-save if already saved
      if (stateRef.current.prescriptionId) return;

      const filledItems = itemsRef.current.filter(item => item.medicationId);
      if (filledItems.length === 0) return;
      if (!stateRef.current.patient?.id) return;

      const payload: Record<string, any> = {
        patientId: stateRef.current.patient.id,
        doctorId: doctorIdRef.current || stateRef.current.appointment?.doctorId,
        items: filledItems.map(item => ({
          medicationId: item.medicationId,
          dosage: item.dosage.trim() || 'As directed',
          frequency: item.frequency.trim() || 'As needed',
          duration: item.duration.trim() || 'As prescribed',
          instructions: item.instructions.trim() || undefined,
        })),
      };

      if (stateRef.current.appointment?.id) {
        payload.appointmentId = stateRef.current.appointment.id;
      }

      // Use sendBeacon for reliable save on unmount
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      navigator.sendBeacon('/api/prescriptions', blob);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [doctorError, setDoctorError] = useState<string | undefined>(undefined);

  // ─── Medication catalog state ───────────────────────────────────────────────
  const [medications, setMedications] = useState<Medication[]>([]);
  const [loadingMedications, setLoadingMedications] = useState(true);
  const [medicationLoadError, setMedicationLoadError] = useState<string | null>(null);

  // ─── Doctor load error state ────────────────────────────────────────────────
  const [doctorLoadError, setDoctorLoadError] = useState<string | null>(null);

  // ─── Fetch medication catalog on mount ──────────────────────────────────────
  const fetchMedications = useCallback(async () => {
    setLoadingMedications(true);
    setMedicationLoadError(null);
    try {
      const response = await fetch('/api/medications');
      if (!response.ok) {
        throw new Error('Failed to load medications');
      }
      const data = await response.json();
      if (!data.success || !Array.isArray(data.data)) {
        throw new Error('Invalid response format');
      }
      const activeMeds: Medication[] = (data.data as Medication[]).filter(
        (m) => m.isActive
      );
      setMedications(activeMeds);
      if (activeMeds.length === 0) {
        setMedicationLoadError('No active medications available in the catalog.');
      }
    } catch {
      setMedicationLoadError('Could not load medication catalog. Please try again later.');
      setMedications([]);
    } finally {
      setLoadingMedications(false);
    }
  }, []);

  useEffect(() => {
    fetchMedications();
  }, [fetchMedications]);

  // ─── Read-only view (when navigated back to completed step) ─────────────────
  if (isReadOnly) {
    return (
      <div
        data-testid="prescription-step-readonly"
        className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
      >
        <h2 className="text-lg font-semibold text-gray-900">Prescription</h2>

        {state.prescriptionSkipped ? (
          <div className="mt-4">
            <p className="text-sm text-gray-500 italic">Prescription was skipped.</p>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-gray-600">
              Prescription ID: <span className="font-medium">{state.prescriptionId}</span>
            </p>
            {state.prescriptionItems.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-700">Medications:</h3>
                {state.prescriptionItems.map((item, index) => (
                  <div
                    key={index}
                    className="rounded-md border border-gray-100 bg-gray-50 p-3 text-sm"
                  >
                    <p className="font-medium text-gray-800">{item.medicationName}</p>
                    <p className="text-gray-600">
                      {item.dosage} — {item.frequency} — {item.duration}
                    </p>
                    {item.instructions && (
                      <p className="mt-1 text-gray-500 italic">{item.instructions}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ─── Item management ────────────────────────────────────────────────────────
  const addItem = () => {
    if (items.length >= 20) return;
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

  // ─── Doctor change handler ──────────────────────────────────────────────────
  const handleDoctorChange = (newDoctorId: string | null) => {
    setDoctorId(newDoctorId);
    if (newDoctorId) {
      setDoctorError(undefined);
    }
  };

  const handleDoctorLoadError = (error: string | null) => {
    setDoctorLoadError(error);
  };

  // ─── Submit handler ─────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setDoctorError(undefined);

    // Validate using prescriptionSchema from validation.ts
    const validationData = {
      doctorId: doctorId || '',
      items: items.map((item) => ({
        medicationId: item.medicationId,
        dosage: item.dosage.trim(),
        frequency: item.frequency.trim(),
        duration: item.duration.trim(),
        instructions: item.instructions.trim() || undefined,
      })),
    };

    const errors = validatePrescription(validationData);
    if (errors) {
      setFieldErrors(errors);
      // Set specific doctor error if present
      if (errors.doctorId) {
        setDoctorError(errors.doctorId);
      }
      // Set a general form error for user
      const firstError = Object.values(errors)[0];
      setFormError(firstError || 'Please fix the errors below.');
      return;
    }

    setSubmitting(true);

    try {
      // Build payload — only include appointmentId if it exists
      const payload: Record<string, unknown> = {
        patientId: state.patient?.id,
        doctorId,
        items: items.map((item) => ({
          medicationId: item.medicationId,
          dosage: item.dosage.trim(),
          frequency: item.frequency.trim(),
          duration: item.duration.trim(),
          instructions: item.instructions.trim() || undefined,
        })),
      };

      if (state.appointment?.id) {
        payload.appointmentId = state.appointment.id;
      }

      const response = await fetch('/api/prescriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        const errorMsg = result.error?.message || 'Failed to create prescription.';
        setFormError(errorMsg);
        return;
      }

      // Build prescription items info for context
      const prescriptionItems: PrescriptionItemInfo[] = items.map((item) => {
        const med = medications.find((m) => m.id === item.medicationId);
        return {
          medicationId: item.medicationId,
          medicationName: med?.name || 'Unknown',
          dosage: item.dosage.trim(),
          frequency: item.frequency.trim(),
          duration: item.duration.trim(),
          instructions: item.instructions.trim(),
        };
      });

      // Dispatch SET_PRESCRIPTION — stay on this step so doctor can download PDF
      dispatch({
        type: 'SET_PRESCRIPTION',
        payload: { id: result.data.id, items: prescriptionItems },
      });
      // Don't advance — let doctor download PDF first, then click Continue
    } catch {
      setFormError('An unexpected error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Skip handler ──────────────────────────────────────────────────────────
  const handleSkip = () => {
    dispatch({ type: 'SKIP_PRESCRIPTION' });
    dispatch({ type: 'ADVANCE_STEP', payload: { role: user.role as 'Admin' | 'Doctor' | 'Medical_Assistant' } });
  };

  // ─── Determine submit disabled state ───────────────────────────────────────
  const isSubmitDisabled =
    submitting ||
    !!medicationLoadError ||
    loadingMedications ||
    !!doctorLoadError;

  // ─── Loading state ──────────────────────────────────────────────────────────
  if (loadingMedications) {
    return (
      <div
        data-testid="prescription-step-loading"
        className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
      >
        <h2 className="text-lg font-semibold text-gray-900">Prescription</h2>
        <div className="mt-4">
          <LoadingSpinner label="Loading medication catalog..." />
        </div>
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      data-testid="prescription-step"
      className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
    >
      <h2 className="text-lg font-semibold text-gray-900">Prescription</h2>
      <p className="mt-1 text-sm text-gray-500">
        Select medications below — auto-saved when you navigate. Patient: <span className="font-medium text-gray-700">{state.patient?.firstName} {state.patient?.lastName}</span>
      </p>

      <form onSubmit={(e) => e.preventDefault()} noValidate className="mt-6 space-y-6">
        {/* Error banner */}
        {formError && (
          <div
            className="rounded-md border border-red-200 bg-red-50 px-4 py-3"
            role="alert"
          >
            <p className="text-sm text-red-700">{formError}</p>
          </div>
        )}

        {/* Medication catalog load error */}
        {medicationLoadError && (
          <div
            className="rounded-md border border-red-200 bg-red-50 px-4 py-3"
            role="alert"
          >
            <p className="text-sm text-red-700">{medicationLoadError}</p>
            <button
              type="button"
              onClick={fetchMedications}
              className="mt-2 text-sm font-medium text-red-700 underline hover:text-red-800"
            >
              Retry
            </button>
          </div>
        )}

        {/* Medication items */}
        <fieldset>
          <legend className="text-sm font-semibold text-gray-900">
            Medications
          </legend>
          <p className="mt-1 text-xs text-gray-500">
            Add between 1 and 20 medication items.
          </p>

          <div className="mt-3 space-y-4">
            {items.map((item, index) => (
              <MedicationItemRow
                key={index}
                index={index}
                item={item}
                medications={medications}
                onUpdate={updateItem}
                onRemove={removeItem}
                canRemove={items.length > 1}
                fieldErrors={fieldErrors}
              />
            ))}
          </div>

          {items.length < 20 && (
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
          )}
        </fieldset>

        {/* Print button — only when prescription exists */}
        {state.prescriptionId && (
          <div className="border-t border-gray-200 pt-4 mt-4">
            <button
              type="button"
              onClick={() => {
                window.open(`/api/prescriptions/${state.prescriptionId}/pdf`, '_blank');
              }}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
            >
              🖨️ Print Prescription
            </button>
          </div>
        )}
      </form>
    </div>
  );
}

// ─── Medication Item Row ──────────────────────────────────────────────────────

interface MedicationItemRowProps {
  index: number;
  item: PrescriptionItemForm;
  medications: Medication[];
  onUpdate: (index: number, field: keyof PrescriptionItemForm, value: string) => void;
  onRemove: (index: number) => void;
  canRemove: boolean;
  fieldErrors: Record<string, string>;
}

function MedicationItemRow({
  index,
  item,
  medications,
  onUpdate,
  onRemove,
  canRemove,
  fieldErrors,
}: MedicationItemRowProps) {
  // Extract field-level errors for this item
  const itemErrors = {
    medicationId: fieldErrors[`items.${index}.medicationId`],
    dosage: fieldErrors[`items.${index}.dosage`],
    frequency: fieldErrors[`items.${index}.frequency`],
    duration: fieldErrors[`items.${index}.duration`],
  };

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

      <div className="mt-3 grid grid-cols-1 gap-x-4 gap-y-3 md:grid-cols-2 lg:grid-cols-3">
        {/* Medication select */}
        <div className="md:col-span-2 lg:col-span-3">
          <label
            htmlFor={`rx-medication-${index}`}
            className="block text-xs font-medium text-gray-600"
          >
            Medication <span className="text-red-500" aria-hidden="true">*</span>
          </label>
          <select
            id={`rx-medication-${index}`}
            value={item.medicationId}
            onChange={(e) => onUpdate(index, 'medicationId', e.target.value)}
            className={`mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 ${
              itemErrors.medicationId
                ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
            }`}
            aria-required="true"
            aria-invalid={!!itemErrors.medicationId}
          >
            <option value="">Select medication</option>
            {medications.map((med) => (
              <option key={med.id} value={med.id}>
                {med.name} ({med.dosageForm})
              </option>
            ))}
          </select>
          {itemErrors.medicationId && (
            <p className="mt-1 text-xs text-red-600">{itemErrors.medicationId}</p>
          )}
        </div>

        {/* Dosage */}
        <div>
          <label
            htmlFor={`rx-dosage-${index}`}
            className="block text-xs font-medium text-gray-600"
          >
            Dosage <span className="text-red-500" aria-hidden="true">*</span>
          </label>
          <input
            id={`rx-dosage-${index}`}
            type="text"
            value={item.dosage}
            onChange={(e) => onUpdate(index, 'dosage', e.target.value)}
            maxLength={100}
            className={`mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 ${
              itemErrors.dosage
                ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
            }`}
            placeholder="e.g. 500mg"
            aria-required="true"
            aria-invalid={!!itemErrors.dosage}
          />
          {itemErrors.dosage && (
            <p className="mt-1 text-xs text-red-600">{itemErrors.dosage}</p>
          )}
        </div>

        {/* Frequency */}
        <div>
          <label
            htmlFor={`rx-frequency-${index}`}
            className="block text-xs font-medium text-gray-600"
          >
            Frequency <span className="text-red-500" aria-hidden="true">*</span>
          </label>
          <input
            id={`rx-frequency-${index}`}
            type="text"
            value={item.frequency}
            onChange={(e) => onUpdate(index, 'frequency', e.target.value)}
            maxLength={100}
            className={`mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 ${
              itemErrors.frequency
                ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
            }`}
            placeholder="e.g. 3 times daily"
            aria-required="true"
            aria-invalid={!!itemErrors.frequency}
          />
          {itemErrors.frequency && (
            <p className="mt-1 text-xs text-red-600">{itemErrors.frequency}</p>
          )}
        </div>

        {/* Duration */}
        <div>
          <label
            htmlFor={`rx-duration-${index}`}
            className="block text-xs font-medium text-gray-600"
          >
            Duration <span className="text-red-500" aria-hidden="true">*</span>
          </label>
          <input
            id={`rx-duration-${index}`}
            type="text"
            value={item.duration}
            onChange={(e) => onUpdate(index, 'duration', e.target.value)}
            maxLength={100}
            className={`mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 ${
              itemErrors.duration
                ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
            }`}
            placeholder="e.g. 7 days"
            aria-required="true"
            aria-invalid={!!itemErrors.duration}
          />
          {itemErrors.duration && (
            <p className="mt-1 text-xs text-red-600">{itemErrors.duration}</p>
          )}
        </div>

        {/* Instructions (optional) */}
        <div className="md:col-span-2 lg:col-span-3">
          <label
            htmlFor={`rx-instructions-${index}`}
            className="block text-xs font-medium text-gray-600"
          >
            Instructions
          </label>
          <input
            id={`rx-instructions-${index}`}
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

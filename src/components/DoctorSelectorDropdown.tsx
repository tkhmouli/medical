'use client';

import { useState, useEffect, useRef } from 'react';

// ----------------------------
// Types
// ----------------------------

interface Doctor {
  id: string;
  name: string;
}

export interface DoctorSelectorDropdownProps {
  /** Currently selected doctor ID */
  value: string | null;
  /** Callback when a doctor is selected */
  onChange: (doctorId: string | null) => void;
  /** Auto-select this doctor ID on mount (for logged-in doctor) */
  autoSelectId?: string;
  /** Error message to show */
  error?: string;
  /** Callback when doctor list fails to load or is empty */
  onLoadError?: (error: string | null) => void;
}

// ----------------------------
// Component
// ----------------------------

/**
 * Dropdown that lists active doctors for the current tenant.
 * Fetches from GET /api/doctors on mount, displays sorted alphabetically.
 * Supports auto-selection for single-doctor tenants and logged-in doctor pre-selection.
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.5, 3.6, 5.1, 5.2, 5.6
 */
export function DoctorSelectorDropdown({
  value,
  onChange,
  autoSelectId,
  error,
  onLoadError,
}: DoctorSelectorDropdownProps) {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const hasAutoSelected = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchDoctors() {
      setIsLoading(true);
      setFetchError(null);

      try {
        const response = await fetch('/api/doctors');

        if (!response.ok) {
          throw new Error('Failed to load doctors');
        }

        const json = await response.json();

        if (!json.success || !Array.isArray(json.data)) {
          throw new Error('Invalid response format');
        }

        if (cancelled) return;

        const doctorList: Doctor[] = json.data;
        setDoctors(doctorList);

        // Auto-select logic (only once on initial load)
        if (!hasAutoSelected.current) {
          hasAutoSelected.current = true;

          if (doctorList.length === 1) {
            // Auto-select when only one doctor exists in tenant
            onChange(doctorList[0].id);
          } else if (autoSelectId && doctorList.some((d) => d.id === autoSelectId)) {
            // Auto-select logged-in doctor if provided and valid
            onChange(autoSelectId);
          }
        }

        // Show error if no doctors available
        if (doctorList.length === 0) {
          setFetchError('No doctors available');
          onLoadError?.('No doctors available');
        } else {
          onLoadError?.(null);
        }
      } catch (err) {
        if (cancelled) return;
        setFetchError('Could not load doctors');
        setDoctors([]);
        onLoadError?.('Could not load doctors');
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchDoctors();

    return () => {
      cancelled = true;
    };
  }, [autoSelectId, onChange, onLoadError]);

  const isDisabled = isLoading || doctors.length === 0 || !!fetchError;
  const displayError = error || fetchError;

  return (
    <div className="w-full">
      <label
        htmlFor="doctor-selector"
        className="block text-sm font-medium text-gray-700"
      >
        Doctor
      </label>

      <select
        id="doctor-selector"
        value={value || ''}
        onChange={(e) => {
          const selectedId = e.target.value || null;
          onChange(selectedId);
        }}
        disabled={isDisabled}
        aria-invalid={!!displayError}
        aria-describedby={displayError ? 'doctor-selector-error' : undefined}
        className={`mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 ${
          displayError
            ? 'border-red-300 text-red-900 focus:border-red-500 focus:ring-red-500'
            : 'border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-blue-500'
        } ${isDisabled ? 'cursor-not-allowed bg-gray-50 text-gray-500' : 'bg-white'}`}
      >
        {isLoading ? (
          <option value="">Loading doctors...</option>
        ) : doctors.length === 0 ? (
          <option value="">No doctors available</option>
        ) : (
          <>
            <option value="">Select a doctor</option>
            {doctors.map((doctor) => (
              <option key={doctor.id} value={doctor.id}>
                {doctor.name}
              </option>
            ))}
          </>
        )}
      </select>

      {displayError && (
        <p
          id="doctor-selector-error"
          className="mt-1 text-sm text-red-600"
          role="alert"
        >
          {displayError}
        </p>
      )}
    </div>
  );
}

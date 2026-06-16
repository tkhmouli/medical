'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '@/components/NotificationToast';

// ----------------------------
// Types
// ----------------------------

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

type FieldErrors = Partial<Record<keyof PatientFormData, string>>;

// ----------------------------
// Validation
// ----------------------------

function validateForm(data: PatientFormData): FieldErrors {
  const errors: FieldErrors = {};

  if (!data.firstName.trim()) {
    errors.firstName = 'First name is required';
  }
  if (!data.lastName.trim()) {
    errors.lastName = 'Last name is required';
  }
  if (!data.dateOfBirth) {
    errors.dateOfBirth = 'Date of birth is required';
  }
  if (!data.phoneNumber.trim()) {
    errors.phoneNumber = 'Phone number is required';
  }
  if (!data.gender) {
    errors.gender = 'Gender is required';
  }
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.email = 'Invalid email address';
  }

  return errors;
}

// ----------------------------
// Initial State
// ----------------------------

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

// ----------------------------
// Page Component
// ----------------------------

/**
 * Patient create form page.
 * Submits to POST /api/patients.
 * On success: redirects to /patients.
 * On failure: displays field-level errors from API response.
 *
 * Requirements: 5.1, 5.2, 5.4, 5.5
 */
export default function NewPatientPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [formData, setFormData] = useState<PatientFormData>(INITIAL_FORM_DATA);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  /**
   * Handle field change and clear field-level error on interaction.
   */
  function handleChange(
    field: keyof PatientFormData,
    value: string
  ) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear the error for this field when user modifies it
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  /**
   * Submit handler: validates client-side, then POSTs to API.
   */
  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    // Client-side validation
    const validationErrors = validateForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSubmitting(true);
    setErrors({});

    try {
      // Build payload — only include optional fields if provided
      const payload: Record<string, string> = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        dateOfBirth: formData.dateOfBirth,
        phoneNumber: formData.phoneNumber.trim(),
        gender: formData.gender,
      };

      if (formData.secondaryPhone.trim()) {
        payload.secondaryPhone = formData.secondaryPhone.trim();
      }
      if (formData.cinNumber.trim()) {
        payload.cinNumber = formData.cinNumber.trim();
      }
      if (formData.email.trim()) {
        payload.email = formData.email.trim();
      }
      if (formData.address.trim()) {
        payload.address = formData.address.trim();
      }
      if (formData.notes.trim()) {
        payload.notes = formData.notes.trim();
      }

      const response = await fetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        // Map API field errors to form errors
        if (result.error?.details) {
          const apiErrors: FieldErrors = {};
          for (const [key, msg] of Object.entries(result.error.details)) {
            if (key in INITIAL_FORM_DATA) {
              apiErrors[key as keyof PatientFormData] = msg as string;
            }
          }
          setErrors(apiErrors);
        } else {
          // General error message
          showToast('error', result.error?.message || 'Failed to create patient');
        }
        return;
      }

      // Success — redirect to patient list
      showToast('success', 'Patient created successfully');
      const patientId = result.data?.id;
      if (patientId) {
        router.push(`/patients/${patientId}`);
      } else {
        router.push('/patients');
      }
    } catch {
      showToast('error', 'An unexpected error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      {/* Page header */}
      <div className="mb-8">
        <Link
          href="/patients"
          className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
        >
          ← Back to Patients
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-900">
          New Patient
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Fill in the patient details below. Fields marked with * are required.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} noValidate className="max-w-2xl space-y-8">
        {/* Required Fields Section */}
        <fieldset>
          <legend className="text-base font-semibold text-gray-900">
            Personal Information
          </legend>
          <p className="mt-1 text-sm text-gray-500">
            Required demographic details for the patient record.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
            {/* First Name */}
            <FormField
              id="firstName"
              label="First Name"
              required
              error={errors.firstName}
            >
              <input
                id="firstName"
                type="text"
                value={formData.firstName}
                onChange={(e) => handleChange('firstName', e.target.value)}
                className={inputClassName(errors.firstName)}
                placeholder="Enter first name"
                aria-required="true"
                aria-invalid={!!errors.firstName}
                aria-describedby={errors.firstName ? 'firstName-error' : undefined}
              />
            </FormField>

            {/* Last Name */}
            <FormField
              id="lastName"
              label="Last Name"
              required
              error={errors.lastName}
            >
              <input
                id="lastName"
                type="text"
                value={formData.lastName}
                onChange={(e) => handleChange('lastName', e.target.value)}
                className={inputClassName(errors.lastName)}
                placeholder="Enter last name"
                aria-required="true"
                aria-invalid={!!errors.lastName}
                aria-describedby={errors.lastName ? 'lastName-error' : undefined}
              />
            </FormField>

            {/* Date of Birth */}
            <FormField
              id="dateOfBirth"
              label="Date of Birth"
              required
              error={errors.dateOfBirth}
            >
              <input
                id="dateOfBirth"
                type="date"
                value={formData.dateOfBirth}
                onChange={(e) => handleChange('dateOfBirth', e.target.value)}
                className={inputClassName(errors.dateOfBirth)}
                aria-required="true"
                aria-invalid={!!errors.dateOfBirth}
                aria-describedby={errors.dateOfBirth ? 'dateOfBirth-error' : undefined}
              />
            </FormField>

            {/* Phone Number */}
            <FormField
              id="phoneNumber"
              label="Phone Number"
              required
              error={errors.phoneNumber}
            >
              <input
                id="phoneNumber"
                type="tel"
                value={formData.phoneNumber}
                onChange={(e) => handleChange('phoneNumber', e.target.value)}
                className={inputClassName(errors.phoneNumber)}
                placeholder="e.g. +212 6XX XXX XXX"
                aria-required="true"
                aria-invalid={!!errors.phoneNumber}
                aria-describedby={errors.phoneNumber ? 'phoneNumber-error' : undefined}
              />
            </FormField>

            {/* Gender */}
            <FormField
              id="gender"
              label="Gender"
              required
              error={errors.gender}
            >
              <select
                id="gender"
                value={formData.gender}
                onChange={(e) => handleChange('gender', e.target.value)}
                className={inputClassName(errors.gender)}
                aria-required="true"
                aria-invalid={!!errors.gender}
                aria-describedby={errors.gender ? 'gender-error' : undefined}
              >
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </FormField>
          </div>
        </fieldset>

        {/* Optional Fields Section */}
        <fieldset>
          <legend className="text-base font-semibold text-gray-900">
            Additional Information
          </legend>
          <p className="mt-1 text-sm text-gray-500">
            Optional details for a more complete patient record.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
            {/* Secondary Phone */}
            <FormField
              id="secondaryPhone"
              label="Secondary Phone"
              error={errors.secondaryPhone}
            >
              <input
                id="secondaryPhone"
                type="tel"
                value={formData.secondaryPhone}
                onChange={(e) => handleChange('secondaryPhone', e.target.value)}
                className={inputClassName(errors.secondaryPhone)}
                placeholder="e.g. +212 5XX XXX XXX"
              />
            </FormField>

            {/* CIN Number */}
            <FormField
              id="cinNumber"
              label="CIN Number"
              error={errors.cinNumber}
            >
              <input
                id="cinNumber"
                type="text"
                value={formData.cinNumber}
                onChange={(e) => handleChange('cinNumber', e.target.value)}
                className={inputClassName(errors.cinNumber)}
                placeholder="National ID number"
              />
            </FormField>

            {/* Email */}
            <FormField
              id="email"
              label="Email"
              error={errors.email}
            >
              <input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className={inputClassName(errors.email)}
                placeholder="patient@example.com"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? 'email-error' : undefined}
              />
            </FormField>
          </div>

          {/* Address — full width textarea */}
          <div className="mt-5">
            <FormField
              id="address"
              label="Address"
              error={errors.address}
            >
              <textarea
                id="address"
                rows={3}
                value={formData.address}
                onChange={(e) => handleChange('address', e.target.value)}
                className={inputClassName(errors.address)}
                placeholder="Street address, city, postal code"
              />
            </FormField>
          </div>

          {/* Notes — full width textarea */}
          <div className="mt-5">
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
                placeholder="Additional clinical notes or remarks"
              />
            </FormField>
          </div>
        </fieldset>

        {/* Form Actions */}
        <div className="flex items-center gap-4 border-t border-gray-200 pt-6">
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
              'Create Patient'
            )}
          </button>
          <Link
            href="/patients"
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

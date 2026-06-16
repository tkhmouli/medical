'use client';

import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useToast } from '@/components/NotificationToast';
import type { Role } from '@/lib/auth/permissions';

// ----------------------------
// Types
// ----------------------------

interface UserFormData {
  email: string;
  name: string;
  password: string;
  role: Role | '';
}

type FieldErrors = Partial<Record<keyof UserFormData | '_form', string>>;

// ----------------------------
// Validation
// ----------------------------

function validateForm(data: UserFormData): FieldErrors {
  const errors: FieldErrors = {};

  if (!data.email.trim()) {
    errors.email = 'Email is required';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.email = 'Invalid email address';
  }

  if (!data.name.trim()) {
    errors.name = 'Name is required';
  }

  if (!data.password) {
    errors.password = 'Password is required';
  } else if (data.password.length < 8) {
    errors.password = 'Password must be at least 8 characters';
  }

  if (!data.role) {
    errors.role = 'Role is required';
  }

  return errors;
}

// ----------------------------
// Initial State
// ----------------------------

const INITIAL_FORM_DATA: UserFormData = {
  email: '',
  name: '',
  password: '',
  role: '',
};

// ----------------------------
// Page Component
// ----------------------------

/**
 * Create user form page (Admin only).
 * Submits to POST /api/users.
 * On success: redirects to /users.
 * On conflict (duplicate email): displays "email already in use" error.
 *
 * Requirements: 4.1, 4.4, 4.5
 */
export default function NewUserPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [formData, setFormData] = useState<UserFormData>(INITIAL_FORM_DATA);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [userRole, setUserRole] = useState<Role | null>(null);
  const [checkingAccess, setCheckingAccess] = useState(true);

  // Verify admin access
  const fetchSession = useCallback(async (): Promise<Role | null> => {
    try {
      const response = await fetch('/api/auth/session');
      if (response.ok) {
        const data = await response.json();
        return data.data?.role ?? null;
      }
    } catch {
      // handled by layout redirect
    }
    return null;
  }, []);

  useEffect(() => {
    async function checkAccess() {
      const role = await fetchSession();
      setUserRole(role);
      setCheckingAccess(false);
    }
    checkAccess();
  }, [fetchSession]);

  /**
   * Handle field change and clear field-level error on interaction.
   */
  function handleChange(field: keyof UserFormData, value: string) {
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
      const payload = {
        email: formData.email.trim(),
        name: formData.name.trim(),
        password: formData.password,
        role: formData.role,
      };

      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        // Handle conflict error (duplicate email)
        if (response.status === 409) {
          setErrors({ email: 'Email already in use' });
          return;
        }

        // Map API field errors to form errors
        if (result.error?.fields) {
          const apiErrors: FieldErrors = {};
          for (const [key, msg] of Object.entries(result.error.fields)) {
            if (key in INITIAL_FORM_DATA) {
              apiErrors[key as keyof UserFormData] = msg as string;
            }
          }
          if (Object.keys(apiErrors).length > 0) {
            setErrors(apiErrors);
            return;
          }
        }

        // General error message
        showToast('error', result.error?.message || 'Failed to create user');
        return;
      }

      // Success — redirect to users list
      showToast('success', 'User created successfully');
      router.push('/users');
    } catch {
      showToast('error', 'An unexpected error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // Loading state while checking access
  if (checkingAccess) {
    return <LoadingSpinner label="Checking access..." />;
  }

  // Access denied for non-admin
  if (userRole && userRole !== 'Admin') {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-6 py-12 text-center">
        <p className="text-sm font-medium text-red-800">Access Denied</p>
        <p className="mt-1 text-xs text-red-600">
          Only administrators can create user accounts.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Page header */}
      <div className="mb-8">
        <Link
          href="/users"
          className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
        >
          ← Back to Users
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-900">
          New User
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Create a new staff account. Fields marked with * are required.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} noValidate className="max-w-lg space-y-6">
        {/* Name */}
        <FormField id="name" label="Full Name" required error={errors.name}>
          <input
            id="name"
            type="text"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            className={inputClassName(errors.name)}
            placeholder="Enter full name"
            aria-required="true"
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? 'name-error' : undefined}
          />
        </FormField>

        {/* Email */}
        <FormField id="email" label="Email" required error={errors.email}>
          <input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
            className={inputClassName(errors.email)}
            placeholder="user@clinic.com"
            aria-required="true"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? 'email-error' : undefined}
          />
        </FormField>

        {/* Password */}
        <FormField
          id="password"
          label="Password"
          required
          error={errors.password}
        >
          <input
            id="password"
            type="password"
            value={formData.password}
            onChange={(e) => handleChange('password', e.target.value)}
            className={inputClassName(errors.password)}
            placeholder="Minimum 8 characters"
            aria-required="true"
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? 'password-error' : undefined}
          />
        </FormField>

        {/* Role */}
        <FormField id="role" label="Role" required error={errors.role}>
          <select
            id="role"
            value={formData.role}
            onChange={(e) => handleChange('role', e.target.value)}
            className={inputClassName(errors.role)}
            aria-required="true"
            aria-invalid={!!errors.role}
            aria-describedby={errors.role ? 'role-error' : undefined}
          >
            <option value="">Select a role</option>
            <option value="Admin">Admin</option>
            <option value="Doctor">Doctor</option>
            <option value="Medical_Assistant">Medical Assistant</option>
          </select>
        </FormField>

        {/* Role description */}
        {formData.role && (
          <div className="rounded-md bg-blue-50 border border-blue-200 p-3">
            <p className="text-xs text-blue-800">
              <RoleDescription role={formData.role as Role} />
            </p>
          </div>
        )}

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
              'Create User'
            )}
          </button>
          <Link
            href="/users"
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
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">
        {label}
        {required && (
          <span className="ml-0.5 text-red-500" aria-hidden="true">
            *
          </span>
        )}
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

/**
 * Displays a brief description of what each role can do.
 */
function RoleDescription({ role }: { role: Role }) {
  const descriptions: Record<Role, string> = {
    Admin:
      'Full access to all features including user management, financial data, and prescriptions.',
    Doctor:
      'Access to patient management, appointments, financial data, and prescriptions. Cannot manage users.',
    Medical_Assistant:
      'Access to patient management, appointments, and reminders. Cannot access financial data or prescriptions.',
  };

  return <>{descriptions[role]}</>;
}

// ----------------------------
// Styling Utilities
// ----------------------------

/**
 * Returns Tailwind classes for input/select elements,
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

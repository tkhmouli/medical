'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { PatientSearchBar, type PatientSearchCriteria } from '@/components/PatientSearchBar';

interface PatientListItem {
  id: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  dateOfBirth: string;
}

interface VisitHistoryResult {
  totalCount: number;
  classification: 'first_time' | 'returning';
  lastVisitDate: string | null;
}

interface PatientWithVisitInfo extends PatientListItem {
  classification: 'first_time' | 'returning';
  lastVisitDate: string | null;
}

/**
 * Patient list page with multi-criteria search.
 * Fetches patients from /api/patients with search params.
 * Displays a table with: full name, phone, classification badge, last visit date.
 * Includes debounced search via PatientSearchBar.
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 11.4
 */
export default function PatientsPage() {
  const [patients, setPatients] = useState<PatientWithVisitInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchCriteria, setSearchCriteria] = useState<PatientSearchCriteria>({});
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPatients = useCallback(async (criteria: PatientSearchCriteria) => {
    setLoading(true);
    try {
      // Build query params
      const params = new URLSearchParams();
      if (criteria.firstName) params.set('firstName', criteria.firstName);
      if (criteria.lastName) params.set('lastName', criteria.lastName);
      if (criteria.phoneNumber) params.set('phoneNumber', criteria.phoneNumber);
      if (criteria.dateOfBirth) params.set('dateOfBirth', criteria.dateOfBirth);

      const queryString = params.toString();
      const url = `/api/patients${queryString ? `?${queryString}` : ''}`;

      const response = await fetch(url);
      if (!response.ok) {
        setPatients([]);
        return;
      }

      const data = await response.json();
      const patientList: PatientListItem[] = data.data || [];

      // Fetch visit info for each patient to get classification and last visit date
      const patientsWithVisitInfo = await Promise.all(
        patientList.map(async (patient) => {
          try {
            const visitResponse = await fetch(`/api/patients/${patient.id}/visits`);
            if (visitResponse.ok) {
              const visitData = await visitResponse.json();
              const visitHistory: VisitHistoryResult = visitData.data;
              return {
                ...patient,
                classification: visitHistory.classification,
                lastVisitDate: visitHistory.lastVisitDate,
              };
            }
          } catch {
            // If visit fetch fails, use defaults
          }
          return {
            ...patient,
            classification: 'first_time' as const,
            lastVisitDate: null,
          };
        })
      );

      setPatients(patientsWithVisitInfo);
    } catch {
      setPatients([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchPatients({});
  }, [fetchPatients]);

  // Debounced search handler
  const handleSearch = useCallback(
    (criteria: PatientSearchCriteria) => {
      setSearchCriteria(criteria);

      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

      debounceTimer.current = setTimeout(() => {
        fetchPatients(criteria);
      }, 300);
    },
    [fetchPatients]
  );

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Patients
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Search and manage patient records.
          </p>
        </div>
        <Link
          href="/patients/new"
          className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          + New Patient
        </Link>
      </div>

      {/* Search bar */}
      <div className="mt-6">
        <PatientSearchBar onSearch={handleSearch} />
      </div>

      {/* Patient list */}
      <div className="mt-6">
        {loading ? (
          <div className="flex items-center justify-center py-12" role="status">
            <svg
              className="h-8 w-8 animate-spin text-blue-600"
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
            <span className="ml-3 text-sm text-gray-700">Loading patients...</span>
          </div>
        ) : patients.length === 0 ? (
          <div className="rounded-md border border-gray-200 bg-gray-50 px-6 py-12 text-center">
            <p className="text-sm text-gray-600">No patients found.</p>
            <p className="mt-1 text-xs text-gray-600">
              Try adjusting your search criteria or create a new patient.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                  >
                    Name
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                  >
                    Phone
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                  >
                    Status
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                  >
                    Last Visit
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {patients.map((patient) => (
                  <tr
                    key={patient.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="whitespace-nowrap px-6 py-4">
                      <Link
                        href={`/patients/${patient.id}`}
                        className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {patient.firstName} {patient.lastName}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                      {patient.phoneNumber}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <ClassificationBadge classification={patient.classification} />
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                      {formatDate(patient.lastVisitDate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Badge displaying patient classification (first-time vs. returning).
 */
function ClassificationBadge({
  classification,
}: {
  classification: 'first_time' | 'returning';
}) {
  if (classification === 'returning') {
    return (
      <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
        Returning
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
      First-time
    </span>
  );
}

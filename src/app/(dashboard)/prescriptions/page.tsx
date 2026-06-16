'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { LoadingSpinner } from '@/components/LoadingSpinner';

// --- Types ---

interface PrescriptionListItem {
  id: string;
  appointmentId: string;
  patientId: string;
  doctorId: string;
  doctorName?: string;
  notes: string | null;
  createdAt: string;
}

interface PatientInfo {
  id: string;
  firstName: string;
  lastName: string;
}

interface PrescriptionDisplay extends PrescriptionListItem {
  patientName: string;
}

// --- Main Component ---

/**
 * Prescriptions list page.
 * Displays all prescriptions with date, doctor info, and patient info.
 * Only accessible to Admin and Doctor roles (enforced by API).
 * Provides link to create a new prescription and download PDFs.
 *
 * Requirements: 12.1, 12.4, 12.5, 12.6
 */
export default function PrescriptionsPage() {
  const [prescriptions, setPrescriptions] = useState<PrescriptionDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPrescriptions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch all patients to map patient names
      const patientsResponse = await fetch('/api/patients');
      const patientsData = patientsResponse.ok ? await patientsResponse.json() : { data: [] };
      const patientsList: PatientInfo[] = patientsData.data || [];
      const patientsMap: Record<string, PatientInfo> = {};
      patientsList.forEach((p) => {
        patientsMap[p.id] = p;
      });

      // Fetch prescriptions for each patient that has any
      // Since there's no GET /api/prescriptions endpoint for listing all,
      // we fetch per patient using /api/patients/[id]/prescriptions
      const allPrescriptions: PrescriptionDisplay[] = [];

      await Promise.all(
        patientsList.map(async (patient) => {
          try {
            const response = await fetch(`/api/patients/${patient.id}/prescriptions`);
            if (response.ok) {
              const data = await response.json();
              const patientPrescriptions: PrescriptionListItem[] = data.data || [];
              patientPrescriptions.forEach((rx) => {
                allPrescriptions.push({
                  ...rx,
                  patientName: `${patient.firstName} ${patient.lastName}`,
                });
              });
            }
          } catch {
            // Skip if fetch fails for a patient
          }
        })
      );

      // Sort by createdAt descending (most recent first)
      allPrescriptions.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      setPrescriptions(allPrescriptions);
    } catch {
      setError('Failed to load prescriptions. Please try again.');
      setPrescriptions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrescriptions();
  }, [fetchPrescriptions]);

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const handleDownloadPdf = async (prescriptionId: string) => {
    try {
      const response = await fetch(`/api/prescriptions/${prescriptionId}/pdf`);
      if (!response.ok) {
        return;
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `prescription-${prescriptionId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
      // Silent fail for PDF download
    }
  };

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Prescriptions
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            View and manage patient prescriptions.
          </p>
        </div>
        <Link
          href="/prescriptions/new"
          className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          + New Prescription
        </Link>
      </div>

      {/* Content */}
      <div className="mt-6">
        {loading ? (
          <LoadingSpinner label="Loading prescriptions..." />
        ) : error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-6 py-12 text-center">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        ) : prescriptions.length === 0 ? (
          <div className="rounded-md border border-gray-200 bg-gray-50 px-6 py-12 text-center">
            <p className="text-sm text-gray-600">No prescriptions found.</p>
            <p className="mt-1 text-xs text-gray-600">
              Create a new prescription to get started.
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
                    Date
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                  >
                    Patient
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                  >
                    Doctor
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                  >
                    Notes
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500"
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {prescriptions.map((prescription) => (
                  <tr
                    key={prescription.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                      {formatDate(prescription.createdAt)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <Link
                        href={`/patients/${prescription.patientId}`}
                        className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {prescription.patientName}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                      {prescription.doctorName || 'Dr.'}
                    </td>
                    <td className="max-w-xs truncate px-6 py-4 text-sm text-gray-600">
                      {prescription.notes || '—'}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleDownloadPdf(prescription.id)}
                        className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                        aria-label={`Download PDF for prescription dated ${formatDate(prescription.createdAt)}`}
                      >
                        <svg
                          className="h-3.5 w-3.5"
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
                        PDF
                      </button>
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

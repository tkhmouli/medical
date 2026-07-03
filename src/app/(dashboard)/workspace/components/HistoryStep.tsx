'use client';

import { useState, useEffect, useCallback } from 'react';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import type { VisitContextState, VisitContextAction } from './visit-context';
import type { Role } from '@/lib/auth/permissions';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface HistoryStepProps {
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

// ─── Types ────────────────────────────────────────────────────────────────────

interface VisitRecord {
  appointmentId: string;
  date: string;
  visitType: 'new_visit' | 'control_visit' | 'follow_up';
  doctorName: string;
  notes: string | null;
}

interface VisitHistoryResponse {
  visits: VisitRecord[];
  totalCount: number;
  classification: 'first_time' | 'returning';
  lastVisitDate: string | null;
}

interface PrescriptionSummary {
  id: string;
  appointmentId: string;
  doctorId: string;
  createdAt: string;
  itemCount: number;
}

interface PrescriptionItem {
  id: string;
  prescriptionId: string;
  medicationId: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string | null;
}

interface PrescriptionDetail {
  id: string;
  appointmentId: string;
  createdAt: string;
  items: PrescriptionItem[];
}

// ─── Translation keys (hardcoded English for now) ─────────────────────────────

const t = {
  title: 'Visit History',
  description: 'Review past visits, notes, and prescriptions for this patient.',
  newEncounter: 'New Encounter',
  noHistory: 'No visit history exists for this patient.',
  fetchError: 'Visit history could not be loaded.',
  retry: 'Retry',
  loading: 'Loading visit history...',
  firstTimeVisitor: 'First-time visitor',
  returningPatient: 'Returning patient',
  date: 'Date',
  visitType: 'Visit Type',
  doctor: 'Doctor',
  notes: 'Notes',
  noNotes: 'No notes recorded',
  prescriptions: 'Prescriptions',
  medication: 'Medication',
  dosage: 'Dosage',
  createdOn: 'Created on',
  noPrescriptions: 'No prescriptions for this visit',
  visitTypeLabels: {
    new_visit: 'New Visit',
    control_visit: 'Control Visit',
    follow_up: 'Follow-up',
  } as Record<string, string>,
};

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * HistoryStep displays the visit history for the selected patient.
 * - Fetches visit history from GET /api/patients/{id}/visits (limited to 50 most recent)
 * - Displays visits sorted by date descending (most recent first)
 * - Admin/Doctor: fetches and displays prescription records per visit
 * - Medical_Assistant: hides prescription details
 * - Shows patient classification badge (first-time visitor / returning patient)
 * - "New Encounter" resets Visit_Context and returns to Patient_Step
 * - Handles fetch failure with retry and empty history state
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9
 */
export default function HistoryStep({ state, dispatch, user }: HistoryStepProps) {
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [classification, setClassification] = useState<'first_time' | 'returning'>('first_time');
  const [prescriptionsByVisit, setPrescriptionsByVisit] = useState<
    Map<string, PrescriptionDetail[]>
  >(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const patientId = state.patient?.id;
  const canSeePrescriptions = user.role === 'Admin' || user.role === 'Doctor';

  // ─── Fetch visit history ──────────────────────────────────────────────────

  const fetchHistory = useCallback(async () => {
    if (!patientId) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch visit history
      const visitsResponse = await fetch(`/api/patients/${patientId}/visits`);
      if (!visitsResponse.ok) {
        throw new Error(`Failed to fetch visit history: ${visitsResponse.status}`);
      }

      const visitsJson = await visitsResponse.json();
      const historyData: VisitHistoryResponse = visitsJson.data;

      // Limit to 50 most recent (API already sorts by date DESC)
      const limitedVisits = historyData.visits.slice(0, 50);
      setVisits(limitedVisits);
      setTotalCount(historyData.totalCount);
      setClassification(historyData.classification);

      // For Admin/Doctor: fetch prescription details
      if (canSeePrescriptions && limitedVisits.length > 0) {
        await fetchPrescriptions(patientId, limitedVisits);
      }
    } catch {
      setError(t.fetchError);
    } finally {
      setLoading(false);
    }
  }, [patientId, canSeePrescriptions]);

  // ─── Fetch prescriptions for Admin/Doctor ─────────────────────────────────

  const fetchPrescriptions = async (
    pId: string,
    visitList: VisitRecord[]
  ) => {
    try {
      // Fetch prescription summaries for the patient
      const prescResponse = await fetch(`/api/patients/${pId}/prescriptions`);
      if (!prescResponse.ok) {
        // Silently fail for prescriptions — visits still display
        return;
      }

      const prescJson = await prescResponse.json();
      const summaries: PrescriptionSummary[] = prescJson.data || [];

      if (summaries.length === 0) {
        return;
      }

      // Create a set of appointment IDs from visible visits for filtering
      const visitAppointmentIds = new Set(visitList.map((v) => v.appointmentId));

      // Filter to prescriptions that belong to displayed visits
      const relevantSummaries = summaries.filter((s) =>
        visitAppointmentIds.has(s.appointmentId)
      );

      if (relevantSummaries.length === 0) {
        return;
      }

      // Fetch details for each relevant prescription in parallel
      const detailPromises = relevantSummaries.map(async (summary) => {
        try {
          const detailResponse = await fetch(`/api/prescriptions/${summary.id}`);
          if (!detailResponse.ok) return null;
          const detailJson = await detailResponse.json();
          return {
            id: summary.id,
            appointmentId: summary.appointmentId,
            createdAt: summary.createdAt,
            items: detailJson.data?.items || [],
          } as PrescriptionDetail;
        } catch {
          return null;
        }
      });

      const details = (await Promise.all(detailPromises)).filter(
        (d): d is PrescriptionDetail => d !== null
      );

      // Group prescriptions by appointmentId
      const byVisit = new Map<string, PrescriptionDetail[]>();
      for (const detail of details) {
        const existing = byVisit.get(detail.appointmentId) || [];
        existing.push(detail);
        byVisit.set(detail.appointmentId, existing);
      }

      setPrescriptionsByVisit(byVisit);
    } catch {
      // Silently fail — prescription display is supplementary
    }
  };

  // ─── Effect: fetch on mount ───────────────────────────────────────────────

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleNewEncounter = () => {
    dispatch({ type: 'RESET' });
  };

  const handleRetry = () => {
    fetchHistory();
  };

  // ─── Render: Loading ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div
        data-testid="step-panel-history"
        className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
      >
        <h2 className="text-lg font-semibold text-gray-900">{t.title}</h2>
        <LoadingSpinner size="md" label={t.loading} />
      </div>
    );
  }

  // ─── Render: Error ────────────────────────────────────────────────────────

  if (error) {
    return (
      <div
        data-testid="step-panel-history"
        className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
      >
        <h2 className="text-lg font-semibold text-gray-900">{t.title}</h2>
        <div className="mt-4 rounded-md bg-red-50 p-4" role="alert">
          <p className="text-sm text-red-800">{error}</p>
          <button
            type="button"
            onClick={handleRetry}
            className="mt-2 inline-flex items-center rounded-md bg-red-100 px-3 py-1.5 text-sm font-medium text-red-800 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          >
            {t.retry}
          </button>
        </div>
      </div>
    );
  }

  // ─── Render: Main ─────────────────────────────────────────────────────────

  return (
    <div
      data-testid="step-panel-history"
      className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{t.title}</h2>
          <p className="mt-1 text-sm text-gray-600">{t.description}</p>
        </div>

        {/* Classification badge */}
        {totalCount > 0 && (
          <span
            data-testid="classification-badge"
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
              classification === 'first_time' || totalCount === 1
                ? 'bg-blue-100 text-blue-800'
                : 'bg-green-100 text-green-800'
            }`}
          >
            {totalCount === 1 ? t.firstTimeVisitor : t.returningPatient}
          </span>
        )}
      </div>

      {/* Empty history state */}
      {visits.length === 0 && (
        <div className="mt-6 rounded-md bg-gray-50 p-4">
          <p className="text-sm text-gray-600">{t.noHistory}</p>
        </div>
      )}

      {/* Visit list */}
      {visits.length > 0 && (
        <div className="mt-6 space-y-4">
          {visits.map((visit) => (
            <div
              key={visit.appointmentId}
              className="rounded-lg border border-gray-100 bg-gray-50 p-4"
            >
              {/* Visit details */}
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-4">
                <div>
                  <span className="text-xs font-medium uppercase text-gray-500">
                    {t.date}
                  </span>
                  <p className="text-sm text-gray-900">{visit.date}</p>
                </div>
                <div>
                  <span className="text-xs font-medium uppercase text-gray-500">
                    {t.visitType}
                  </span>
                  <p className="text-sm text-gray-900">
                    {t.visitTypeLabels[visit.visitType] || visit.visitType}
                  </p>
                </div>
                <div>
                  <span className="text-xs font-medium uppercase text-gray-500">
                    {t.doctor}
                  </span>
                  <p className="text-sm text-gray-900">{visit.doctorName}</p>
                </div>
                <div>
                  <span className="text-xs font-medium uppercase text-gray-500">
                    {t.notes}
                  </span>
                  <p className="text-sm text-gray-900">
                    {visit.notes || t.noNotes}
                  </p>
                </div>
              </div>

              {/* Prescription details (Admin/Doctor only) */}
              {canSeePrescriptions && (
                <PrescriptionSection
                  prescriptions={prescriptionsByVisit.get(visit.appointmentId) || []}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* New Encounter action */}
      <div className="mt-6 border-t border-gray-200 pt-4">
        <button
          type="button"
          onClick={handleNewEncounter}
          className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          {t.newEncounter}
        </button>
      </div>
    </div>
  );
}

// ─── Prescription Section Sub-component ───────────────────────────────────────

function PrescriptionSection({
  prescriptions,
}: {
  prescriptions: PrescriptionDetail[];
}) {
  if (prescriptions.length === 0) {
    return (
      <div className="mt-3 border-t border-gray-200 pt-3">
        <span className="text-xs font-medium uppercase text-gray-500">
          {t.prescriptions}
        </span>
        <p className="mt-1 text-sm text-gray-500 italic">{t.noPrescriptions}</p>
      </div>
    );
  }

  return (
    <div className="mt-3 border-t border-gray-200 pt-3">
      <span className="text-xs font-medium uppercase text-gray-500">
        {t.prescriptions}
      </span>
      {prescriptions.map((prescription) => (
        <div key={prescription.id} className="mt-2">
          <p className="text-xs text-gray-500">
            {t.createdOn}{' '}
            {new Date(prescription.createdAt).toLocaleDateString()}
          </p>
          <div className="mt-1 space-y-1">
            {prescription.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2 text-sm text-gray-700"
              >
                <span className="font-medium">{item.medicationName}</span>
                <span className="text-gray-400">—</span>
                <span>{item.dosage}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

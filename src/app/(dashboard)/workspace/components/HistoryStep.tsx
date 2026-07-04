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
      className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-lg">📖</div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Patient History</h2>
            <p className="text-sm text-gray-500">{totalCount} visit{totalCount !== 1 ? 's' : ''} on record</p>
          </div>
        </div>

        {totalCount > 0 && (
          <span
            data-testid="classification-badge"
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
              classification === 'first_time' || totalCount === 1
                ? 'bg-blue-100 text-blue-800'
                : 'bg-green-100 text-green-800'
            }`}
          >
            {totalCount === 1 ? '🆕 First Visit' : '🔄 Returning'}
          </span>
        )}
      </div>

      {/* Empty state */}
      {visits.length === 0 && (
        <div className="mt-6 rounded-lg border-2 border-dashed border-gray-200 p-8 text-center">
          <span className="text-3xl">📋</span>
          <p className="mt-2 text-sm text-gray-500">No previous visits recorded</p>
        </div>
      )}

      {/* Timeline */}
      {visits.length > 0 && (
        <div className="mt-6 space-y-3">
          {visits.map((visit, idx) => {
            const visitColors = {
              new_visit: { bg: 'bg-blue-50', border: 'border-blue-200', dot: 'bg-blue-500', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-800' },
              control_visit: { bg: 'bg-green-50', border: 'border-green-200', dot: 'bg-green-500', text: 'text-green-700', badge: 'bg-green-100 text-green-800' },
              follow_up: { bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-500', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-800' },
            };
            const colors = visitColors[visit.visitType] || visitColors.new_visit;
            const prescriptions = prescriptionsByVisit.get(visit.appointmentId) || [];
            const formattedDate = new Date(visit.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

            return (
              <div
                key={visit.appointmentId}
                className={`rounded-lg border ${colors.border} ${colors.bg} p-4 transition-shadow hover:shadow-md`}
              >
                {/* Visit header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`w-3 h-3 rounded-full ${colors.dot}`} />
                    <span className={`text-sm font-semibold ${colors.text}`}>{formattedDate}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${colors.badge}`}>
                      {t.visitTypeLabels[visit.visitType] || visit.visitType}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">Dr. {visit.doctorName}</span>
                </div>

                {/* Notes */}
                {visit.notes && (
                  <div className="mt-3 rounded-md bg-white/70 p-3">
                    <p className="text-xs font-medium text-gray-600 mb-1">📝 Notes</p>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap line-clamp-3">{visit.notes}</p>
                  </div>
                )}

                {/* Prescriptions */}
                {canSeePrescriptions && prescriptions.length > 0 && (
                  <div className="mt-2 rounded-md bg-white/70 p-3">
                    <p className="text-xs font-medium text-gray-600 mb-1">💊 Medications</p>
                    <div className="flex flex-wrap gap-2">
                      {prescriptions.flatMap(rx => rx.items).map((item) => (
                        <span key={item.id} className="inline-flex items-center rounded-full bg-purple-50 border border-purple-200 px-2.5 py-0.5 text-xs text-purple-800">
                          {item.medicationName} · {item.dosage}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* No notes/prescriptions indicator */}
                {!visit.notes && prescriptions.length === 0 && (
                  <p className="mt-2 text-xs text-gray-400 italic">No details recorded</p>
                )}
              </div>
            );
          })}
        </div>
      )}
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

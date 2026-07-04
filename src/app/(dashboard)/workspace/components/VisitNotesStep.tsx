'use client';

import { useState, useEffect, useRef } from 'react';
import type { Role } from '@/lib/auth/permissions';
import type { VisitContextState, VisitContextAction } from './visit-context';

// ─── Translation keys (hardcoded English for now) ─────────────────────────────

const t = {
  title: 'Visit Notes',
  patientLabel: 'Patient',
  appointmentLabel: 'Appointment Details',
  noAppointment: 'No appointment associated with this encounter',
  dateLabel: 'Date',
  timeLabel: 'Time',
  visitTypeLabel: 'Visit Type',
  notesPlaceholder: 'Enter clinical notes for this visit...',
  saveAndContinue: 'Save & Continue',
  skip: 'Skip',
  saving: 'Saving...',
  saveError: 'Notes could not be saved. Please try again.',
  charCount: (count: number) => `${count} / 5000 characters`,
  readOnlyTitle: 'Visit Notes (Saved)',
  noNotes: 'No notes were recorded for this visit.',
  visitTypes: {
    new_visit: 'New Visit',
    control_visit: 'Control Visit',
    follow_up: 'Follow-up',
  } as Record<string, string>,
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface VisitNotesStepProps {
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

// ─── Component ────────────────────────────────────────────────────────────────

export default function VisitNotesStep({ state, dispatch, user }: VisitNotesStepProps) {
  const [notes, setNotes] = useState(state.visitNotes || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previousVitals, setPreviousVitals] = useState<{
    bloodPressure?: string; temperatureC?: string; weightKg?: number; heightCm?: number; date?: string;
  } | null>(null);
  const notesRef = useRef(notes);
  const stateRef = useRef(state);
  notesRef.current = notes;
  stateRef.current = state;

  const hasAppointment = state.appointment !== null && !state.appointmentSkipped;

  // Auto-save notes when component unmounts (navigating away)
  useEffect(() => {
    return () => {
      const currentNotes = notesRef.current.trim();
      const currentState = stateRef.current;
      if (currentNotes && currentState.appointment) {
        fetch(`/api/appointments/${currentState.appointment.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes: currentNotes }),
          keepalive: true,
        }).catch(() => {});
      }
      if (currentNotes) {
        dispatch({ type: 'SET_VISIT_NOTES', payload: currentNotes });
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch previous vitals for comparison
  useState(() => {
    if (!state.patient) return;
    const today = new Date().toISOString().split('T')[0];
    fetch(`/api/appointments/calendar?startDate=2020-01-01&endDate=${today}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!data?.data) return;
        const currentApptId = state.appointment?.id;
        const prev = data.data
          .filter((a: any) => a.patientId === state.patient!.id && a.id !== currentApptId && (a.bloodPressure || a.weightKg || a.heightCm || a.temperatureC))
          .sort((a: any, b: any) => b.date.localeCompare(a.date));
        if (prev.length > 0) {
          setPreviousVitals({
            bloodPressure: prev[0].bloodPressure,
            temperatureC: prev[0].temperatureC,
            weightKg: prev[0].weightKg,
            heightCm: prev[0].heightCm,
            date: prev[0].date,
          });
        }
      })
      .catch(() => {});
  });

  // ─── Read-only view for completed step (navigated back) ───────────────────

  // ─── Header rendering helper ────────────────────────────────────────────────

  function renderHeader() {
    return (
      <div className="mt-4 space-y-3">
        {/* Patient & appointment info */}
        <div className="rounded-md border border-gray-100 bg-gray-50 p-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-600">{t.patientLabel}:</span>
            <span className="text-sm font-semibold text-gray-900">
              {state.patient ? `${state.patient.firstName} ${state.patient.lastName}` : '—'}
            </span>
          </div>

          {hasAppointment && state.appointment ? (
            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
              <div>
                <span className="text-xs font-medium text-gray-500">{t.dateLabel}</span>
                <p className="text-sm text-gray-900">{state.appointment.date}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-gray-500">{t.timeLabel}</span>
                <p className="text-sm text-gray-900">{state.appointment.startTime}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-gray-500">{t.visitTypeLabel}</span>
                <p className="text-sm text-gray-900">
                  {t.visitTypes[state.appointment.visitType] ?? state.appointment.visitType}
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-sm text-amber-600 italic">{t.noAppointment}</p>
          )}
        </div>

        {/* Vitals summary with icons */}
        {state.vitals && (
          <div className="rounded-md border border-indigo-100 bg-indigo-50 p-4">
            <p className="text-xs font-semibold text-indigo-700 mb-2">Today&apos;s Vitals</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="flex items-center gap-2">
                <span className="text-lg">❤️</span>
                <div>
                  <p className="text-xs text-indigo-600">BP</p>
                  <p className="text-sm font-bold text-indigo-900">{state.vitals.bloodPressure || '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg">🌡️</span>
                <div>
                  <p className="text-xs text-indigo-600">Temp</p>
                  <p className="text-sm font-bold text-indigo-900">{state.vitals.temperatureC ? `${state.vitals.temperatureC}°C` : '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg">⚖️</span>
                <div>
                  <p className="text-xs text-indigo-600">Weight</p>
                  <p className="text-sm font-bold text-indigo-900">{state.vitals.weightKg ? `${state.vitals.weightKg} kg` : '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg">📏</span>
                <div>
                  <p className="text-xs text-indigo-600">Height</p>
                  <p className="text-sm font-bold text-indigo-900">{state.vitals.heightCm ? `${state.vitals.heightCm} cm` : '—'}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Previous vitals for comparison */}
        {previousVitals && (
          <div className="rounded-md border border-amber-100 bg-amber-50 p-4">
            <p className="text-xs font-semibold text-amber-700 mb-2">Previous Visit ({previousVitals.date})</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="flex items-center gap-2">
                <span className="text-lg">❤️</span>
                <div>
                  <p className="text-xs text-amber-600">BP</p>
                  <p className="text-sm font-medium text-amber-900">{previousVitals.bloodPressure || '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg">🌡️</span>
                <div>
                  <p className="text-xs text-amber-600">Temp</p>
                  <p className="text-sm font-medium text-amber-900">{previousVitals.temperatureC ? `${previousVitals.temperatureC}°C` : '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg">⚖️</span>
                <div>
                  <p className="text-xs text-amber-600">Weight</p>
                  <p className="text-sm font-medium text-amber-900">{previousVitals.weightKg ? `${previousVitals.weightKg} kg` : '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg">📏</span>
                <div>
                  <p className="text-xs text-amber-600">Height</p>
                  <p className="text-sm font-medium text-amber-900">{previousVitals.heightCm ? `${previousVitals.heightCm} cm` : '—'}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* No vitals yet indicator */}
        {!state.vitals && !state.vitalsSkipped && (
          <div className="rounded-md border border-gray-100 bg-gray-50 p-3">
            <p className="text-xs text-gray-500 italic">No vitals recorded for this visit. You can go back to the Vitals step to add them.</p>
          </div>
        )}
      </div>
    );
  }

  // ─── Save & Continue handler ────────────────────────────────────────────────

  async function handleSaveAndContinue() {
    setError(null);

    const trimmedNotes = notes.trim();

    // If notes are empty, advance without DB update
    if (!trimmedNotes) {
      dispatch({ type: 'ADVANCE_STEP', payload: { role: user.role } });
      return;
    }

    // If appointment was skipped, store in Visit_Context only
    if (!hasAppointment) {
      dispatch({ type: 'SET_VISIT_NOTES', payload: trimmedNotes });
      dispatch({ type: 'ADVANCE_STEP', payload: { role: user.role } });
      return;
    }

    // Appointment exists — PATCH /api/appointments/{id} with notes
    setIsSaving(true);
    try {
      const response = await fetch(`/api/appointments/${state.appointment!.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: trimmedNotes }),
      });

      if (!response.ok) {
        throw new Error('Failed to save notes');
      }

      dispatch({ type: 'SET_VISIT_NOTES', payload: trimmedNotes });
      dispatch({ type: 'ADVANCE_STEP', payload: { role: user.role } });
    } catch {
      setError(t.saveError);
    } finally {
      setIsSaving(false);
    }
  }

  // ─── Skip handler ──────────────────────────────────────────────────────────

  function handleSkip() {
    dispatch({ type: 'ADVANCE_STEP', payload: { role: user.role } });
  }

  // ─── Active editing view ────────────────────────────────────────────────────

  return (
    <div
      data-testid="step-panel-visit-notes"
      className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
    >
      {/* Title */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
          <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>
        </div>
        <h2 className="text-lg font-semibold text-gray-900">{t.title}</h2>
      </div>

      {/* Header with patient/appointment info */}
      {renderHeader()}

      {/* Notes text area */}
      <div className="mt-6">
        <label htmlFor="visit-notes-input" className="sr-only">
          {t.title}
        </label>
        <textarea
          id="visit-notes-input"
          data-testid="visit-notes-input"
          className="w-full rounded-md border border-gray-300 p-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
          rows={4}
          maxLength={5000}
          placeholder={t.notesPlaceholder}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={isSaving}
          aria-describedby="visit-notes-char-count"
        />
        <p
          id="visit-notes-char-count"
          className="mt-1 text-right text-xs text-gray-500"
        >
          {t.charCount(notes.length)}
        </p>
      </div>

      {/* Error message */}
      {error && (
        <div
          role="alert"
          className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}
    </div>
  );
}

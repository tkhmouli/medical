'use client';

import { useReducer, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Role } from '@/lib/auth/permissions';
import { useToast } from '@/components/NotificationToast';
import {
  visitContextReducer,
  initialVisitContext,
  getVisibleSteps,
  type WorkflowStep,
  type VisitContextState,
  type VisitContextAction,
} from './visit-context';
import StepIndicator from './StepIndicator';
import PatientStep from './PatientStep';
import { AppointmentStep } from './AppointmentStep';
import { VitalsStep } from './VitalsStep';
import VisitNotesStep from './VisitNotesStep';
import { PrescriptionStep } from './PrescriptionStep';
import { LabRequestStep } from './LabRequestStep';
import { CompteRenduStep } from './CompteRenduStep';
import PdfStep from './PdfStep';
import HistoryStep from './HistoryStep';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface WorkspaceClientProps {
  user: {
    id: string;
    name: string;
    email: string;
    role: Role;
    tenantId: string;
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Main client orchestrator for the unified patient workflow workspace.
 * Manages step transitions, Visit_Context state, and renders the active step panel.
 */
export function WorkspaceClient({ user }: WorkspaceClientProps) {
  const [state, dispatch] = useReducer(visitContextReducer, initialVisitContext);
  const { showToast } = useToast();
  const searchParams = useSearchParams();

  // Compute visible steps based on user role
  const visibleSteps = useMemo(() => getVisibleSteps(user.role), [user.role]);

  // ─── Pre-load from URL params ───────────────────────────────────────────────

  useEffect(() => {
    const patientId = searchParams.get('patientId');
    const appointmentId = searchParams.get('appointmentId');

    if (patientId && !state.patient) {
      // Fetch patient and pre-load
      fetch(`/api/patients/${patientId}`)
        .then((res) => res.ok ? res.json() : null)
        .then((data) => {
          if (data?.data) {
            const p = data.data;
            dispatch({
              type: 'SET_PATIENT',
              payload: {
                id: p.id,
                firstName: p.firstName,
                lastName: p.lastName,
                phoneNumber: p.phoneNumber,
                dateOfBirth: p.dateOfBirth,
              },
            });
            // If we have both patient and appointment, skip to the appropriate step
            if (appointmentId) {
              dispatch({ type: 'ADVANCE_STEP', payload: { role: user.role } });
            }
          }
        })
        .catch(() => {});
    }
  }, [searchParams, user.role]);

  // ─── beforeunload warning when encounter has data ───────────────────────────

  useEffect(() => {
    if (state.completedSteps.size === 0) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Modern browsers ignore custom messages but still show a prompt
      e.returnValue = 'You have an in-progress encounter. Data will be lost if you leave.';
      return e.returnValue;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [state.completedSteps.size]);

  // ─── Step click handler ─────────────────────────────────────────────────────

  const handleStepClick = useCallback(
    (step: WorkflowStep) => {
      dispatch({ type: 'NAVIGATE_TO_STEP', payload: step });
    },
    []
  );

  // ─── Keyboard navigation: Ctrl+→ next, Ctrl+← prev ─────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.ctrlKey) return;

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (!state.patient && state.activeStep === 'patient') return;
        dispatch({ type: 'ADVANCE_STEP', payload: { role: user.role } });
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const currentIdx = visibleSteps.indexOf(state.activeStep);
        if (currentIdx === 0) {
          dispatch({ type: 'RESET' });
        } else if (currentIdx > 0) {
          dispatch({ type: 'NAVIGATE_TO_STEP', payload: visibleSteps[currentIdx - 1] });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [user.role, state.activeStep, visibleSteps]);

  // ─── Render active step panel ───────────────────────────────────────────────

  const renderStepPanel = () => {
    switch (state.activeStep) {
      case 'patient':
        return (
          <div
            data-testid="step-panel-patient"
            className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
          >
            <PatientStep state={state} dispatch={dispatch} user={user} />
          </div>
        );

      case 'appointment':
        return (
          <AppointmentStep state={state} dispatch={dispatch} user={user} />
        );

      case 'vitals':
        return (
          <VitalsStep state={state} dispatch={dispatch} user={user} />
        );

      case 'visit_notes':
        return (
          <VisitNotesStep
            state={state}
            dispatch={dispatch}
            user={user}
          />
        );

      case 'prescription':
        return (
          <PrescriptionStep state={state} dispatch={dispatch} user={user} />
        );

      case 'lab_request':
        return (
          <LabRequestStep state={state} dispatch={dispatch} user={user} />
        );

      case 'compte_rendu':
        return (
          <CompteRenduStep state={state} dispatch={dispatch} user={user} />
        );

      case 'history':
        return (
          <HistoryStep state={state} dispatch={dispatch} user={user} />
        );

      default:
        return null;
    }
  };

  // ─── Main render ────────────────────────────────────────────────────────────

  const currentStepIndex = visibleSteps.indexOf(state.activeStep);
  const isLastStep = currentStepIndex === visibleSteps.length - 1;

  return (
    <div className="mx-auto w-full max-w-7xl overflow-x-hidden px-4 py-6 md:px-6 lg:px-8">
      {/* Greeting header */}
      <header className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Patient Workspace
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {state.patient
                ? `Encounter in progress · Step ${currentStepIndex + 1} of ${visibleSteps.length}`
                : "Here's your clinical workflow. Start by selecting a patient."
              }
            </p>
          </div>
          {state.completedSteps.size > 0 && (
            <div className="flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-4 py-1.5">
              <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-xs font-semibold text-blue-700">{state.completedSteps.size}/{visibleSteps.length} completed</span>
            </div>
          )}
        </div>
      </header>

      {/* Patient info card — clean white with blue accent */}
      {state.patient && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600 font-bold text-lg">
                {state.patient.firstName[0]}{state.patient.lastName[0]}
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {state.patient.firstName} {state.patient.lastName}
                </h2>
                <div className="flex items-center gap-3 mt-0.5">
                  {state.patient.dateOfBirth && (
                    <span className="text-sm text-gray-500">{calculateAge(state.patient.dateOfBirth)} years</span>
                  )}
                  {state.patient.phoneNumber && (
                    <span className="text-sm text-gray-500">{state.patient.phoneNumber}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {state.appointment && (
                <div className="hidden sm:flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-800">{state.appointment.startTime}</p>
                    <p className="text-xs text-gray-500">{state.appointment.visitType.replace('_', ' ')}</p>
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={() => dispatch({ type: 'RESET' })}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Change Patient
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step indicator */}
      <div className="mb-6">
        <StepIndicator steps={visibleSteps} activeStep={state.activeStep} completedSteps={state.completedSteps} onStepClick={handleStepClick} />
      </div>

      {/* No patient warning */}
      {!state.patient && state.activeStep !== 'patient' && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-sm">⚠️</div>
          <p className="text-sm text-amber-800 font-medium">Please select a patient first to continue.</p>
        </div>
      )}

      {/* Active step panel */}
      <main className="min-h-[400px]">
        {renderStepPanel()}
      </main>

      {/* Bottom navigation */}
      <div className="mt-6 flex items-center justify-between rounded-xl border border-gray-200 bg-white px-5 py-3 shadow-sm">
        <button
          type="button"
          onClick={() => {
            if (currentStepIndex === 0) { dispatch({ type: 'RESET' }); }
            else { dispatch({ type: 'NAVIGATE_TO_STEP', payload: visibleSteps[currentStepIndex - 1] }); }
          }}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
          {currentStepIndex === 0 ? 'Reset' : 'Back'}
        </button>

        <div className="hidden sm:flex items-center gap-1.5 text-xs text-gray-400">
          <kbd className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-mono text-[10px] text-gray-500">Ctrl</kbd>
          <span>+</span>
          <kbd className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-mono text-[10px] text-gray-500">← →</kbd>
        </div>

        {isLastStep ? (
          <button
            type="button"
            onClick={() => {
              if (state.appointment) {
                const savePromises: Promise<any>[] = [];
                const compteRenduEl = document.getElementById('compte-rendu-input') as HTMLTextAreaElement | null;
                if (compteRenduEl && compteRenduEl.value.trim()) {
                  savePromises.push(fetch(`/api/appointments/${state.appointment.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ compteRendu: compteRenduEl.value.trim() }) }).catch(() => {}));
                }
                const notesEl = document.getElementById('visit-notes-input') as HTMLTextAreaElement | null;
                if (notesEl && notesEl.value.trim()) {
                  savePromises.push(fetch(`/api/appointments/${state.appointment.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notes: notesEl.value.trim() }) }).catch(() => {}));
                }
                Promise.all(savePromises).finally(() => { dispatch({ type: 'RESET' }); });
              } else { dispatch({ type: 'RESET' }); }
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
            Complete Encounter
          </button>
        ) : (
          <button
            type="button"
            onClick={() => { if (!state.patient && state.activeStep === 'patient') return; dispatch({ type: 'ADVANCE_STEP', payload: { role: user.role } }); }}
            disabled={!state.patient && state.activeStep === 'patient'}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Continue
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calculateAge(dateOfBirth: string): number {
  const today = new Date();
  const birth = new Date(dateOfBirth);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

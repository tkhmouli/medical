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
            className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
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
    <div className="mx-auto w-full max-w-7xl overflow-x-hidden px-4 py-8 md:px-6 lg:px-8">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 shadow-lg shadow-blue-200/50">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Clinical Workspace</h1>
              <p className="text-sm text-gray-500">
                {state.patient
                  ? `Step ${currentStepIndex + 1} of ${visibleSteps.length}`
                  : 'Start by selecting a patient'
                }
              </p>
            </div>
          </div>
          {state.completedSteps.size > 0 && (
            <div className="hidden sm:flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-full bg-gray-50 px-4 py-2 ring-1 ring-gray-100">
                <div className="relative h-5 w-5">
                  <svg className="h-5 w-5 -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="14" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                    <circle cx="18" cy="18" r="14" fill="none" stroke="url(#pg)" strokeWidth="3" strokeDasharray={`${(state.completedSteps.size / visibleSteps.length) * 88} 88`} strokeLinecap="round" />
                    <defs><linearGradient id="pg"><stop offset="0%" stopColor="#3b82f6" /><stop offset="100%" stopColor="#10b981" /></linearGradient></defs>
                  </svg>
                </div>
                <span className="text-xs font-semibold text-gray-700">{state.completedSteps.size}/{visibleSteps.length}</span>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Patient context card */}
      {state.patient && (
        <div className="mb-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-5 text-white shadow-xl shadow-slate-300/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm text-2xl font-bold ring-1 ring-white/20">
                {state.patient.firstName[0]}{state.patient.lastName[0]}
              </div>
              <div>
                <h2 className="text-lg font-bold">{state.patient.firstName} {state.patient.lastName}</h2>
                <div className="flex items-center gap-3 mt-1">
                  {state.patient.dateOfBirth && <span className="text-sm text-slate-300">{calculateAge(state.patient.dateOfBirth)} yrs</span>}
                  {state.patient.phoneNumber && <span className="text-sm text-slate-300">📞 {state.patient.phoneNumber}</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {state.appointment && (
                <div className="hidden sm:block text-right rounded-xl bg-white/10 backdrop-blur-sm px-4 py-2 ring-1 ring-white/10">
                  <p className="text-sm font-semibold">{state.appointment.startTime}</p>
                  <p className="text-xs text-slate-300">{state.appointment.date} · {state.appointment.visitType.replace('_', ' ')}</p>
                </div>
              )}
              <button type="button" onClick={() => dispatch({ type: 'RESET' })} className="rounded-xl bg-white/10 backdrop-blur-sm px-3 py-2 text-xs font-medium text-white/90 hover:bg-white/20 ring-1 ring-white/10 transition-all">
                Switch
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
        <div className="mb-6 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 px-5 py-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100">⚠️</div>
          <p className="text-sm text-amber-800 font-medium">Select a patient first to proceed.</p>
        </div>
      )}

      {/* Active step panel */}
      <main className="min-h-[400px]">
        {renderStepPanel()}
      </main>

      {/* Bottom navigation */}
      <footer className="mt-8 flex items-center justify-between rounded-2xl bg-gray-50/80 backdrop-blur-sm px-6 py-4 ring-1 ring-gray-100">
        <button
          type="button"
          onClick={() => {
            if (currentStepIndex === 0) { dispatch({ type: 'RESET' }); }
            else { dispatch({ type: 'NAVIGATE_TO_STEP', payload: visibleSteps[currentStepIndex - 1] }); }
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 hover:shadow-md transition-all duration-200"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
          {currentStepIndex === 0 ? 'Reset' : 'Back'}
        </button>
        <div className="hidden sm:flex items-center gap-2 text-xs text-gray-400">
          <kbd className="rounded bg-gray-200 px-1.5 py-0.5 font-mono text-[10px] text-gray-500">Ctrl</kbd>
          <span>+</span>
          <kbd className="rounded bg-gray-200 px-1.5 py-0.5 font-mono text-[10px] text-gray-500">←→</kbd>
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
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-200/50 hover:shadow-xl hover:from-emerald-600 hover:to-teal-600 transition-all duration-200"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
            Complete Encounter
          </button>
        ) : (
          <button
            type="button"
            onClick={() => { if (!state.patient && state.activeStep === 'patient') return; dispatch({ type: 'ADVANCE_STEP', payload: { role: user.role } }); }}
            disabled={!state.patient && state.activeStep === 'patient'}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-200/50 hover:shadow-xl hover:from-blue-600 hover:to-violet-600 disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none transition-all duration-200"
          >
            Continue
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
          </button>
        )}
      </footer>
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

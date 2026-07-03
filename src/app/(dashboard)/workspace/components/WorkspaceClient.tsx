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
            className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
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

  return (
    <div className="mx-auto w-full max-w-7xl overflow-x-hidden px-4 py-6 md:px-6 lg:px-8">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Patient Workspace
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Unified patient encounter workflow
        </p>
      </div>

      {/* Patient info banner — shows when patient is selected */}
      {state.patient && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold text-blue-900">
              {state.patient.firstName} {state.patient.lastName}
            </p>
            <p className="text-sm text-blue-700 mt-0.5">
              {state.patient.dateOfBirth ? `${calculateAge(state.patient.dateOfBirth)} years old` : ''} · {state.patient.phoneNumber}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {state.appointment && (
              <div className="text-right">
                <p className="text-sm font-medium text-blue-800">{state.appointment.date}</p>
                <p className="text-xs text-blue-600">{state.appointment.startTime} · {state.appointment.visitType.replace('_', ' ')}</p>
              </div>
            )}
            <button
              type="button"
              onClick={() => dispatch({ type: 'RESET' })}
              className="rounded-md border border-blue-300 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
            >
              Change Patient
            </button>
          </div>
        </div>
      )}

      {/* Step indicator */}
      <StepIndicator
        steps={visibleSteps}
        activeStep={state.activeStep}
        completedSteps={state.completedSteps}
        onStepClick={handleStepClick}
      />

      {/* No patient warning */}
      {!state.patient && state.activeStep !== 'patient' && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700 font-medium">⚠️ Please select a patient first before proceeding.</p>
        </div>
      )}

      {/* Active step panel */}
      <div className="mt-6">
        {renderStepPanel()}
      </div>

      {/* Quick navigation bar — always visible */}
      <div className="mt-4 flex items-center justify-between border-t border-gray-200 pt-4">
        <button
          type="button"
          onClick={() => {
            const currentIdx = visibleSteps.indexOf(state.activeStep);
            if (currentIdx === 0) {
              // On first step, reset back to patient list
              dispatch({ type: 'RESET' });
            } else {
              dispatch({ type: 'NAVIGATE_TO_STEP', payload: visibleSteps[currentIdx - 1] });
            }
          }}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          ← Back
        </button>
        <p className="text-xs text-gray-400">Ctrl+← / Ctrl+→ to navigate</p>
        {visibleSteps.indexOf(state.activeStep) === visibleSteps.length - 1 ? (
          <button
            type="button"
            onClick={() => {
              // Save any pending data before reset
              if (state.appointment) {
                // Gather current step data that might need saving
                const savePromises: Promise<any>[] = [];
                
                // The component auto-saves on unmount via keepalive fetch
                // But RESET happens synchronously before unmount cleanup runs
                // So we need to explicitly save here first
                const compteRenduEl = document.getElementById('compte-rendu-input') as HTMLTextAreaElement | null;
                if (compteRenduEl && compteRenduEl.value.trim()) {
                  savePromises.push(
                    fetch(`/api/appointments/${state.appointment.id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ compteRendu: compteRenduEl.value.trim() }),
                    }).catch(() => {})
                  );
                }

                const notesEl = document.getElementById('visit-notes-input') as HTMLTextAreaElement | null;
                if (notesEl && notesEl.value.trim()) {
                  savePromises.push(
                    fetch(`/api/appointments/${state.appointment.id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ notes: notesEl.value.trim() }),
                    }).catch(() => {})
                  );
                }

                Promise.all(savePromises).finally(() => {
                  dispatch({ type: 'RESET' });
                });
              } else {
                dispatch({ type: 'RESET' });
              }
            }}
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
          >
            ✓ Done — Next Patient
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              if (!state.patient && state.activeStep === 'patient') return;
              dispatch({ type: 'ADVANCE_STEP', payload: { role: user.role } });
            }}
            disabled={!state.patient && state.activeStep === 'patient'}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Next →
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

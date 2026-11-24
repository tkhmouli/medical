'use client';

import { useReducer, useEffect, useCallback, useMemo, useState } from 'react';
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

const STEP_META: Record<WorkflowStep, string> = {
  patient: 'Patient Selection',
  appointment: 'Appointment',
  vitals: 'Vital Signs',
  history: 'Visit History',
  visit_notes: 'Visit Notes',
  prescription: 'Prescription',
  lab_request: 'Lab Request',
  compte_rendu: 'Summary (CR)',
  treatment_plan: 'Treatment Plan',
  surgery: 'Surgery/Intervention',
  pdf: 'Export PDF',
};

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

      case 'treatment_plan':
        return (
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50">
                <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" /></svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Treatment Plan</h2>
                <p className="text-sm text-gray-500">Patient journey timeline and treatment history</p>
              </div>
            </div>
            {state.patient ? (
              <TreatmentPlanPanel patientId={state.patient.id} />
            ) : (
              <p className="text-sm text-gray-500">Select a patient to view their treatment plan.</p>
            )}
          </div>
        );

      case 'surgery':
        return (
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50">
                <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.04-3.49a1.5 1.5 0 01-.42-2.08l3.49-5.04a1.5 1.5 0 012.08-.42l5.04 3.49a1.5 1.5 0 01.42 2.08l-3.49 5.04a1.5 1.5 0 01-2.08.42z" /></svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Surgery / Intervention</h2>
                <p className="text-sm text-gray-500">Hospital procedures and surgical referrals</p>
              </div>
            </div>
            {state.patient ? (
              <SurgeryPanel patientId={state.patient.id} patientName={`${state.patient.firstName} ${state.patient.lastName}`} />
            ) : (
              <p className="text-sm text-gray-500">Select a patient to manage surgeries.</p>
            )}
          </div>
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
                <div className="hidden sm:flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
                  <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
                  <div>
                    <p className="text-sm font-semibold text-blue-800">{state.appointment.date}</p>
                    <p className="text-xs text-blue-600">{state.appointment.startTime} · {state.appointment.visitType.replace('_', ' ')}</p>
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={() => dispatch({ type: 'RESET' })}
                className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
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
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100">
            <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" /></svg>
          </div>
          <p className="text-sm text-amber-800 font-medium">Please select a patient first to continue.</p>
        </div>
      )}

      {/* Active step panel with sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main step content */}
        <main className="lg:col-span-3 min-h-[400px]">
          {renderStepPanel()}
        </main>

        {/* Right sidebar — Today's Stats → Mini Calendar → Recent Patients → Quick Links → Encounter Progress → Shortcuts */}
        <aside className="space-y-4">
          {/* Today's Stats */}
          <TodayStats />

          {/* Mini Calendar */}
          <MiniCalendar onPatientSelect={async (appt: any) => {
            // Load patient and their FULL visit data into workspace
            try {
              const patientRes = await fetch(`/api/patients/${appt.patientId}`);
              if (!patientRes.ok) return;
              const pData = await patientRes.json();
              if (!pData.data) return;

              // Set patient
              dispatch({ type: 'SET_PATIENT', payload: { id: pData.data.id, firstName: pData.data.firstName, lastName: pData.data.lastName, phoneNumber: pData.data.phoneNumber, dateOfBirth: pData.data.dateOfBirth } });

              // Fetch full appointment details from the specific date
              const dateStr = appt.date || new Date().toISOString().split('T')[0];
              const apptRes = await fetch(`/api/appointments/calendar?startDate=${dateStr}&endDate=${dateStr}`);
              if (apptRes.ok) {
                const apptData = await apptRes.json();
                const fullAppt = (apptData.data || []).find((a: any) => a.id === appt.id);
                if (fullAppt) {
                  // Set appointment
                  dispatch({ type: 'SET_APPOINTMENT', payload: { id: fullAppt.id, date: fullAppt.date, startTime: fullAppt.startTime, duration: fullAppt.duration, visitType: fullAppt.visitType, doctorId: fullAppt.doctorId, doctorName: user.name } });

                  // Set vitals
                  if (fullAppt.bloodPressure || fullAppt.weightKg || fullAppt.heightCm || fullAppt.temperatureC) {
                    dispatch({ type: 'SET_VITALS', payload: { bloodPressure: fullAppt.bloodPressure, temperatureC: fullAppt.temperatureC, weightKg: fullAppt.weightKg, heightCm: fullAppt.heightCm } });
                  }

                  // Set notes
                  if (fullAppt.notes) dispatch({ type: 'SET_VISIT_NOTES', payload: fullAppt.notes });

                  // Set compte rendu
                  if (fullAppt.compteRendu) dispatch({ type: 'SET_COMPTE_RENDU', payload: fullAppt.compteRendu });

                  // Lab tests are loaded by LabRequestStep from the appointment directly

                  // Load prescriptions for this appointment
                  try {
                    const rxRes = await fetch(`/api/patients/${pData.data.id}/prescriptions`);
                    if (rxRes.ok) {
                      const rxData = await rxRes.json();
                      const prescriptions = rxData.data || [];
                      const apptRx = prescriptions.find((rx: any) => rx.appointmentId === fullAppt.id);
                      if (apptRx) {
                        const fullRxRes = await fetch(`/api/prescriptions/${apptRx.id}`);
                        if (fullRxRes.ok) {
                          const fullRxData = await fullRxRes.json();
                          if (fullRxData.data?.items) {
                            dispatch({ type: 'SET_PRESCRIPTION', payload: { id: fullRxData.data.id, items: fullRxData.data.items.map((item: any) => ({ medicationId: item.medicationId || '', medicationName: item.medicationName || '', dosage: item.dosage || '', frequency: item.frequency || '', duration: item.duration || '', instructions: item.instructions || '' })) } });
                          }
                        }
                      }
                    }
                  } catch {}

                  // Mark all relevant steps as completed for past visits
                  dispatch({ type: 'ADVANCE_STEP', payload: { role: user.role } }); // patient → appointment
                  dispatch({ type: 'ADVANCE_STEP', payload: { role: user.role } }); // appointment → vitals
                  dispatch({ type: 'ADVANCE_STEP', payload: { role: user.role } }); // vitals → history
                  dispatch({ type: 'ADVANCE_STEP', payload: { role: user.role } }); // history → notes
                }
              }
            } catch {}
          }} />

          {/* Recent Patients */}
          <RecentPatients />

          {/* Quick Links */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Quick Links</h3>
            <div className="grid grid-cols-2 gap-2">
              <a href="/patients" className="flex flex-col items-center gap-1.5 rounded-lg border border-gray-100 bg-gray-50 p-3 hover:bg-blue-50 hover:border-blue-200 transition-colors">
                <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" /></svg>
                <span className="text-[10px] font-medium text-gray-600">Patients</span>
              </a>
              <a href="/appointments" className="flex flex-col items-center gap-1.5 rounded-lg border border-gray-100 bg-gray-50 p-3 hover:bg-blue-50 hover:border-blue-200 transition-colors">
                <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
                <span className="text-[10px] font-medium text-gray-600">Appts</span>
              </a>
              <a href="/prescriptions" className="flex flex-col items-center gap-1.5 rounded-lg border border-gray-100 bg-gray-50 p-3 hover:bg-blue-50 hover:border-blue-200 transition-colors">
                <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                <span className="text-[10px] font-medium text-gray-600">Rx</span>
              </a>
              <a href="/lab-requests" className="flex flex-col items-center gap-1.5 rounded-lg border border-gray-100 bg-gray-50 p-3 hover:bg-blue-50 hover:border-blue-200 transition-colors">
                <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3" /></svg>
                <span className="text-[10px] font-medium text-gray-600">Lab</span>
              </a>
              <a href="/compte-rendu" className="flex flex-col items-center gap-1.5 rounded-lg border border-gray-100 bg-gray-50 p-3 hover:bg-blue-50 hover:border-blue-200 transition-colors">
                <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" /></svg>
                <span className="text-[10px] font-medium text-gray-600">CR</span>
              </a>
              <a href="/financial" className="flex flex-col items-center gap-1.5 rounded-lg border border-gray-100 bg-gray-50 p-3 hover:bg-blue-50 hover:border-blue-200 transition-colors">
                <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                <span className="text-[10px] font-medium text-gray-600">Finance</span>
              </a>
            </div>
          </div>

          {/* Encounter Progress */}
          {state.patient && (
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Encounter Progress</h3>
              <div className="space-y-2">
                {visibleSteps.map((step, idx) => {
                  const isCompleted = state.completedSteps.has(step);
                  const isCurrent = state.activeStep === step;
                  return (
                    <div key={step} className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${isCompleted ? 'bg-green-500' : isCurrent ? 'bg-blue-500' : 'bg-gray-200'}`} />
                      <span className={`text-xs ${isCompleted ? 'text-green-700' : isCurrent ? 'text-blue-700 font-medium' : 'text-gray-400'}`}>
                        {STEP_META[step]}
                      </span>
                      {isCompleted && <span className="ml-auto text-[10px] text-green-600 font-medium">Done</span>}
                      {isCurrent && <span className="ml-auto text-[10px] text-blue-600 font-medium">Current</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Keyboard Shortcuts — removed */}
        </aside>
      </div>

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

// ─── Sidebar Widgets ──────────────────────────────────────────────────────────

interface StatsData {
  waitingCount: number;
  seenCount: number;
  today: Array<{ id: string; patientName: string; status: string; startTime: string }>;
}

/** Today's Stats card fetched from /api/dashboard/stats */
function TodayStats() {
  const [stats, setStats] = useState<StatsData | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/dashboard/stats');
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) setStats(json.data);
        }
      } catch {}
    }
    fetchStats();
    const interval = setInterval(fetchStats, 30_000);
    return () => clearInterval(interval);
  }, []);

  const waiting = stats?.waitingCount ?? 0;
  const completed = stats?.seenCount ?? 0;
  const inProgress = stats?.today?.filter((a) => a.status === 'in_progress').length ?? 0;
  const scheduled = stats?.today?.filter((a) => a.status === 'scheduled').length ?? 0;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Today&apos;s Stats</h3>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-center">
          <p className="text-lg font-bold text-amber-700">{waiting}</p>
          <p className="text-[10px] text-amber-600">Waiting</p>
        </div>
        <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-center">
          <p className="text-lg font-bold text-blue-700">{inProgress}</p>
          <p className="text-[10px] text-blue-600">In Progress</p>
        </div>
        <div className="rounded-lg bg-green-50 border border-green-100 px-3 py-2 text-center">
          <p className="text-lg font-bold text-green-700">{completed}</p>
          <p className="text-[10px] text-green-600">Completed</p>
        </div>
        <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2 text-center">
          <p className="text-lg font-bold text-gray-700">{scheduled}</p>
          <p className="text-[10px] text-gray-500">Scheduled</p>
        </div>
      </div>
    </div>
  );
}

/** Mini Calendar widget — click a date to see patients for that day */
function MiniCalendar({ onPatientSelect }: { onPatientSelect?: (appt: any) => void }) {
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [datePatients, setDatePatients] = useState<Array<{ id: string; patientId: string; patientName: string; startTime: string; status: string; visitType: string; date: string }>>([]);
  const [loading, setLoading] = useState(false);
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).getDay();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

  const handleDateClick = async (dateStr: string) => {
    setSelectedDate(dateStr);
    setLoading(true);
    try {
      const res = await fetch(`/api/appointments/calendar?startDate=${dateStr}&endDate=${dateStr}`);
      if (res.ok) {
        const json = await res.json();
        const appts = json.data || [];
        // Fetch patient names
        const patientIds = Array.from(new Set(appts.map((a: any) => a.patientId))) as string[];
        const nameMap: Record<string, string> = {};
        await Promise.all(patientIds.slice(0, 20).map(async (pid: string) => {
          try {
            const pRes = await fetch(`/api/patients/${pid}`);
            if (pRes.ok) { const pJson = await pRes.json(); if (pJson.data) nameMap[pid] = `${pJson.data.firstName} ${pJson.data.lastName}`; }
          } catch {}
        }));
        setDatePatients(appts.map((a: any) => ({ id: a.id, patientId: a.patientId, patientName: nameMap[a.patientId] || 'Unknown', startTime: a.startTime, status: a.status, visitType: a.visitType, date: dateStr })));
      }
    } catch { setDatePatients([]); }
    finally { setLoading(false); }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">
          {today.toLocaleDateString([], { month: 'long', year: 'numeric' })}
        </h3>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {['S','M','T','W','T','F','S'].map((d, i) => (
          <span key={i} className="text-[10px] font-medium text-gray-400 py-1">{d}</span>
        ))}
        {Array.from({ length: firstDay }).map((_, i) => <span key={`e${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const d = i + 1;
          const isToday = d === today.getDate();
          const dateStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
          const isSelected = selectedDate === dateStr;
          return (
            <button
              key={d}
              type="button"
              onClick={() => handleDateClick(dateStr)}
              className={`text-xs py-1 rounded-md transition-colors relative ${isSelected ? 'bg-blue-600 text-white font-bold' : isToday ? 'bg-blue-100 text-blue-700 font-bold' : 'text-gray-700 hover:bg-blue-50'}`}
            >
              {d}
              {isToday && !isSelected && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-blue-600" />}
            </button>
          );
        })}
      </div>

      {/* Date patients list */}
      {selectedDate && (
        <div className="mt-3 border-t border-gray-100 pt-3">
          <p className="text-[10px] font-medium text-gray-500 mb-2">{selectedDate}</p>
          {loading ? (
            <p className="text-[10px] text-gray-400">Loading...</p>
          ) : datePatients.length === 0 ? (
            <p className="text-[10px] text-gray-400">No appointments</p>
          ) : (
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {datePatients.map((appt) => (
                <button
                  key={appt.id}
                  type="button"
                  onClick={() => onPatientSelect?.(appt)}
                  className="w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-blue-50 transition-colors"
                >
                  <div className={`w-1 h-6 rounded-full ${appt.status === 'completed' ? 'bg-green-400' : appt.status === 'waiting' ? 'bg-amber-400' : appt.status === 'in_progress' ? 'bg-blue-400' : 'bg-gray-200'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-gray-900 truncate">{appt.patientName}</p>
                    <p className="text-[9px] text-gray-500">{appt.startTime} · {appt.visitType?.replace('_', ' ')}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Recent Patients — last 3 patients seen today */
function RecentPatients() {
  const [recentPatients, setRecentPatients] = useState<Array<{ id: string; patientName: string; startTime: string }>>([]);

  useEffect(() => {
    async function fetchRecent() {
      try {
        const res = await fetch('/api/dashboard/stats');
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data?.today) {
            const completed = json.data.today
              .filter((a: any) => a.status === 'completed' || a.status === 'in_progress')
              .slice(-3)
              .reverse();
            setRecentPatients(completed);
          }
        }
      } catch {}
    }
    fetchRecent();
  }, []);

  if (recentPatients.length === 0) return null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Recent Patients</h3>
      <div className="space-y-2">
        {recentPatients.map((p) => (
          <div key={p.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-gray-50">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-xs font-bold">
              {p.patientName?.charAt(0) || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-900 truncate">{p.patientName}</p>
              <p className="text-[10px] text-gray-500">{p.startTime}</p>
            </div>
          </div>
        ))}
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

/** Treatment Plan — visual timeline of patient visits */
function TreatmentPlanPanel({ patientId }: { patientId: string }) {
  const [visits, setVisits] = useState<Array<{ date: string; visitType: string; doctorName: string; notes?: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchVisits() {
      try {
        const res = await fetch(`/api/patients/${patientId}/visits`);
        if (res.ok) {
          const json = await res.json();
          setVisits(json.data?.visits || []);
        }
      } catch {}
      setLoading(false);
    }
    fetchVisits();
  }, [patientId]);

  if (loading) return <p className="text-sm text-gray-500">Loading treatment history...</p>;
  if (visits.length === 0) return <p className="text-sm text-gray-400">No visit history. Treatment plan will appear after the first visit.</p>;

  return (
    <div className="space-y-4">
      {/* Timeline */}
      <div className="relative pl-6">
        <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-400 via-purple-400 to-green-400" />
        {visits.slice(0, 10).map((visit, idx) => {
          const daysBetween = idx > 0 ? Math.round((new Date(visits[idx - 1].date).getTime() - new Date(visit.date).getTime()) / (1000 * 60 * 60 * 24)) : 0;
          return (
            <div key={idx} className="relative mb-4 pl-6">
              <div className={`absolute left-0 top-1 h-4 w-4 rounded-full border-2 border-white ${
                visit.visitType === 'new_visit' ? 'bg-blue-500' :
                visit.visitType === 'follow_up' ? 'bg-green-500' :
                visit.visitType === 'control_visit' ? 'bg-purple-500' :
                'bg-gray-400'
              }`} />
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-800">{visit.date}</span>
                  <span className={`text-[10px] font-medium rounded-full px-2 py-0.5 ${
                    visit.visitType === 'new_visit' ? 'bg-blue-100 text-blue-700' :
                    visit.visitType === 'follow_up' ? 'bg-green-100 text-green-700' :
                    visit.visitType === 'control_visit' ? 'bg-purple-100 text-purple-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>{visit.visitType.replace('_', ' ')}</span>
                </div>
                <p className="text-xs text-gray-600 mt-1">Dr. {visit.doctorName}</p>
                {visit.notes && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{visit.notes}</p>}
                {daysBetween > 0 && <p className="text-[10px] text-gray-400 mt-1">{daysBetween} days since previous visit</p>}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-gray-400 text-center">{visits.length} total visits on record</p>
    </div>
  );
}

/** Surgery Panel — track surgical referrals */
function SurgeryPanel({ patientId, patientName }: { patientId: string; patientName: string }) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-100 bg-gray-50 p-6 text-center">
        <svg className="w-12 h-12 text-gray-300 mx-auto" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.04-3.49a1.5 1.5 0 01-.42-2.08l3.49-5.04a1.5 1.5 0 012.08-.42l5.04 3.49a1.5 1.5 0 01.42 2.08l-3.49 5.04a1.5 1.5 0 01-2.08.42z" /></svg>
        <h3 className="mt-3 text-sm font-medium text-gray-800">No Surgeries Recorded</h3>
        <p className="mt-1 text-xs text-gray-500">When a surgery or hospital intervention is planned, it will appear here with referral documents.</p>
        <button
          type="button"
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          Schedule Surgery
        </button>
      </div>
      <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
        <h4 className="text-xs font-semibold text-blue-800 mb-2">How it works</h4>
        <ul className="space-y-1.5 text-xs text-blue-700">
          <li className="flex items-start gap-2"><span className="text-blue-400">1.</span> Doctor creates a surgical referral linked to the patient</li>
          <li className="flex items-start gap-2"><span className="text-blue-400">2.</span> Referral document is generated for the hospital</li>
          <li className="flex items-start gap-2"><span className="text-blue-400">3.</span> Surgery date and outcome are tracked here</li>
          <li className="flex items-start gap-2"><span className="text-blue-400">4.</span> Post-op follow-up visits are linked back</li>
        </ul>
      </div>
    </div>
  );
}

'use client';

import { type WorkflowStep, getStepStatus } from './visit-context';

export interface StepIndicatorProps {
  steps: WorkflowStep[];
  activeStep: WorkflowStep;
  completedSteps: Set<WorkflowStep>;
  onStepClick: (step: WorkflowStep) => void;
}

const STEP_LABELS: Record<WorkflowStep, string> = {
  patient: 'Patient',
  appointment: 'Appt',
  vitals: 'Vitals',
  history: 'History',
  visit_notes: 'Notes',
  prescription: 'Rx',
  lab_request: 'Lab',
  compte_rendu: 'CR',
  pdf: 'PDF',
};

const STEP_ICONS: Record<WorkflowStep, string> = {
  patient: '👤',
  appointment: '📅',
  vitals: '🫀',
  history: '📖',
  visit_notes: '📝',
  prescription: '💊',
  lab_request: '🧪',
  compte_rendu: '📋',
  pdf: '📄',
};

export default function StepIndicator({
  steps,
  activeStep,
  completedSteps,
  onStepClick,
}: StepIndicatorProps) {
  return (
    <nav aria-label="Workflow progress" className="w-full">
      <div className="rounded-xl border border-gray-100 bg-white/80 backdrop-blur-sm shadow-sm px-3 py-3">
        <div className="flex items-center">
          {steps.map((step, index) => {
            const status = getStepStatus(step, activeStep, completedSteps);
            const isLast = index === steps.length - 1;

            return (
              <div key={step} className="flex items-center flex-1 last:flex-none">
                {/* Step button */}
                <button
                  type="button"
                  onClick={() => onStepClick(step)}
                  aria-current={status === 'current' ? 'step' : undefined}
                  aria-label={`Step ${index + 1}: ${STEP_LABELS[step]}`}
                  className={`group flex flex-col items-center gap-1.5 px-2 py-1.5 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg shrink-0 transition-all duration-200 ${
                    status === 'current'
                      ? 'bg-blue-50 scale-105'
                      : status === 'completed'
                      ? 'hover:bg-green-50'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <span
                    className={`flex items-center justify-center w-9 h-9 rounded-full text-sm font-medium transition-all duration-200 ${
                      status === 'completed'
                        ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-sm shadow-emerald-200'
                        : status === 'current'
                        ? 'bg-gradient-to-br from-blue-400 to-blue-600 text-white shadow-md shadow-blue-200 ring-4 ring-blue-100'
                        : 'bg-gray-100 text-gray-400 group-hover:bg-gray-200 group-hover:text-gray-600'
                    }`}
                  >
                    {status === 'completed' ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    ) : (
                      <span className="text-sm">{STEP_ICONS[step]}</span>
                    )}
                  </span>
                  <span
                    className={`text-[10px] lg:text-[11px] text-center leading-tight hidden sm:block font-medium tracking-tight ${
                      status === 'completed'
                        ? 'text-emerald-700'
                        : status === 'current'
                        ? 'text-blue-700 font-semibold'
                        : 'text-gray-400 group-hover:text-gray-600'
                    }`}
                  >
                    {STEP_LABELS[step]}
                  </span>
                </button>

                {/* Connector line */}
                {!isLast && (
                  <div className="flex-1 mx-1 h-[2px] relative">
                    <div className="absolute inset-0 rounded-full bg-gray-100" />
                    <div
                      className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${
                        completedSteps.has(step)
                          ? 'w-full bg-gradient-to-r from-emerald-400 to-emerald-500'
                          : 'w-0'
                      }`}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

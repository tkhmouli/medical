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
  visit_notes: 'Notes',
  prescription: 'Rx',
  compte_rendu: 'CR',
  pdf: 'PDF',
  history: 'History',
};

export default function StepIndicator({
  steps,
  activeStep,
  completedSteps,
  onStepClick,
}: StepIndicatorProps) {
  return (
    <nav aria-label="Workflow progress" className="w-full py-4">
      <div className="flex items-center">
        {steps.map((step, index) => {
          const status = getStepStatus(step, activeStep, completedSteps);
          const stepNumber = index + 1;
          const isLast = index === steps.length - 1;

          return (
            <div key={step} className="flex items-center flex-1 last:flex-none">
              {/* Step button */}
              <button
                type="button"
                onClick={() => onStepClick(step)}
                aria-current={status === 'current' ? 'step' : undefined}
                aria-label={`Step ${stepNumber}: ${STEP_LABELS[step]}`}
                className="flex flex-col items-center gap-1 p-1 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-md shrink-0"
              >
                <span
                  className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-medium transition-all ${
                    status === 'completed'
                      ? 'bg-green-600 text-white'
                      : status === 'current'
                      ? 'bg-blue-100 text-blue-700 border-2 border-blue-600 font-bold'
                      : 'bg-gray-100 text-gray-500 border-2 border-gray-300'
                  }`}
                >
                  {status === 'completed' ? '✓' : stepNumber}
                </span>
                <span
                  className={`text-[10px] lg:text-xs text-center leading-tight hidden sm:block ${
                    status === 'completed'
                      ? 'text-green-700 font-medium'
                      : status === 'current'
                      ? 'text-blue-700 font-bold'
                      : 'text-gray-400'
                  }`}
                >
                  {STEP_LABELS[step]}
                </span>
              </button>

              {/* Connector line AFTER step (not on last) */}
              {!isLast && (
                <div
                  className={`h-0.5 flex-1 mx-1 ${
                    completedSteps.has(step) ? 'bg-green-500' : 'bg-gray-200'
                  }`}
                  aria-hidden="true"
                />
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}

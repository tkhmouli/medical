'use client';

import { type WorkflowStep, getStepStatus } from './visit-context';

export interface StepIndicatorProps {
  steps: WorkflowStep[];
  activeStep: WorkflowStep;
  completedSteps: Set<WorkflowStep>;
  onStepClick: (step: WorkflowStep) => void;
}

const STEP_META: Record<WorkflowStep, { label: string; icon: string }> = {
  patient: { label: 'Patient', icon: '👤' },
  appointment: { label: 'Appointment', icon: '📅' },
  vitals: { label: 'Vitals', icon: '🫀' },
  history: { label: 'History', icon: '📖' },
  visit_notes: { label: 'Notes', icon: '📝' },
  prescription: { label: 'Prescription', icon: '💊' },
  lab_request: { label: 'Lab', icon: '🧪' },
  compte_rendu: { label: 'Summary', icon: '📋' },
  pdf: { label: 'Export', icon: '📄' },
};

export default function StepIndicator({
  steps,
  activeStep,
  completedSteps,
  onStepClick,
}: StepIndicatorProps) {
  return (
    <nav aria-label="Workflow progress" className="w-full">
      <div className="rounded-xl border border-gray-200 bg-white p-2 shadow-sm">
        <div className="flex items-center gap-1 overflow-x-auto">
          {steps.map((step, index) => {
            const status = getStepStatus(step, activeStep, completedSteps);
            const meta = STEP_META[step];
            const isCurrent = status === 'current';
            const isCompleted = status === 'completed';

            return (
              <button
                key={step}
                type="button"
                onClick={() => onStepClick(step)}
                aria-current={isCurrent ? 'step' : undefined}
                aria-label={`Step ${index + 1}: ${meta.label}`}
                className={`
                  flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors shrink-0
                  ${isCurrent
                    ? 'bg-blue-600 text-white shadow-sm'
                    : isCompleted
                    ? 'bg-green-50 text-green-700 hover:bg-green-100'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                  }
                `}
              >
                {isCompleted ? (
                  <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                ) : (
                  <span className="text-sm">{meta.icon}</span>
                )}
                <span className="hidden sm:inline">{meta.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

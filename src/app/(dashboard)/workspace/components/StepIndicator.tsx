'use client';

import { type WorkflowStep, getStepStatus } from './visit-context';

export interface StepIndicatorProps {
  steps: WorkflowStep[];
  activeStep: WorkflowStep;
  completedSteps: Set<WorkflowStep>;
  onStepClick: (step: WorkflowStep) => void;
}

const STEP_META: Record<WorkflowStep, { label: string; icon: string; color: string }> = {
  patient: { label: 'Patient', icon: '👤', color: 'blue' },
  appointment: { label: 'Appointment', icon: '📅', color: 'violet' },
  vitals: { label: 'Vitals', icon: '🫀', color: 'rose' },
  history: { label: 'History', icon: '📖', color: 'indigo' },
  visit_notes: { label: 'Notes', icon: '📝', color: 'sky' },
  prescription: { label: 'Prescription', icon: '💊', color: 'purple' },
  lab_request: { label: 'Lab', icon: '🧪', color: 'cyan' },
  compte_rendu: { label: 'Summary', icon: '📋', color: 'amber' },
  pdf: { label: 'Export', icon: '📄', color: 'emerald' },
};

export default function StepIndicator({
  steps,
  activeStep,
  completedSteps,
  onStepClick,
}: StepIndicatorProps) {
  const activeIndex = steps.indexOf(activeStep);
  const progressPercent = steps.length > 1
    ? (completedSteps.size / (steps.length - 1)) * 100
    : 0;

  return (
    <nav aria-label="Workflow progress" className="w-full">
      {/* Progress bar */}
      <div className="mb-4 overflow-hidden rounded-full bg-gray-100 h-1.5">
        <div
          className="h-full rounded-full bg-gradient-to-r from-blue-500 via-violet-500 to-emerald-500 transition-all duration-700 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Steps */}
      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
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
                group relative flex items-center gap-2 rounded-xl px-3 py-2.5 text-left transition-all duration-200 shrink-0
                ${isCurrent
                  ? 'bg-white shadow-lg shadow-gray-200/50 ring-1 ring-gray-200 scale-[1.02]'
                  : isCompleted
                  ? 'bg-emerald-50/50 hover:bg-emerald-50'
                  : 'hover:bg-gray-50'
                }
              `}
            >
              {/* Icon container */}
              <span
                className={`
                  flex h-8 w-8 items-center justify-center rounded-lg text-sm transition-all duration-200
                  ${isCurrent
                    ? 'bg-blue-100 shadow-sm'
                    : isCompleted
                    ? 'bg-emerald-100'
                    : 'bg-gray-100 group-hover:bg-gray-200'
                  }
                `}
              >
                {isCompleted ? (
                  <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                ) : (
                  meta.icon
                )}
              </span>

              {/* Label */}
              <span
                className={`
                  text-xs font-medium hidden sm:block transition-colors duration-200
                  ${isCurrent
                    ? 'text-gray-900'
                    : isCompleted
                    ? 'text-emerald-700'
                    : 'text-gray-500 group-hover:text-gray-700'
                  }
                `}
              >
                {meta.label}
              </span>

              {/* Active indicator dot */}
              {isCurrent && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-1 w-6 rounded-full bg-blue-500" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

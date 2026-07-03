import type { Role } from '@/lib/auth/permissions';

// ─── Types ────────────────────────────────────────────────────────────────────

export type WorkflowStep =
  | 'patient'
  | 'appointment'
  | 'vitals'
  | 'visit_notes'
  | 'prescription'
  | 'compte_rendu'
  | 'pdf'
  | 'history';

export type StepStatus = 'upcoming' | 'current' | 'completed';

export interface PatientInfo {
  id: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  dateOfBirth: string;
}

export interface AppointmentInfo {
  id: string;
  date: string;
  startTime: string;
  duration: number;
  visitType: 'new_visit' | 'control_visit' | 'follow_up';
  doctorId: string;
  doctorName: string;
}

export interface PrescriptionItemInfo {
  medicationId: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

export interface VisitContextState {
  activeStep: WorkflowStep;
  completedSteps: Set<WorkflowStep>;
  patient: PatientInfo | null;
  appointment: AppointmentInfo | null;
  appointmentSkipped: boolean;
  vitals: { bloodPressure?: string; temperatureC?: string; weightKg?: number; heightCm?: number } | null;
  vitalsSkipped: boolean;
  visitNotes: string | null;
  prescriptionId: string | null;
  prescriptionSkipped: boolean;
  prescriptionItems: PrescriptionItemInfo[];
  compteRendu: string | null;
  compteRenduSkipped: boolean;
  pdfGenerated: boolean;
  pdfDownloaded: boolean;
}

export type VisitContextAction =
  | { type: 'SET_PATIENT'; payload: PatientInfo }
  | { type: 'SET_APPOINTMENT'; payload: AppointmentInfo }
  | { type: 'SKIP_APPOINTMENT' }
  | { type: 'SET_VITALS'; payload: { bloodPressure?: string; temperatureC?: string; weightKg?: number; heightCm?: number } }
  | { type: 'SKIP_VITALS' }
  | { type: 'SET_VISIT_NOTES'; payload: string }
  | { type: 'SET_PRESCRIPTION'; payload: { id: string; items: PrescriptionItemInfo[] } }
  | { type: 'SKIP_PRESCRIPTION' }
  | { type: 'SET_COMPTE_RENDU'; payload: string }
  | { type: 'SKIP_COMPTE_RENDU' }
  | { type: 'SET_PDF_GENERATED' }
  | { type: 'SET_PDF_DOWNLOADED' }
  | { type: 'NAVIGATE_TO_STEP'; payload: WorkflowStep }
  | { type: 'ADVANCE_STEP'; payload: { role: Role } }
  | { type: 'RESET' };

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_STEPS: WorkflowStep[] = [
  'patient',
  'appointment',
  'vitals',
  'history',
  'visit_notes',
  'prescription',
  'compte_rendu',
];

export const initialVisitContext: VisitContextState = {
  activeStep: 'patient',
  completedSteps: new Set<WorkflowStep>(),
  patient: null,
  appointment: null,
  appointmentSkipped: false,
  vitals: null,
  vitalsSkipped: false,
  visitNotes: null,
  prescriptionId: null,
  prescriptionSkipped: false,
  prescriptionItems: [],
  compteRendu: null,
  compteRenduSkipped: false,
  pdfGenerated: false,
  pdfDownloaded: false,
};

// ─── Step Machine Helpers ─────────────────────────────────────────────────────

/**
 * Returns the visible workflow steps for a given role.
 * Medical_Assistants: patient, appointment, vitals, history (no notes/prescription/pdf)
 * Doctor/Admin: all steps
 */
export function getVisibleSteps(role: Role): WorkflowStep[] {
  if (role === 'Medical_Assistant') {
    return ['patient', 'appointment', 'vitals', 'history'];
  }
  return ALL_STEPS;
}

/**
 * Returns the next step in the workflow for a given role,
 * or null if the current step is the last visible step.
 */
export function getNextStep(
  currentStep: WorkflowStep,
  role: Role
): WorkflowStep | null {
  const visible = getVisibleSteps(role);
  const currentIndex = visible.indexOf(currentStep);
  if (currentIndex === -1 || currentIndex >= visible.length - 1) {
    return null;
  }
  return visible[currentIndex + 1];
}

/**
 * Computes the status of a step based on the active step and completed steps.
 */
export function getStepStatus(
  step: WorkflowStep,
  activeStep: WorkflowStep,
  completedSteps: Set<WorkflowStep>
): StepStatus {
  if (step === activeStep) return 'current';
  if (completedSteps.has(step)) return 'completed';
  return 'upcoming';
}

// ─── Reducer ──────────────────────────────────────────────────────────────────

/**
 * Reducer for the Visit_Context state.
 * Handles all workflow actions including data setting, step navigation, and reset.
 */
export function visitContextReducer(
  state: VisitContextState,
  action: VisitContextAction
): VisitContextState {
  switch (action.type) {
    case 'SET_PATIENT': {
      return {
        ...state,
        patient: action.payload,
      };
    }

    case 'SET_APPOINTMENT': {
      return {
        ...state,
        appointment: action.payload,
        appointmentSkipped: false,
      };
    }

    case 'SKIP_APPOINTMENT': {
      return {
        ...state,
        appointment: null,
        appointmentSkipped: true,
      };
    }

    case 'SET_VITALS': {
      return {
        ...state,
        vitals: action.payload,
        vitalsSkipped: false,
      };
    }

    case 'SKIP_VITALS': {
      return {
        ...state,
        vitals: null,
        vitalsSkipped: true,
      };
    }

    case 'SET_VISIT_NOTES': {
      return {
        ...state,
        visitNotes: action.payload,
      };
    }

    case 'SET_PRESCRIPTION': {
      return {
        ...state,
        prescriptionId: action.payload.id,
        prescriptionItems: action.payload.items,
        prescriptionSkipped: false,
      };
    }

    case 'SKIP_PRESCRIPTION': {
      return {
        ...state,
        prescriptionId: null,
        prescriptionItems: [],
        prescriptionSkipped: true,
      };
    }

    case 'SET_COMPTE_RENDU': {
      return {
        ...state,
        compteRendu: action.payload,
        compteRenduSkipped: false,
      };
    }

    case 'SKIP_COMPTE_RENDU': {
      return {
        ...state,
        compteRendu: null,
        compteRenduSkipped: true,
      };
    }

    case 'SET_PDF_GENERATED': {
      return {
        ...state,
        pdfGenerated: true,
      };
    }

    case 'SET_PDF_DOWNLOADED': {
      return {
        ...state,
        pdfDownloaded: true,
      };
    }

    case 'NAVIGATE_TO_STEP': {
      const targetStep = action.payload;
      // Mark current step as completed when navigating away
      const updatedCompleted = new Set(state.completedSteps);
      updatedCompleted.add(state.activeStep);
      return {
        ...state,
        activeStep: targetStep,
        completedSteps: updatedCompleted,
      };
    }

    case 'ADVANCE_STEP': {
      const nextStep = getNextStep(state.activeStep, action.payload.role);
      if (nextStep === null) {
        // Already at the last step — mark current as completed
        const updatedCompleted = new Set(state.completedSteps);
        updatedCompleted.add(state.activeStep);
        return {
          ...state,
          completedSteps: updatedCompleted,
        };
      }
      const updatedCompleted = new Set(state.completedSteps);
      updatedCompleted.add(state.activeStep);
      return {
        ...state,
        activeStep: nextStep,
        completedSteps: updatedCompleted,
      };
    }

    case 'RESET': {
      return {
        ...initialVisitContext,
        // Create a fresh Set to avoid sharing references
        completedSteps: new Set<WorkflowStep>(),
      };
    }

    default:
      return state;
  }
}

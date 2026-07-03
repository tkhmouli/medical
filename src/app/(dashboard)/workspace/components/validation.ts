import { z } from 'zod';

// ─── Patient Registration Schema ──────────────────────────────────────────────

export const patientRegistrationSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  dateOfBirth: z
    .string()
    .min(1, 'Date of birth is required')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be in YYYY-MM-DD format'),
  phoneNumber: z.string().min(1, 'Phone number is required'),
  gender: z.enum(['male', 'female', 'other'], {
    errorMap: () => ({ message: 'Gender must be male, female, or other' }),
  }),
  secondaryPhone: z.string().optional(),
  cinNumber: z.string().optional(),
  email: z.string().email('Invalid email format').optional().or(z.literal('')),
  address: z.string().optional(),
  notes: z.string().optional(),
});

export type PatientRegistrationInput = z.infer<typeof patientRegistrationSchema>;

/**
 * Validates patient registration data and returns field-level errors.
 * Returns null if validation passes, or a record of field names to error messages.
 */
export function validatePatientRegistration(
  data: unknown
): Record<string, string> | null {
  const result = patientRegistrationSchema.safeParse(data);
  if (result.success) {
    return null;
  }

  const fieldErrors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const field = issue.path.join('.');
    if (!fieldErrors[field]) {
      fieldErrors[field] = issue.message;
    }
  }
  return fieldErrors;
}

// ─── Appointment Booking Schema ───────────────────────────────────────────────

export const VISIT_TYPES = ['new_visit', 'control_visit', 'follow_up'] as const;
export type VisitType = (typeof VISIT_TYPES)[number];

export const appointmentSchema = z.object({
  date: z
    .string()
    .min(1, 'Date is required')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  startTime: z
    .string()
    .min(1, 'Start time is required')
    .regex(/^\d{2}:\d{2}$/, 'Start time must be in HH:MM format'),
  duration: z
    .number({ invalid_type_error: 'Duration must be a number' })
    .int('Duration must be a whole number')
    .min(5, 'Duration must be at least 5 minutes')
    .max(480, 'Duration must be at most 480 minutes'),
  visitType: z.enum(VISIT_TYPES, {
    errorMap: () => ({ message: 'Visit type must be one of: new_visit, control_visit, follow_up' }),
  }),
  doctorId: z.string().min(1, 'Doctor is required'),
});

export type AppointmentInput = z.infer<typeof appointmentSchema>;

/**
 * Validates appointment booking data and returns field-level errors.
 * Returns null if validation passes, or a record of field names to error messages.
 */
export function validateAppointment(
  data: unknown
): Record<string, string> | null {
  const result = appointmentSchema.safeParse(data);
  if (result.success) {
    return null;
  }

  const fieldErrors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const field = issue.path.join('.');
    if (!fieldErrors[field]) {
      fieldErrors[field] = issue.message;
    }
  }
  return fieldErrors;
}

// ─── Appointment Time Overlap Detection ───────────────────────────────────────

export interface AppointmentTimeSlot {
  date: string;
  startTime: string;
  duration: number;
  doctorId: string;
}

/**
 * Parses a time string in HH:MM format to total minutes since midnight.
 */
export function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Detects whether a new appointment's time range overlaps with any existing
 * appointment for the same doctor on the same date.
 *
 * Two time ranges [startA, startA + durationA) and [startB, startB + durationB)
 * overlap if and only if startA < endB AND startB < endA.
 *
 * Only appointments for the same doctor on the same date are considered.
 */
export function detectTimeOverlap(
  newAppt: AppointmentTimeSlot,
  existingAppts: AppointmentTimeSlot[]
): boolean {
  const newStartMinutes = parseTimeToMinutes(newAppt.startTime);
  const newEndMinutes = newStartMinutes + newAppt.duration;

  for (const existing of existingAppts) {
    // Only check appointments for the same doctor on the same date
    if (existing.doctorId !== newAppt.doctorId || existing.date !== newAppt.date) {
      continue;
    }

    const existingStartMinutes = parseTimeToMinutes(existing.startTime);
    const existingEndMinutes = existingStartMinutes + existing.duration;

    // Overlap condition: startA < endB AND startB < endA
    if (newStartMinutes < existingEndMinutes && existingStartMinutes < newEndMinutes) {
      return true;
    }
  }

  return false;
}

// ─── Prescription Validation Schema ───────────────────────────────────────────

export const prescriptionItemSchema = z.object({
  medicationId: z.string().min(1, 'Medication is required'),
  dosage: z
    .string()
    .min(1, 'Dosage is required')
    .max(100, 'Dosage must be 100 characters or less'),
  frequency: z
    .string()
    .min(1, 'Frequency is required')
    .max(100, 'Frequency must be 100 characters or less'),
  duration: z
    .string()
    .min(1, 'Duration is required')
    .max(100, 'Duration must be 100 characters or less'),
  instructions: z.string().optional(),
});

export const prescriptionSchema = z.object({
  doctorId: z.string().min(1, 'Doctor is required'),
  items: z
    .array(prescriptionItemSchema)
    .min(1, 'At least one medication item is required')
    .max(20, 'Maximum 20 medication items allowed'),
});

export type PrescriptionItemInput = z.infer<typeof prescriptionItemSchema>;
export type PrescriptionInput = z.infer<typeof prescriptionSchema>;

/**
 * Validates prescription data and returns field-level errors.
 * Returns null if validation passes, or a record of field names to error messages.
 */
export function validatePrescription(
  data: unknown
): Record<string, string> | null {
  const result = prescriptionSchema.safeParse(data);
  if (result.success) {
    return null;
  }

  const fieldErrors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const field = issue.path.join('.');
    if (!fieldErrors[field]) {
      fieldErrors[field] = issue.message;
    }
  }
  return fieldErrors;
}

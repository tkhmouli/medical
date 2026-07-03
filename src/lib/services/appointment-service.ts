import { z } from 'zod';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { appointments } from '@/lib/db/schema';
import { NotFoundError, ValidationError } from '@/lib/errors';

// ─── Constants ────────────────────────────────────────────────────────────────

export const VISIT_TYPES = ['new_visit', 'control_visit', 'follow_up'] as const;
export type VisitType = (typeof VISIT_TYPES)[number];

// ─── Validation Schemas ───────────────────────────────────────────────────────

export const createAppointmentSchema = z.object({
  patientId: z.string().min(1, 'Patient ID is required'),
  doctorId: z.string().min(1, 'Doctor ID is required'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in ISO format (YYYY-MM-DD)'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Start time must be in HH:MM format'),
  duration: z.number().int().positive('Duration must be a positive number'),
  visitType: z.enum(VISIT_TYPES, {
    errorMap: () => ({
      message: 'Visit type must be one of: new_visit, control_visit, follow_up',
    }),
  }),
  notes: z.string().optional(),
});

export const updateAppointmentSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in ISO format (YYYY-MM-DD)').optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Start time must be in HH:MM format').optional(),
  duration: z.number().int().positive('Duration must be a positive number').optional(),
  visitType: z.enum(VISIT_TYPES, {
    errorMap: () => ({
      message: 'Visit type must be one of: new_visit, control_visit, follow_up',
    }),
  }).optional(),
  notes: z.string().optional(),
  compteRendu: z.string().optional(),
});

// ─── Types ────────────────────────────────────────────────────────────────────

export type CreateAppointmentInput = z.input<typeof createAppointmentSchema>;
export type UpdateAppointmentInput = z.input<typeof updateAppointmentSchema>;

export interface AppointmentResult {
  id: string;
  tenantId: string;
  patientId: string;
  doctorId: string;
  date: string;
  startTime: string;
  duration: number;
  visitType: VisitType;
  isCancelled: boolean;
  notes: string | null;
  bloodPressure: string | null;
  weightKg: number | null;
  heightCm: number | null;
  temperatureC: string | null;
  compteRendu: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PatientAppointmentResult {
  id: string;
  date: string;
  startTime: string;
  visitType: VisitType;
}

export interface ConflictCheckResult {
  hasConflict: boolean;
  conflictingAppointment?: AppointmentResult;
}

export interface CreateAppointmentResult {
  appointment: AppointmentResult;
  conflictWarning?: ConflictCheckResult;
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Converts a time string (HH:MM) to minutes since midnight.
 */
export function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Determines whether two time ranges overlap.
 * Two ranges overlap if startA < endB AND startB < endA.
 */
export function timeRangesOverlap(
  startA: string,
  durationA: number,
  startB: string,
  durationB: number
): boolean {
  const startAMinutes = parseTimeToMinutes(startA);
  const endAMinutes = startAMinutes + durationA;
  const startBMinutes = parseTimeToMinutes(startB);
  const endBMinutes = startBMinutes + durationB;

  return startAMinutes < endBMinutes && startBMinutes < endAMinutes;
}

// ─── Service Functions ────────────────────────────────────────────────────────

/**
 * Checks if a proposed appointment conflicts with existing appointments
 * for the same doctor on the same date.
 * Only non-cancelled appointments are considered.
 */
export async function checkConflict(
  tenantId: string,
  doctorId: string,
  date: string,
  startTime: string,
  duration: number,
  excludeAppointmentId?: string
): Promise<ConflictCheckResult> {
  const existingAppointments = await db
    .select({
      id: appointments.id,
      tenantId: appointments.tenantId,
      patientId: appointments.patientId,
      doctorId: appointments.doctorId,
      date: appointments.date,
      startTime: appointments.startTime,
      duration: appointments.duration,
      visitType: appointments.visitType,
      isCancelled: appointments.isCancelled,
      notes: appointments.notes,
      createdAt: appointments.createdAt,
      updatedAt: appointments.updatedAt,
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.tenantId, tenantId),
        eq(appointments.doctorId, doctorId),
        eq(appointments.date, date),
        eq(appointments.isCancelled, false)
      )
    );

  for (const existing of existingAppointments) {
    // Skip the appointment being updated
    if (excludeAppointmentId && existing.id === excludeAppointmentId) {
      continue;
    }

    if (timeRangesOverlap(startTime, duration, existing.startTime, existing.duration)) {
      return {
        hasConflict: true,
        conflictingAppointment: existing as AppointmentResult,
      };
    }
  }

  return { hasConflict: false };
}

/**
 * Creates a new appointment within the specified tenant.
 * Validates input using Zod schema before inserting.
 * Checks for conflicts but does NOT block creation (warns only).
 */
export async function create(
  tenantId: string,
  data: CreateAppointmentInput
): Promise<CreateAppointmentResult> {
  const parsed = createAppointmentSchema.safeParse(data);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path.join('.') || '_form';
      fieldErrors[field] = issue.message;
    }
    throw new ValidationError('Invalid appointment data', fieldErrors);
  }

  const validData = parsed.data;

  // Check for conflicts (warn but don't block)
  const conflictResult = await checkConflict(
    tenantId,
    validData.doctorId,
    validData.date,
    validData.startTime,
    validData.duration
  );

  const [created] = await db
    .insert(appointments)
    .values({
      tenantId,
      patientId: validData.patientId,
      doctorId: validData.doctorId,
      date: validData.date,
      startTime: validData.startTime,
      duration: validData.duration,
      visitType: validData.visitType,
      notes: validData.notes || null,
    })
    .returning({
      id: appointments.id,
      tenantId: appointments.tenantId,
      patientId: appointments.patientId,
      doctorId: appointments.doctorId,
      date: appointments.date,
      startTime: appointments.startTime,
      duration: appointments.duration,
      visitType: appointments.visitType,
      isCancelled: appointments.isCancelled,
      notes: appointments.notes,
      createdAt: appointments.createdAt,
      updatedAt: appointments.updatedAt,
    });

  const result: CreateAppointmentResult = {
    appointment: created as AppointmentResult,
  };

  if (conflictResult.hasConflict) {
    result.conflictWarning = conflictResult;
  }

  return result;
}

/**
 * Updates an existing appointment within the specified tenant.
 * If time-related fields change, checks for new conflicts.
 * Throws NotFoundError if the appointment doesn't exist.
 */
export async function update(
  tenantId: string,
  appointmentId: string,
  data: UpdateAppointmentInput
): Promise<{ appointment: AppointmentResult; conflictWarning?: ConflictCheckResult }> {
  const parsed = updateAppointmentSchema.safeParse(data);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path.join('.') || '_form';
      fieldErrors[field] = issue.message;
    }
    throw new ValidationError('Invalid appointment data', fieldErrors);
  }

  const validData = parsed.data;

  // Fetch existing appointment to check if it exists and get current values
  const [existing] = await db
    .select({
      id: appointments.id,
      tenantId: appointments.tenantId,
      patientId: appointments.patientId,
      doctorId: appointments.doctorId,
      date: appointments.date,
      startTime: appointments.startTime,
      duration: appointments.duration,
      visitType: appointments.visitType,
      isCancelled: appointments.isCancelled,
      notes: appointments.notes,
      createdAt: appointments.createdAt,
      updatedAt: appointments.updatedAt,
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.id, appointmentId),
        eq(appointments.tenantId, tenantId)
      )
    );

  if (!existing) {
    throw new NotFoundError('Appointment');
  }

  // Check for conflicts if time-related fields changed
  let conflictResult: ConflictCheckResult | undefined;
  const newDate = validData.date || existing.date;
  const newStartTime = validData.startTime || existing.startTime;
  const newDuration = validData.duration || existing.duration;

  const timeChanged =
    validData.date !== undefined ||
    validData.startTime !== undefined ||
    validData.duration !== undefined;

  if (timeChanged) {
    conflictResult = await checkConflict(
      tenantId,
      existing.doctorId,
      newDate,
      newStartTime,
      newDuration,
      appointmentId
    );
  }

  // Build update values
  const updateValues: Record<string, unknown> = {
    updatedAt: new Date(),
  };
  if (validData.date !== undefined) updateValues.date = validData.date;
  if (validData.startTime !== undefined) updateValues.startTime = validData.startTime;
  if (validData.duration !== undefined) updateValues.duration = validData.duration;
  if (validData.visitType !== undefined) updateValues.visitType = validData.visitType;
  if (validData.notes !== undefined) updateValues.notes = validData.notes;
  if (validData.compteRendu !== undefined) updateValues.compteRendu = validData.compteRendu;

  const [updated] = await db
    .update(appointments)
    .set(updateValues)
    .where(
      and(
        eq(appointments.id, appointmentId),
        eq(appointments.tenantId, tenantId)
      )
    )
    .returning({
      id: appointments.id,
      tenantId: appointments.tenantId,
      patientId: appointments.patientId,
      doctorId: appointments.doctorId,
      date: appointments.date,
      startTime: appointments.startTime,
      duration: appointments.duration,
      visitType: appointments.visitType,
      isCancelled: appointments.isCancelled,
      notes: appointments.notes,
      createdAt: appointments.createdAt,
      updatedAt: appointments.updatedAt,
    });

  const result: { appointment: AppointmentResult; conflictWarning?: ConflictCheckResult } = {
    appointment: updated as AppointmentResult,
  };

  if (conflictResult?.hasConflict) {
    result.conflictWarning = conflictResult;
  }

  return result;
}

/**
 * Cancels an appointment by setting isCancelled=true.
 * Throws NotFoundError if the appointment doesn't exist.
 */
export async function cancel(
  tenantId: string,
  appointmentId: string
): Promise<void> {
  const [updated] = await db
    .update(appointments)
    .set({
      isCancelled: true,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(appointments.id, appointmentId),
        eq(appointments.tenantId, tenantId)
      )
    )
    .returning({ id: appointments.id });

  if (!updated) {
    throw new NotFoundError('Appointment');
  }
}

/**
 * Returns all non-cancelled appointments within a date range for the given tenant.
 */
export async function getByDateRange(
  tenantId: string,
  startDate: string,
  endDate: string
): Promise<AppointmentResult[]> {
  const results = await db
    .select({
      id: appointments.id,
      tenantId: appointments.tenantId,
      patientId: appointments.patientId,
      doctorId: appointments.doctorId,
      date: appointments.date,
      startTime: appointments.startTime,
      duration: appointments.duration,
      visitType: appointments.visitType,
      isCancelled: appointments.isCancelled,
      notes: appointments.notes,
      bloodPressure: appointments.bloodPressure,
      weightKg: appointments.weightKg,
      heightCm: appointments.heightCm,
      temperatureC: appointments.temperatureC,
      compteRendu: appointments.compteRendu,
      createdAt: appointments.createdAt,
      updatedAt: appointments.updatedAt,
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.tenantId, tenantId),
        eq(appointments.isCancelled, false),
        gte(appointments.date, startDate),
        lte(appointments.date, endDate)
      )
    );

  return results as AppointmentResult[];
}

/**
 * Returns all non-cancelled appointments for a specific date within the given tenant.
 */
export async function getByDate(
  tenantId: string,
  date: string
): Promise<AppointmentResult[]> {
  const results = await db
    .select({
      id: appointments.id,
      tenantId: appointments.tenantId,
      patientId: appointments.patientId,
      doctorId: appointments.doctorId,
      date: appointments.date,
      startTime: appointments.startTime,
      duration: appointments.duration,
      visitType: appointments.visitType,
      isCancelled: appointments.isCancelled,
      notes: appointments.notes,
      createdAt: appointments.createdAt,
      updatedAt: appointments.updatedAt,
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.tenantId, tenantId),
        eq(appointments.date, date),
        eq(appointments.isCancelled, false)
      )
    );

  return results as AppointmentResult[];
}

/**
 * Returns non-cancelled appointments for a specific patient within the given tenant.
 * Sorted by date in descending order (most recent first).
 * Returns only the fields needed for the appointment selector display.
 */
export async function getByPatient(
  tenantId: string,
  patientId: string
): Promise<PatientAppointmentResult[]> {
  const results = await db
    .select({
      id: appointments.id,
      date: appointments.date,
      startTime: appointments.startTime,
      visitType: appointments.visitType,
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.tenantId, tenantId),
        eq(appointments.patientId, patientId),
        eq(appointments.isCancelled, false)
      )
    )
    .orderBy(desc(appointments.date));

  return results as PatientAppointmentResult[];
}

import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { reminders, patients } from '@/lib/db/schema';
import { NotFoundError, ValidationError } from '@/lib/errors';

// ─── Validation Schemas ───────────────────────────────────────────────────────

export const createReminderSchema = z
  .object({
    patientId: z.string().uuid('Patient ID must be a valid UUID'),
    intervalDays: z
      .number()
      .int('Interval must be a whole number')
      .positive('Interval must be a positive number'),
    reminderType: z.enum(['follow_up', 'check_up', 'custom'], {
      errorMap: () => ({ message: 'Reminder type must be follow_up, check_up, or custom' }),
    }),
    customMessage: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.reminderType === 'custom') {
        return !!data.customMessage && data.customMessage.trim().length > 0;
      }
      return true;
    },
    {
      message: 'Custom message is required when reminder type is custom',
      path: ['customMessage'],
    }
  );

// ─── Types ────────────────────────────────────────────────────────────────────

export type CreateReminderInput = z.input<typeof createReminderSchema>;

export interface ReminderResult {
  id: string;
  tenantId: string;
  patientId: string;
  targetDate: string;
  reminderType: 'follow_up' | 'check_up' | 'custom';
  customMessage: string | null;
  status: 'pending' | 'sent' | 'dismissed';
  intervalDays: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReminderWithPatient {
  id: string;
  tenantId: string;
  patientId: string;
  patientName: string;
  targetDate: string;
  reminderType: 'follow_up' | 'check_up' | 'custom';
  customMessage: string | null;
  status: 'pending' | 'sent' | 'dismissed';
  intervalDays: number;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Calculates the target date by adding intervalDays to today's date.
 */
function calculateTargetDate(intervalDays: number): string {
  const today = new Date();
  today.setDate(today.getDate() + intervalDays);
  return today.toISOString().split('T')[0];
}

// ─── Service Functions ────────────────────────────────────────────────────────

/**
 * Creates a new reminder for a patient within the specified tenant.
 * Calculates targetDate = today + intervalDays.
 * Validates input using Zod schema, including that customMessage is required
 * when reminderType is 'custom'.
 */
export async function create(
  tenantId: string,
  data: CreateReminderInput
): Promise<ReminderResult> {
  const parsed = createReminderSchema.safeParse(data);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path.join('.') || '_form';
      fieldErrors[field] = issue.message;
    }
    throw new ValidationError('Invalid reminder data', fieldErrors);
  }

  const validData = parsed.data;
  const targetDate = calculateTargetDate(validData.intervalDays);

  const [created] = await db
    .insert(reminders)
    .values({
      tenantId,
      patientId: validData.patientId,
      targetDate,
      reminderType: validData.reminderType,
      customMessage: validData.customMessage || null,
      status: 'pending',
      intervalDays: validData.intervalDays,
    })
    .returning({
      id: reminders.id,
      tenantId: reminders.tenantId,
      patientId: reminders.patientId,
      targetDate: reminders.targetDate,
      reminderType: reminders.reminderType,
      customMessage: reminders.customMessage,
      status: reminders.status,
      intervalDays: reminders.intervalDays,
      createdAt: reminders.createdAt,
      updatedAt: reminders.updatedAt,
    });

  return created;
}

/**
 * Dismisses a reminder by setting its status to 'dismissed'.
 * Dismissal is irreversible — once dismissed, a reminder cannot revert to pending.
 * Throws NotFoundError if the reminder does not exist within the tenant.
 */
export async function dismiss(
  tenantId: string,
  reminderId: string
): Promise<void> {
  const [dismissed] = await db
    .update(reminders)
    .set({
      status: 'dismissed',
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(reminders.id, reminderId),
        eq(reminders.tenantId, tenantId)
      )
    )
    .returning({ id: reminders.id });

  if (!dismissed) {
    throw new NotFoundError('Reminder');
  }
}

/**
 * Lists all reminders for the specified tenant with patient information.
 * Returns reminders with patient name, status, target date, and type.
 */
export async function list(
  tenantId: string
): Promise<ReminderWithPatient[]> {
  const results = await db
    .select({
      id: reminders.id,
      tenantId: reminders.tenantId,
      patientId: reminders.patientId,
      patientFirstName: patients.firstName,
      patientLastName: patients.lastName,
      targetDate: reminders.targetDate,
      reminderType: reminders.reminderType,
      customMessage: reminders.customMessage,
      status: reminders.status,
      intervalDays: reminders.intervalDays,
      createdAt: reminders.createdAt,
      updatedAt: reminders.updatedAt,
    })
    .from(reminders)
    .innerJoin(patients, eq(reminders.patientId, patients.id))
    .where(eq(reminders.tenantId, tenantId));

  return results.map((row) => ({
    id: row.id,
    tenantId: row.tenantId,
    patientId: row.patientId,
    patientName: `${row.patientFirstName} ${row.patientLastName}`,
    targetDate: row.targetDate,
    reminderType: row.reminderType,
    customMessage: row.customMessage,
    status: row.status,
    intervalDays: row.intervalDays,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
}

/**
 * Returns all reminders for a specific patient within the tenant.
 */
export async function getByPatient(
  tenantId: string,
  patientId: string
): Promise<ReminderResult[]> {
  const results = await db
    .select({
      id: reminders.id,
      tenantId: reminders.tenantId,
      patientId: reminders.patientId,
      targetDate: reminders.targetDate,
      reminderType: reminders.reminderType,
      customMessage: reminders.customMessage,
      status: reminders.status,
      intervalDays: reminders.intervalDays,
      createdAt: reminders.createdAt,
      updatedAt: reminders.updatedAt,
    })
    .from(reminders)
    .where(
      and(
        eq(reminders.tenantId, tenantId),
        eq(reminders.patientId, patientId)
      )
    );

  return results;
}

import { z } from 'zod';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { financialEntries, appointments } from '@/lib/db/schema';
import { NotFoundError, ValidationError } from '@/lib/errors';

// ─── Validation Schemas ───────────────────────────────────────────────────────

export const createFinancialEntrySchema = z.object({
  appointmentId: z.string().uuid('Appointment ID must be a valid UUID'),
  amount: z
    .number()
    .int('Amount must be a whole number')
    .positive('Amount must be a positive number'),
  paymentDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Payment date must be in ISO format (YYYY-MM-DD)'),
  notes: z.string().optional(),
});

export const updateFinancialEntrySchema = z.object({
  amount: z
    .number()
    .int('Amount must be a whole number')
    .positive('Amount must be a positive number')
    .optional(),
  paymentDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Payment date must be in ISO format (YYYY-MM-DD)')
    .optional(),
  notes: z.string().optional(),
});

// ─── Types ────────────────────────────────────────────────────────────────────

export type CreateFinancialEntryInput = z.input<typeof createFinancialEntrySchema>;
export type UpdateFinancialEntryInput = z.input<typeof updateFinancialEntrySchema>;

export interface FinancialEntryResult {
  id: string;
  tenantId: string;
  appointmentId: string;
  amount: number;
  paymentDate: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FinancialSummary {
  totalReceived: number;
  paidCount: number;
  unpaidCount: number;
  dateRange: { start: string; end: string };
}

// ─── Service Functions ────────────────────────────────────────────────────────

/**
 * Creates a new financial entry for an appointment within the specified tenant.
 * Validates input using Zod schema.
 * Requirements: 15.1
 */
export async function createEntry(
  tenantId: string,
  data: CreateFinancialEntryInput
): Promise<FinancialEntryResult> {
  const parsed = createFinancialEntrySchema.safeParse(data);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path.join('.') || '_form';
      fieldErrors[field] = issue.message;
    }
    throw new ValidationError('Invalid financial entry data', fieldErrors);
  }

  const validData = parsed.data;

  const [created] = await db
    .insert(financialEntries)
    .values({
      tenantId,
      appointmentId: validData.appointmentId,
      amount: validData.amount,
      paymentDate: validData.paymentDate,
      notes: validData.notes || null,
    })
    .returning({
      id: financialEntries.id,
      tenantId: financialEntries.tenantId,
      appointmentId: financialEntries.appointmentId,
      amount: financialEntries.amount,
      paymentDate: financialEntries.paymentDate,
      notes: financialEntries.notes,
      createdAt: financialEntries.createdAt,
      updatedAt: financialEntries.updatedAt,
    });

  return created;
}

/**
 * Updates an existing financial entry within the specified tenant.
 * Only provided fields are updated; updatedAt is always refreshed.
 * Throws NotFoundError if entry does not exist in the tenant.
 * Requirements: 15.5
 */
export async function updateEntry(
  tenantId: string,
  entryId: string,
  data: UpdateFinancialEntryInput
): Promise<FinancialEntryResult> {
  const parsed = updateFinancialEntrySchema.safeParse(data);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path.join('.') || '_form';
      fieldErrors[field] = issue.message;
    }
    throw new ValidationError('Invalid financial entry data', fieldErrors);
  }

  const validData = parsed.data;

  const updateValues: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (validData.amount !== undefined) {
    updateValues.amount = validData.amount;
  }
  if (validData.paymentDate !== undefined) {
    updateValues.paymentDate = validData.paymentDate;
  }
  if (validData.notes !== undefined) {
    updateValues.notes = validData.notes;
  }

  const [updated] = await db
    .update(financialEntries)
    .set(updateValues)
    .where(
      and(
        eq(financialEntries.id, entryId),
        eq(financialEntries.tenantId, tenantId)
      )
    )
    .returning({
      id: financialEntries.id,
      tenantId: financialEntries.tenantId,
      appointmentId: financialEntries.appointmentId,
      amount: financialEntries.amount,
      paymentDate: financialEntries.paymentDate,
      notes: financialEntries.notes,
      createdAt: financialEntries.createdAt,
      updatedAt: financialEntries.updatedAt,
    });

  if (!updated) {
    throw new NotFoundError('Financial entry');
  }

  return updated;
}

/**
 * Derives the payment status for an appointment by summing all financial entries.
 * Returns 'paid' if the total amount > 0, otherwise 'unpaid'.
 * Requirements: 15.2
 */
export async function getPaymentStatus(
  tenantId: string,
  appointmentId: string
): Promise<'paid' | 'unpaid'> {
  const result = await db
    .select({
      totalAmount: sql<number>`COALESCE(SUM(${financialEntries.amount}), 0)`,
    })
    .from(financialEntries)
    .where(
      and(
        eq(financialEntries.tenantId, tenantId),
        eq(financialEntries.appointmentId, appointmentId)
      )
    );

  const totalAmount = Number(result[0]?.totalAmount ?? 0);
  return totalAmount > 0 ? 'paid' : 'unpaid';
}

/**
 * Gets a financial summary for the specified date range within a tenant.
 * Calculates totalReceived (sum of all entry amounts), paidCount (appointments
 * with entries summing > 0), and unpaidCount (appointments with no entries or
 * entries summing to 0).
 * Requirements: 15.3
 */
export async function getSummary(
  tenantId: string,
  startDate: string,
  endDate: string
): Promise<FinancialSummary> {
  // Get all financial entries in date range
  const entries = await db
    .select({
      appointmentId: financialEntries.appointmentId,
      amount: financialEntries.amount,
    })
    .from(financialEntries)
    .where(
      and(
        eq(financialEntries.tenantId, tenantId),
        gte(financialEntries.paymentDate, startDate),
        lte(financialEntries.paymentDate, endDate)
      )
    );

  // Get all appointments in date range (non-cancelled)
  const appointmentsInRange = await db
    .select({
      id: appointments.id,
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.tenantId, tenantId),
        gte(appointments.date, startDate),
        lte(appointments.date, endDate),
        eq(appointments.isCancelled, false)
      )
    );

  // Calculate total received
  const totalReceived = entries.reduce((sum, entry) => sum + entry.amount, 0);

  // Group entries by appointment and sum amounts
  const amountByAppointment = new Map<string, number>();
  for (const entry of entries) {
    const current = amountByAppointment.get(entry.appointmentId) || 0;
    amountByAppointment.set(entry.appointmentId, current + entry.amount);
  }

  // Count paid appointments (those with total amount > 0)
  let paidCount = 0;
  let unpaidCount = 0;

  for (const appointment of appointmentsInRange) {
    const totalAmount = amountByAppointment.get(appointment.id) || 0;
    if (totalAmount > 0) {
      paidCount++;
    } else {
      unpaidCount++;
    }
  }

  return {
    totalReceived,
    paidCount,
    unpaidCount,
    dateRange: { start: startDate, end: endDate },
  };
}

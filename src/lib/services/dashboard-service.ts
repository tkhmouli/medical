import { z } from 'zod';
import { eq, and, asc, gte, lte, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { appointments, patients, financialEntries } from '@/lib/db/schema';
import { NotFoundError, ValidationError } from '@/lib/errors';

// ─── Constants ────────────────────────────────────────────────────────────────

export const APPOINTMENT_STATUSES = ['scheduled', 'waiting', 'in_progress', 'completed'] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

// ─── Validation Schemas ───────────────────────────────────────────────────────

export const appointmentStatusSchema = z.enum(APPOINTMENT_STATUSES, {
  errorMap: () => ({
    message: 'Status must be one of: scheduled, waiting, in_progress, completed',
  }),
});

export const updateStatusSchema = z.object({
  status: appointmentStatusSchema,
});

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DashboardAppointment {
  id: string;
  patientId: string;
  patientName: string;
  startTime: string;
  duration: number;
  visitType: string;
  status: AppointmentStatus;
}

export interface DashboardStats {
  today: DashboardAppointment[];
  tomorrow: DashboardAppointment[];
  waitingCount: number;
  seenCount: number;
}

export interface DashboardFinancials {
  ytdRevenue: number;
  monthlyRevenue: number;
  weeklyRevenue: number;
  ytdPatientsSeen: number;
}

// ─── Pure Utility Functions ───────────────────────────────────────────────────

/**
 * Counts appointments by status from a list of appointments.
 * Pure function suitable for property-based testing.
 */
export function countByStatus(
  appointments: { status: AppointmentStatus }[],
  targetStatus: AppointmentStatus
): number {
  return appointments.filter((a) => a.status === targetStatus).length;
}

/**
 * Filters non-cancelled appointments and sorts by start time ascending.
 * Pure function suitable for property-based testing.
 */
export function filterAndSortAppointments<
  T extends { isCancelled: boolean; startTime: string }
>(appointments: T[]): T[] {
  return appointments
    .filter((a) => !a.isCancelled)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
}

/**
 * Computes total revenue from a list of financial entries within a date range.
 * Pure function suitable for property-based testing.
 * Includes entries whose paymentDate falls within [startDate, endDate] inclusive.
 */
export function computeRevenue(
  entries: { amount: number; paymentDate: string }[],
  startDate: string,
  endDate: string
): number {
  return entries
    .filter((e) => e.paymentDate >= startDate && e.paymentDate <= endDate)
    .reduce((sum, e) => sum + e.amount, 0);
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Computes the next calendar day in YYYY-MM-DD format.
 */
function getNextDay(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  date.setDate(date.getDate() + 1);
  return date.toISOString().split('T')[0];
}

/**
 * Queries non-cancelled appointments on a specific date,
 * joining with the patients table to get patient names.
 * If doctorId is provided, filters by that doctor.
 * If doctorId is null, returns all appointments for the tenant.
 * Returns results sorted by start time ascending.
 */
async function queryAppointmentsForDate(
  tenantId: string,
  doctorId: string | null,
  date: string
): Promise<DashboardAppointment[]> {
  const conditions = [
    eq(appointments.tenantId, tenantId),
    eq(appointments.date, date),
    eq(appointments.isCancelled, false),
  ];

  if (doctorId) {
    conditions.push(eq(appointments.doctorId, doctorId));
  }

  const results = await db
    .select({
      id: appointments.id,
      patientId: appointments.patientId,
      firstName: patients.firstName,
      lastName: patients.lastName,
      startTime: appointments.startTime,
      duration: appointments.duration,
      visitType: appointments.visitType,
      status: appointments.status,
    })
    .from(appointments)
    .innerJoin(patients, eq(appointments.patientId, patients.id))
    .where(and(...conditions))
    .orderBy(asc(appointments.startTime));

  return results.map((row) => ({
    id: row.id,
    patientId: row.patientId,
    patientName: `${row.firstName} ${row.lastName}`,
    startTime: row.startTime,
    duration: row.duration,
    visitType: row.visitType,
    status: row.status as AppointmentStatus,
  }));
}

// ─── Service Functions ────────────────────────────────────────────────────────

/**
 * Get dashboard statistics for a specific doctor on a specific date.
 * Returns today's and tomorrow's appointments (non-cancelled, sorted by start time),
 * plus waiting and completed counts.
 */
export async function getDashboardStats(
  tenantId: string,
  doctorId: string | null,
  today: string
): Promise<DashboardStats> {
  const tomorrow = getNextDay(today);

  const [todayAppointments, tomorrowAppointments] = await Promise.all([
    queryAppointmentsForDate(tenantId, doctorId, today),
    queryAppointmentsForDate(tenantId, doctorId, tomorrow),
  ]);

  const waitingCount = countByStatus(todayAppointments, 'waiting');
  const seenCount = countByStatus(todayAppointments, 'completed');

  return {
    today: todayAppointments,
    tomorrow: tomorrowAppointments,
    waitingCount,
    seenCount,
  };
}

/**
 * Get appointments for a specific date for a doctor.
 * Used by the date picker to load arbitrary date schedules.
 */
export async function getScheduleForDate(
  tenantId: string,
  doctorId: string | null,
  date: string
): Promise<DashboardAppointment[]> {
  return queryAppointmentsForDate(tenantId, doctorId, date);
}

/**
 * Update appointment status.
 * Validates the new status is a valid enum value.
 * Throws NotFoundError if the appointment doesn't exist in the tenant.
 * Throws ValidationError if the status value is invalid.
 */
export async function updateAppointmentStatus(
  tenantId: string,
  appointmentId: string,
  status: string
): Promise<void> {
  const parsed = updateStatusSchema.safeParse({ status });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path.join('.') || 'status';
      fieldErrors[field] = issue.message;
    }
    throw new ValidationError('Invalid appointment status', fieldErrors);
  }

  const [updated] = await db
    .update(appointments)
    .set({
      status: parsed.data.status,
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

// ─── Financial Dashboard Functions ────────────────────────────────────────────

/**
 * Gets the Monday of the current week for a given date string (YYYY-MM-DD).
 */
function getWeekStart(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const day = date.getDay();
  // getDay() returns 0 for Sunday, 1 for Monday, etc.
  // We want Monday as start of week
  const diff = day === 0 ? 6 : day - 1;
  date.setDate(date.getDate() - diff);
  return date.toISOString().split('T')[0];
}

/**
 * Gets the Sunday of the current week for a given date string (YYYY-MM-DD).
 */
function getWeekEnd(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const day = date.getDay();
  // getDay() returns 0 for Sunday, 1 for Monday, etc.
  const diff = day === 0 ? 0 : 7 - day;
  date.setDate(date.getDate() + diff);
  return date.toISOString().split('T')[0];
}

/**
 * Compute dashboard financial summary.
 * Returns YTD revenue, monthly revenue, weekly revenue, and YTD patients seen.
 */
export async function getDashboardFinancials(
  tenantId: string
): Promise<DashboardFinancials> {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');

  const ytdStart = `${year}-01-01`;
  const monthStart = `${year}-${month}-01`;
  const weekStart = getWeekStart(today);
  const weekEnd = getWeekEnd(today);

  // Query all financial entries for YTD (we'll compute monthly and weekly from the same set)
  const entries = await db
    .select({
      amount: financialEntries.amount,
      paymentDate: financialEntries.paymentDate,
    })
    .from(financialEntries)
    .where(
      and(
        eq(financialEntries.tenantId, tenantId),
        gte(financialEntries.paymentDate, ytdStart),
        lte(financialEntries.paymentDate, today)
      )
    );

  const ytdRevenue = computeRevenue(entries, ytdStart, today);
  const monthlyRevenue = computeRevenue(entries, monthStart, today);
  const weeklyRevenue = computeRevenue(entries, weekStart, weekEnd);

  // Query completed appointments YTD for patients-seen count
  const patientsSeenResult = await db
    .select({
      count: sql<number>`COUNT(*)`,
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.tenantId, tenantId),
        eq(appointments.status, 'completed'),
        eq(appointments.isCancelled, false),
        gte(appointments.date, ytdStart),
        lte(appointments.date, today)
      )
    );

  const ytdPatientsSeen = Number(patientsSeenResult[0]?.count ?? 0);

  return {
    ytdRevenue,
    monthlyRevenue,
    weeklyRevenue,
    ytdPatientsSeen,
  };
}

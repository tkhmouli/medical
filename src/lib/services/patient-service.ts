import { z } from 'zod';
import { eq, and, or, ilike, asc, desc, type SQL } from 'drizzle-orm';
import { db } from '@/lib/db';
import { patients, appointments, users } from '@/lib/db/schema';
import { NotFoundError, ValidationError } from '@/lib/errors';

// ─── Validation Schemas ───────────────────────────────────────────────────────

export const createPatientSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be in ISO format (YYYY-MM-DD)'),
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

export const updatePatientSchema = z
  .object({
    firstName: z.string().min(1, 'First name is required').optional(),
    lastName: z.string().min(1, 'Last name is required').optional(),
    dateOfBirth: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be in ISO format (YYYY-MM-DD)')
      .optional(),
    phoneNumber: z.string().min(1, 'Phone number is required').optional(),
    gender: z
      .enum(['male', 'female', 'other'], {
        errorMap: () => ({ message: 'Gender must be male, female, or other' }),
      })
      .optional(),
    secondaryPhone: z.string().optional(),
    cinNumber: z.string().optional(),
    email: z.string().email('Invalid email format').optional().or(z.literal('')),
    address: z.string().optional(),
    notes: z.string().optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'At least one field must be provided for update',
  });

// ─── Types ────────────────────────────────────────────────────────────────────

export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type UpdatePatientInput = z.input<typeof updatePatientSchema>;

export interface PatientResult {
  id: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  phoneNumber: string;
  secondaryPhone: string | null;
  cinNumber: string | null;
  gender: 'male' | 'female' | 'other';
  email: string | null;
  address: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Quick Search Types ───────────────────────────────────────────────────────

export interface QuickSearchResult {
  id: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
}

// ─── Quick Search Function ────────────────────────────────────────────────────

/**
 * OR-based patient search for typeahead.
 * Matches if query appears in firstName, lastName, OR phoneNumber (case-insensitive).
 * Results are scoped by tenantId, ordered by lastName ASC, firstName ASC.
 * Enforces a max limit of 50 and defaults to 20.
 *
 * Requirements: 2.1, 2.2, 4.1, 4.2
 */
export async function quickSearch(
  tenantId: string,
  query: string,
  limit: number = 20
): Promise<QuickSearchResult[]> {
  const effectiveLimit = Math.min(Math.max(1, limit), 50);
  const pattern = `%${query}%`;

  const results = await db
    .select({
      id: patients.id,
      firstName: patients.firstName,
      lastName: patients.lastName,
      phoneNumber: patients.phoneNumber,
    })
    .from(patients)
    .where(
      and(
        eq(patients.tenantId, tenantId),
        or(
          ilike(patients.firstName, pattern),
          ilike(patients.lastName, pattern),
          ilike(patients.phoneNumber, pattern)
        )
      )
    )
    .orderBy(asc(patients.lastName), asc(patients.firstName))
    .limit(effectiveLimit);

  return results;
}

// ─── Service Functions ────────────────────────────────────────────────────────

/**
 * Creates a new patient within the specified tenant.
 * Validates input using Zod schema before inserting.
 */
export async function create(
  tenantId: string,
  data: CreatePatientInput
): Promise<PatientResult> {
  const parsed = createPatientSchema.safeParse(data);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path.join('.');
      fieldErrors[field] = issue.message;
    }
    throw new ValidationError('Invalid patient data', fieldErrors);
  }

  const validData = parsed.data;

  const [created] = await db
    .insert(patients)
    .values({
      tenantId,
      firstName: validData.firstName,
      lastName: validData.lastName,
      dateOfBirth: validData.dateOfBirth,
      phoneNumber: validData.phoneNumber,
      gender: validData.gender,
      secondaryPhone: validData.secondaryPhone || null,
      cinNumber: validData.cinNumber || null,
      email: validData.email || null,
      address: validData.address || null,
      notes: validData.notes || null,
    })
    .returning({
      id: patients.id,
      tenantId: patients.tenantId,
      firstName: patients.firstName,
      lastName: patients.lastName,
      dateOfBirth: patients.dateOfBirth,
      phoneNumber: patients.phoneNumber,
      secondaryPhone: patients.secondaryPhone,
      cinNumber: patients.cinNumber,
      gender: patients.gender,
      email: patients.email,
      address: patients.address,
      notes: patients.notes,
      createdAt: patients.createdAt,
      updatedAt: patients.updatedAt,
    });

  return created;
}

/**
 * Updates an existing patient within the specified tenant.
 * Validates input, updates the record with updatedAt timestamp.
 * Throws NotFoundError if the patient doesn't exist.
 */
export async function update(
  tenantId: string,
  patientId: string,
  data: UpdatePatientInput
): Promise<PatientResult> {
  const parsed = updatePatientSchema.safeParse(data);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path.join('.') || '_form';
      fieldErrors[field] = issue.message;
    }
    throw new ValidationError('Invalid patient data', fieldErrors);
  }

  const validData = parsed.data;

  // Build update payload with only provided fields
  const updatePayload: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (validData.firstName !== undefined) updatePayload.firstName = validData.firstName;
  if (validData.lastName !== undefined) updatePayload.lastName = validData.lastName;
  if (validData.dateOfBirth !== undefined) updatePayload.dateOfBirth = validData.dateOfBirth;
  if (validData.phoneNumber !== undefined) updatePayload.phoneNumber = validData.phoneNumber;
  if (validData.gender !== undefined) updatePayload.gender = validData.gender;
  if (validData.secondaryPhone !== undefined) updatePayload.secondaryPhone = validData.secondaryPhone || null;
  if (validData.cinNumber !== undefined) updatePayload.cinNumber = validData.cinNumber || null;
  if (validData.email !== undefined) updatePayload.email = validData.email || null;
  if (validData.address !== undefined) updatePayload.address = validData.address || null;
  if (validData.notes !== undefined) updatePayload.notes = validData.notes || null;

  const [updated] = await db
    .update(patients)
    .set(updatePayload)
    .where(and(eq(patients.id, patientId), eq(patients.tenantId, tenantId)))
    .returning({
      id: patients.id,
      tenantId: patients.tenantId,
      firstName: patients.firstName,
      lastName: patients.lastName,
      dateOfBirth: patients.dateOfBirth,
      phoneNumber: patients.phoneNumber,
      secondaryPhone: patients.secondaryPhone,
      cinNumber: patients.cinNumber,
      gender: patients.gender,
      email: patients.email,
      address: patients.address,
      notes: patients.notes,
      createdAt: patients.createdAt,
      updatedAt: patients.updatedAt,
    });

  if (!updated) {
    throw new NotFoundError('Patient');
  }

  return updated;
}

/**
 * Deletes a patient within the specified tenant.
 * Database cascade handles deletion of related records (appointments,
 * financial_entries, prescriptions, prescription_items, patient_insurances, reminders).
 * Throws NotFoundError if the patient doesn't exist.
 */
export async function deletePatient(
  tenantId: string,
  patientId: string
): Promise<void> {
  const [deleted] = await db
    .delete(patients)
    .where(and(eq(patients.id, patientId), eq(patients.tenantId, tenantId)))
    .returning({ id: patients.id });

  if (!deleted) {
    throw new NotFoundError('Patient');
  }
}

/**
 * Gets a single patient by id within the specified tenant.
 * Throws NotFoundError if the patient doesn't exist.
 */
export async function getById(
  tenantId: string,
  patientId: string
): Promise<PatientResult> {
  const [patient] = await db
    .select({
      id: patients.id,
      tenantId: patients.tenantId,
      firstName: patients.firstName,
      lastName: patients.lastName,
      dateOfBirth: patients.dateOfBirth,
      phoneNumber: patients.phoneNumber,
      secondaryPhone: patients.secondaryPhone,
      cinNumber: patients.cinNumber,
      gender: patients.gender,
      email: patients.email,
      address: patients.address,
      notes: patients.notes,
      createdAt: patients.createdAt,
      updatedAt: patients.updatedAt,
    })
    .from(patients)
    .where(and(eq(patients.id, patientId), eq(patients.tenantId, tenantId)))
    .limit(1);

  if (!patient) {
    throw new NotFoundError('Patient');
  }

  return patient;
}

// ─── Search Types ─────────────────────────────────────────────────────────────

export interface PatientSearchCriteria {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  dateOfBirth?: string; // ISO 8601 date for exact match
}

// ─── Search Helper ────────────────────────────────────────────────────────────

/**
 * Builds a dynamic search query from the provided criteria.
 * - firstName, lastName, phoneNumber use case-insensitive partial matching (ILIKE %value%)
 * - dateOfBirth uses exact match (eq)
 * - All provided criteria are combined with AND logic
 * - Always scopes by tenantId
 */
export function buildSearchQuery(tenantId: string, criteria: PatientSearchCriteria): SQL {
  const conditions: SQL[] = [eq(patients.tenantId, tenantId)];

  if (criteria.firstName) {
    conditions.push(ilike(patients.firstName, `%${criteria.firstName}%`));
  }

  if (criteria.lastName) {
    conditions.push(ilike(patients.lastName, `%${criteria.lastName}%`));
  }

  if (criteria.phoneNumber) {
    conditions.push(ilike(patients.phoneNumber, `%${criteria.phoneNumber}%`));
  }

  if (criteria.dateOfBirth) {
    conditions.push(eq(patients.dateOfBirth, criteria.dateOfBirth));
  }

  return and(...conditions)!;
}

// ─── Search Function ──────────────────────────────────────────────────────────

/**
 * Searches for patients within the specified tenant using multi-criteria matching.
 * Supports partial matching (case-insensitive ILIKE) for firstName, lastName, phoneNumber.
 * Supports exact match for dateOfBirth.
 * All provided criteria are combined with AND logic.
 * Returns an empty array when no patients match.
 */
export async function search(
  tenantId: string,
  criteria: PatientSearchCriteria
): Promise<PatientResult[]> {
  const whereClause = buildSearchQuery(tenantId, criteria);

  const results = await db
    .select({
      id: patients.id,
      tenantId: patients.tenantId,
      firstName: patients.firstName,
      lastName: patients.lastName,
      dateOfBirth: patients.dateOfBirth,
      phoneNumber: patients.phoneNumber,
      secondaryPhone: patients.secondaryPhone,
      cinNumber: patients.cinNumber,
      gender: patients.gender,
      email: patients.email,
      address: patients.address,
      notes: patients.notes,
      createdAt: patients.createdAt,
      updatedAt: patients.updatedAt,
    })
    .from(patients)
    .where(whereClause);

  return results;
}

// ─── Visit History Types ──────────────────────────────────────────────────────

export interface VisitRecord {
  appointmentId: string;
  date: string;
  visitType: 'new_visit' | 'control_visit' | 'follow_up';
  doctorName: string;
  notes: string | null;
}

export interface VisitHistoryResult {
  visits: VisitRecord[];
  totalCount: number;
  classification: 'first_time' | 'returning';
  lastVisitDate: string | null;
}

// ─── Visit History Function ───────────────────────────────────────────────────

/**
 * Derives a patient's visit history from non-cancelled appointments.
 * Joins with users table to get doctor names.
 * Returns chronological list (most recent first), total count, classification, and last visit date.
 * All data is derived from appointment history — no manual data entry required.
 *
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6
 */
export async function getVisitHistory(
  tenantId: string,
  patientId: string
): Promise<VisitHistoryResult> {
  // Verify the patient exists within this tenant
  const [patient] = await db
    .select({ id: patients.id })
    .from(patients)
    .where(and(eq(patients.id, patientId), eq(patients.tenantId, tenantId)))
    .limit(1);

  if (!patient) {
    throw new NotFoundError('Patient');
  }

  // Query non-cancelled appointments joined with users for doctorName
  // Sorted chronologically with most recent first
  const visitRows = await db
    .select({
      appointmentId: appointments.id,
      date: appointments.date,
      visitType: appointments.visitType,
      doctorName: users.name,
      notes: appointments.notes,
    })
    .from(appointments)
    .innerJoin(users, eq(appointments.doctorId, users.id))
    .where(
      and(
        eq(appointments.tenantId, tenantId),
        eq(appointments.patientId, patientId),
        eq(appointments.isCancelled, false)
      )
    )
    .orderBy(desc(appointments.date), desc(appointments.startTime));

  const visits: VisitRecord[] = visitRows.map((row) => ({
    appointmentId: row.appointmentId,
    date: row.date,
    visitType: row.visitType,
    doctorName: row.doctorName,
    notes: row.notes,
  }));

  const totalCount = visits.length;
  const classification: 'first_time' | 'returning' = totalCount === 0 ? 'first_time' : 'returning';
  const lastVisitDate = totalCount > 0 ? visits[0].date : null;

  return {
    visits,
    totalCount,
    classification,
    lastVisitDate,
  };
}

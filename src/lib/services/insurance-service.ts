import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { patientInsurances } from '@/lib/db/schema';
import { NotFoundError, ValidationError } from '@/lib/errors';

// ─── Constants ────────────────────────────────────────────────────────────────

export const INSURANCE_PROVIDER_TYPES = [
  'CNSS',
  'CNOPS',
  'AXA',
  'Atlanta',
  'SAHAM',
  'RMA',
  'other',
] as const;

export type InsuranceProviderType = (typeof INSURANCE_PROVIDER_TYPES)[number];

// ─── Validation Schemas ───────────────────────────────────────────────────────

export const createInsuranceSchema = z
  .object({
    providerType: z.enum(INSURANCE_PROVIDER_TYPES, {
      errorMap: () => ({
        message:
          'Provider type must be one of: CNSS, CNOPS, AXA, Atlanta, SAHAM, RMA, other',
      }),
    }),
    providerName: z.string().optional(),
    membershipNumber: z.string().min(1, 'Membership number is required'),
  })
  .refine(
    (data) => {
      if (data.providerType === 'other') {
        return !!data.providerName && data.providerName.trim().length > 0;
      }
      return true;
    },
    {
      message: 'Provider name is required when provider type is "other"',
      path: ['providerName'],
    }
  );

// ─── Types ────────────────────────────────────────────────────────────────────

export type CreateInsuranceInput = z.input<typeof createInsuranceSchema>;

export interface InsuranceResult {
  id: string;
  tenantId: string;
  patientId: string;
  providerType: InsuranceProviderType;
  providerName: string | null;
  membershipNumber: string;
  createdAt: Date;
}

// ─── Service Functions ────────────────────────────────────────────────────────

/**
 * Adds an insurance record to a patient within the specified tenant.
 * Validates input using Zod schema before inserting.
 * Supports multiple insurance records per patient.
 */
export async function addInsurance(
  tenantId: string,
  patientId: string,
  data: CreateInsuranceInput
): Promise<InsuranceResult> {
  const parsed = createInsuranceSchema.safeParse(data);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path.join('.') || '_form';
      fieldErrors[field] = issue.message;
    }
    throw new ValidationError('Invalid insurance data', fieldErrors);
  }

  const validData = parsed.data;

  const [created] = await db
    .insert(patientInsurances)
    .values({
      tenantId,
      patientId,
      providerType: validData.providerType,
      providerName: validData.providerName || null,
      membershipNumber: validData.membershipNumber,
    })
    .returning({
      id: patientInsurances.id,
      tenantId: patientInsurances.tenantId,
      patientId: patientInsurances.patientId,
      providerType: patientInsurances.providerType,
      providerName: patientInsurances.providerName,
      membershipNumber: patientInsurances.membershipNumber,
      createdAt: patientInsurances.createdAt,
    });

  return created;
}

/**
 * Removes a specific insurance record within the specified tenant.
 * Throws NotFoundError if the insurance record doesn't exist.
 * Does NOT affect other insurance records for the same patient.
 */
export async function removeInsurance(
  tenantId: string,
  insuranceId: string
): Promise<void> {
  const [deleted] = await db
    .delete(patientInsurances)
    .where(
      and(
        eq(patientInsurances.id, insuranceId),
        eq(patientInsurances.tenantId, tenantId)
      )
    )
    .returning({ id: patientInsurances.id });

  if (!deleted) {
    throw new NotFoundError('Insurance record');
  }
}

/**
 * Lists all insurance records for a patient within the specified tenant.
 * Returns an empty array if no insurance records exist.
 */
export async function listByPatient(
  tenantId: string,
  patientId: string
): Promise<InsuranceResult[]> {
  const results = await db
    .select({
      id: patientInsurances.id,
      tenantId: patientInsurances.tenantId,
      patientId: patientInsurances.patientId,
      providerType: patientInsurances.providerType,
      providerName: patientInsurances.providerName,
      membershipNumber: patientInsurances.membershipNumber,
      createdAt: patientInsurances.createdAt,
    })
    .from(patientInsurances)
    .where(
      and(
        eq(patientInsurances.tenantId, tenantId),
        eq(patientInsurances.patientId, patientId)
      )
    );

  return results;
}

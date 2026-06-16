import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { medications } from '@/lib/db/schema';
import { NotFoundError, ValidationError } from '@/lib/errors';

// ─── Validation Schemas ───────────────────────────────────────────────────────

export const createMedicationSchema = z.object({
  name: z.string().min(1, 'Medication name is required'),
  dosageForm: z.string().min(1, 'Dosage form is required'),
  defaultInstructions: z.string().optional(),
});

export const updateMedicationSchema = z.object({
  name: z.string().min(1, 'Medication name is required').optional(),
  dosageForm: z.string().min(1, 'Dosage form is required').optional(),
  defaultInstructions: z.string().optional(),
});

// ─── Types ────────────────────────────────────────────────────────────────────

export type CreateMedicationInput = z.input<typeof createMedicationSchema>;
export type UpdateMedicationInput = z.input<typeof updateMedicationSchema>;

export interface MedicationResult {
  id: string;
  tenantId: string;
  name: string;
  dosageForm: string;
  defaultInstructions: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Service Functions ────────────────────────────────────────────────────────

/**
 * Creates a new medication in the catalog for the specified tenant.
 * Validates input using Zod schema before inserting.
 */
export async function create(
  tenantId: string,
  data: CreateMedicationInput
): Promise<MedicationResult> {
  const parsed = createMedicationSchema.safeParse(data);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path.join('.') || '_form';
      fieldErrors[field] = issue.message;
    }
    throw new ValidationError('Invalid medication data', fieldErrors);
  }

  const validData = parsed.data;

  const [created] = await db
    .insert(medications)
    .values({
      tenantId,
      name: validData.name,
      dosageForm: validData.dosageForm,
      defaultInstructions: validData.defaultInstructions || null,
    })
    .returning({
      id: medications.id,
      tenantId: medications.tenantId,
      name: medications.name,
      dosageForm: medications.dosageForm,
      defaultInstructions: medications.defaultInstructions,
      isActive: medications.isActive,
      createdAt: medications.createdAt,
      updatedAt: medications.updatedAt,
    });

  return created;
}

/**
 * Updates an existing medication in the catalog for the specified tenant.
 * Updates do NOT affect existing prescription item references.
 * Throws NotFoundError if the medication does not exist within the tenant.
 */
export async function update(
  tenantId: string,
  medicationId: string,
  data: UpdateMedicationInput
): Promise<MedicationResult> {
  const parsed = updateMedicationSchema.safeParse(data);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path.join('.') || '_form';
      fieldErrors[field] = issue.message;
    }
    throw new ValidationError('Invalid medication data', fieldErrors);
  }

  const validData = parsed.data;

  const updateValues: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (validData.name !== undefined) {
    updateValues.name = validData.name;
  }
  if (validData.dosageForm !== undefined) {
    updateValues.dosageForm = validData.dosageForm;
  }
  if (validData.defaultInstructions !== undefined) {
    updateValues.defaultInstructions = validData.defaultInstructions || null;
  }

  const [updated] = await db
    .update(medications)
    .set(updateValues)
    .where(
      and(
        eq(medications.id, medicationId),
        eq(medications.tenantId, tenantId)
      )
    )
    .returning({
      id: medications.id,
      tenantId: medications.tenantId,
      name: medications.name,
      dosageForm: medications.dosageForm,
      defaultInstructions: medications.defaultInstructions,
      isActive: medications.isActive,
      createdAt: medications.createdAt,
      updatedAt: medications.updatedAt,
    });

  if (!updated) {
    throw new NotFoundError('Medication');
  }

  return updated;
}

/**
 * Deactivates a medication by setting isActive=false.
 * Deactivated medications are excluded from listActive but preserved
 * in existing prescriptions (prescription_items still reference this medication).
 * Throws NotFoundError if the medication does not exist within the tenant.
 */
export async function deactivate(
  tenantId: string,
  medicationId: string
): Promise<void> {
  const [deactivated] = await db
    .update(medications)
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(medications.id, medicationId),
        eq(medications.tenantId, tenantId)
      )
    )
    .returning({ id: medications.id });

  if (!deactivated) {
    throw new NotFoundError('Medication');
  }
}

/**
 * Lists only active medications for the specified tenant.
 * Used for prescription selection — only active medications are available.
 */
export async function listActive(
  tenantId: string
): Promise<MedicationResult[]> {
  const results = await db
    .select({
      id: medications.id,
      tenantId: medications.tenantId,
      name: medications.name,
      dosageForm: medications.dosageForm,
      defaultInstructions: medications.defaultInstructions,
      isActive: medications.isActive,
      createdAt: medications.createdAt,
      updatedAt: medications.updatedAt,
    })
    .from(medications)
    .where(
      and(
        eq(medications.tenantId, tenantId),
        eq(medications.isActive, true)
      )
    );

  return results;
}

/**
 * Lists all medications (active and inactive) for the specified tenant.
 * Used for admin management of the medication catalog.
 */
export async function listAll(
  tenantId: string
): Promise<MedicationResult[]> {
  const results = await db
    .select({
      id: medications.id,
      tenantId: medications.tenantId,
      name: medications.name,
      dosageForm: medications.dosageForm,
      defaultInstructions: medications.defaultInstructions,
      isActive: medications.isActive,
      createdAt: medications.createdAt,
      updatedAt: medications.updatedAt,
    })
    .from(medications)
    .where(eq(medications.tenantId, tenantId));

  return results;
}

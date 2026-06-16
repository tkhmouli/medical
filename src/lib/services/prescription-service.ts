import { z } from 'zod';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { prescriptions, prescriptionItems, medications } from '@/lib/db/schema';
import { NotFoundError, ValidationError } from '@/lib/errors';

// ─── Validation Schemas ───────────────────────────────────────────────────────

export const prescriptionItemInputSchema = z.object({
  medicationId: z.string().uuid('Medication ID must be a valid UUID'),
  dosage: z.string().min(1, 'Dosage is required'),
  frequency: z.string().min(1, 'Frequency is required'),
  duration: z.string().min(1, 'Duration is required'),
  instructions: z.string().optional(),
});

export const createPrescriptionSchema = z.object({
  appointmentId: z.string().uuid('Appointment ID must be a valid UUID'),
  patientId: z.string().uuid('Patient ID must be a valid UUID'),
  items: z
    .array(prescriptionItemInputSchema)
    .min(1, 'At least one prescription item is required'),
  notes: z.string().optional(),
});

// ─── Types ────────────────────────────────────────────────────────────────────

export type PrescriptionItemInput = z.input<typeof prescriptionItemInputSchema>;
export type CreatePrescriptionInput = z.input<typeof createPrescriptionSchema>;

export interface PrescriptionResult {
  id: string;
  tenantId: string;
  appointmentId: string;
  patientId: string;
  doctorId: string;
  notes: string | null;
  createdAt: Date;
  items: PrescriptionItemResult[];
}

export interface PrescriptionItemResult {
  id: string;
  prescriptionId: string;
  medicationId: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string | null;
}

export interface PrescriptionWithItems {
  id: string;
  tenantId: string;
  appointmentId: string;
  patientId: string;
  doctorId: string;
  notes: string | null;
  createdAt: Date;
  items: PrescriptionItemWithMedication[];
}

export interface PrescriptionItemWithMedication {
  id: string;
  prescriptionId: string;
  medicationId: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string | null;
}

export interface PrescriptionSummary {
  id: string;
  appointmentId: string;
  doctorId: string;
  createdAt: Date;
  itemCount: number;
}

// ─── Service Functions ────────────────────────────────────────────────────────

/**
 * Creates a new prescription for a patient associated with an appointment.
 * Validates all medication IDs reference active medications in the tenant's catalog.
 * Restricted to Admin and Doctor roles (enforced at API layer).
 */
export async function create(
  tenantId: string,
  doctorId: string,
  data: CreatePrescriptionInput
): Promise<PrescriptionResult> {
  // Validate input
  const parsed = createPrescriptionSchema.safeParse(data);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path.join('.') || '_form';
      fieldErrors[field] = issue.message;
    }
    throw new ValidationError('Invalid prescription data', fieldErrors);
  }

  const validData = parsed.data;

  // Verify all medication IDs reference active medications in tenant's catalog
  const medicationIds = validData.items.map((item) => item.medicationId);
  const uniqueMedicationIds = Array.from(new Set(medicationIds));

  const activeMedications = await db
    .select({
      id: medications.id,
    })
    .from(medications)
    .where(
      and(
        eq(medications.tenantId, tenantId),
        eq(medications.isActive, true),
        inArray(medications.id, uniqueMedicationIds)
      )
    );

  const activeMedicationIds = new Set(activeMedications.map((m) => m.id));
  const invalidMedicationIds = uniqueMedicationIds.filter(
    (id) => !activeMedicationIds.has(id)
  );

  if (invalidMedicationIds.length > 0) {
    throw new ValidationError(
      'One or more medications are inactive or not found in the catalog',
      { medicationIds: invalidMedicationIds.join(', ') }
    );
  }

  // Insert the prescription
  const [createdPrescription] = await db
    .insert(prescriptions)
    .values({
      tenantId,
      appointmentId: validData.appointmentId,
      patientId: validData.patientId,
      doctorId,
      notes: validData.notes || null,
    })
    .returning({
      id: prescriptions.id,
      tenantId: prescriptions.tenantId,
      appointmentId: prescriptions.appointmentId,
      patientId: prescriptions.patientId,
      doctorId: prescriptions.doctorId,
      notes: prescriptions.notes,
      createdAt: prescriptions.createdAt,
    });

  // Insert all prescription items
  const itemValues = validData.items.map((item) => ({
    prescriptionId: createdPrescription.id,
    medicationId: item.medicationId,
    dosage: item.dosage,
    frequency: item.frequency,
    duration: item.duration,
    instructions: item.instructions || null,
  }));

  const createdItems = await db
    .insert(prescriptionItems)
    .values(itemValues)
    .returning({
      id: prescriptionItems.id,
      prescriptionId: prescriptionItems.prescriptionId,
      medicationId: prescriptionItems.medicationId,
      dosage: prescriptionItems.dosage,
      frequency: prescriptionItems.frequency,
      duration: prescriptionItems.duration,
      instructions: prescriptionItems.instructions,
    });

  return {
    ...createdPrescription,
    items: createdItems,
  };
}

/**
 * Retrieves a prescription by ID with its items and medication names.
 * Throws NotFoundError if the prescription does not exist within the tenant.
 */
export async function getById(
  tenantId: string,
  prescriptionId: string
): Promise<PrescriptionWithItems> {
  // Get the prescription
  const [prescription] = await db
    .select({
      id: prescriptions.id,
      tenantId: prescriptions.tenantId,
      appointmentId: prescriptions.appointmentId,
      patientId: prescriptions.patientId,
      doctorId: prescriptions.doctorId,
      notes: prescriptions.notes,
      createdAt: prescriptions.createdAt,
    })
    .from(prescriptions)
    .where(
      and(
        eq(prescriptions.id, prescriptionId),
        eq(prescriptions.tenantId, tenantId)
      )
    );

  if (!prescription) {
    throw new NotFoundError('Prescription');
  }

  // Get prescription items joined with medication names
  const items = await db
    .select({
      id: prescriptionItems.id,
      prescriptionId: prescriptionItems.prescriptionId,
      medicationId: prescriptionItems.medicationId,
      medicationName: medications.name,
      dosage: prescriptionItems.dosage,
      frequency: prescriptionItems.frequency,
      duration: prescriptionItems.duration,
      instructions: prescriptionItems.instructions,
    })
    .from(prescriptionItems)
    .innerJoin(medications, eq(prescriptionItems.medicationId, medications.id))
    .where(eq(prescriptionItems.prescriptionId, prescriptionId));

  return {
    ...prescription,
    items,
  };
}

/**
 * Lists all prescriptions for a patient in reverse chronological order (most recent first).
 * Returns summary information including item count.
 */
export async function getByPatient(
  tenantId: string,
  patientId: string
): Promise<PrescriptionSummary[]> {
  // Get all prescriptions for the patient, ordered by most recent first
  const patientPrescriptions = await db
    .select({
      id: prescriptions.id,
      appointmentId: prescriptions.appointmentId,
      doctorId: prescriptions.doctorId,
      createdAt: prescriptions.createdAt,
    })
    .from(prescriptions)
    .where(
      and(
        eq(prescriptions.tenantId, tenantId),
        eq(prescriptions.patientId, patientId)
      )
    )
    .orderBy(desc(prescriptions.createdAt));

  if (patientPrescriptions.length === 0) {
    return [];
  }

  // Get item counts for each prescription
  const prescriptionIds = patientPrescriptions.map((p) => p.id);
  const items = await db
    .select({
      prescriptionId: prescriptionItems.prescriptionId,
      id: prescriptionItems.id,
    })
    .from(prescriptionItems)
    .where(inArray(prescriptionItems.prescriptionId, prescriptionIds));

  // Count items per prescription
  const itemCountMap = new Map<string, number>();
  for (const item of items) {
    const current = itemCountMap.get(item.prescriptionId) || 0;
    itemCountMap.set(item.prescriptionId, current + 1);
  }

  return patientPrescriptions.map((p) => ({
    id: p.id,
    appointmentId: p.appointmentId,
    doctorId: p.doctorId,
    createdAt: p.createdAt,
    itemCount: itemCountMap.get(p.id) || 0,
  }));
}

/**
 * Generates a PDF for a prescription.
 * Fetches full prescription data including doctor/patient names,
 * generates a QR code linking to the prescription detail page,
 * and returns a Buffer with formatted prescription content.
 *
 * @param tenantId - The tenant context for data isolation
 * @param prescriptionId - The prescription to generate PDF for
 * @param baseUrl - The base URL for QR code link (defaults to env variable or localhost)
 * @returns Buffer containing the prescription PDF content
 */
export async function generatePdf(
  tenantId: string,
  prescriptionId: string,
  baseUrl?: string
): Promise<Buffer> {
  const { generatePrescriptionPdf } = await import('./pdf-generator');
  const url = baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return generatePrescriptionPdf(tenantId, prescriptionId, url);
}

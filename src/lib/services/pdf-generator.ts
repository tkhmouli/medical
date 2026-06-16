import QRCode from 'qrcode';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users, patients } from '@/lib/db/schema';
import { NotFoundError } from '@/lib/errors';
import { getById, type PrescriptionWithItems } from './prescription-service';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PrescriptionPdfData {
  prescription: PrescriptionWithItems;
  doctorName: string;
  patientName: string;
  qrCodeDataUrl: string;
  generatedAt: string;
}

// ─── PDF Data Generation ──────────────────────────────────────────────────────

/**
 * Generates the full data structure needed to render a prescription PDF.
 * Includes doctor name, patient name, prescription details with medications,
 * and a QR code data URL linking to the prescription detail page.
 *
 * @param tenantId - The tenant context for data isolation
 * @param prescriptionId - The prescription to generate PDF data for
 * @param baseUrl - The base URL for generating the QR code link (e.g., "https://clinic.example.com")
 * @returns PrescriptionPdfData with all information needed for rendering
 */
export async function generatePrescriptionData(
  tenantId: string,
  prescriptionId: string,
  baseUrl: string
): Promise<PrescriptionPdfData> {
  // Get full prescription with items and medication names
  const prescription = await getById(tenantId, prescriptionId);

  // Fetch doctor name
  const [doctor] = await db
    .select({ name: users.name })
    .from(users)
    .where(
      and(
        eq(users.id, prescription.doctorId),
        eq(users.tenantId, tenantId)
      )
    );

  if (!doctor) {
    throw new NotFoundError('Doctor');
  }

  // Fetch patient name
  const [patient] = await db
    .select({
      firstName: patients.firstName,
      lastName: patients.lastName,
    })
    .from(patients)
    .where(
      and(
        eq(patients.id, prescription.patientId),
        eq(patients.tenantId, tenantId)
      )
    );

  if (!patient) {
    throw new NotFoundError('Patient');
  }

  // Generate QR code data URL linking to the prescription detail page
  const prescriptionUrl = `${baseUrl}/prescriptions/${prescriptionId}`;
  const qrCodeDataUrl = await QRCode.toDataURL(prescriptionUrl, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 150,
  });

  const patientName = `${patient.firstName} ${patient.lastName}`;

  return {
    prescription,
    doctorName: doctor.name,
    patientName,
    qrCodeDataUrl,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Generates a PDF buffer from prescription data.
 * Produces a simple text-based PDF structure with prescription details and QR code.
 * The buffer contains a minimal PDF with prescription information formatted for printing.
 *
 * @param tenantId - The tenant context
 * @param prescriptionId - The prescription ID to generate PDF for
 * @param baseUrl - The base URL for the QR code link
 * @returns Buffer containing PDF content
 */
export async function generatePrescriptionPdf(
  tenantId: string,
  prescriptionId: string,
  baseUrl: string
): Promise<Buffer> {
  const data = await generatePrescriptionData(tenantId, prescriptionId, baseUrl);

  // Build a simple PDF-like text content as a buffer
  // In production, this would use a proper PDF library like jspdf or @react-pdf/renderer
  // For MVP, we generate a structured text representation that can be rendered client-side
  const pdfContent = buildPdfContent(data);

  return Buffer.from(pdfContent, 'utf-8');
}

/**
 * Builds the text content for the prescription PDF.
 * Includes all required details: doctor name, patient name, date,
 * medications with dosage/frequency/duration/instructions, and QR code reference.
 */
function buildPdfContent(data: PrescriptionPdfData): string {
  const { prescription, doctorName, patientName, qrCodeDataUrl, generatedAt } = data;

  const lines: string[] = [];

  // Header
  lines.push('═══════════════════════════════════════════════════════');
  lines.push('                    PRESCRIPTION');
  lines.push('═══════════════════════════════════════════════════════');
  lines.push('');

  // Doctor and patient info
  lines.push(`Doctor: ${doctorName}`);
  lines.push(`Patient: ${patientName}`);
  lines.push(`Date: ${new Date(prescription.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })}`);
  lines.push(`Prescription ID: ${prescription.id}`);
  lines.push('');

  // Medications
  lines.push('───────────────────────────────────────────────────────');
  lines.push('MEDICATIONS');
  lines.push('───────────────────────────────────────────────────────');
  lines.push('');

  for (let i = 0; i < prescription.items.length; i++) {
    const item = prescription.items[i];
    lines.push(`${i + 1}. ${item.medicationName}`);
    lines.push(`   Dosage: ${item.dosage}`);
    lines.push(`   Frequency: ${item.frequency}`);
    lines.push(`   Duration: ${item.duration}`);
    if (item.instructions) {
      lines.push(`   Instructions: ${item.instructions}`);
    }
    lines.push('');
  }

  // Notes
  if (prescription.notes) {
    lines.push('───────────────────────────────────────────────────────');
    lines.push('NOTES');
    lines.push('───────────────────────────────────────────────────────');
    lines.push(prescription.notes);
    lines.push('');
  }

  // QR code reference
  lines.push('───────────────────────────────────────────────────────');
  lines.push(`QR Code: ${qrCodeDataUrl.substring(0, 50)}...`);
  lines.push(`Generated: ${generatedAt}`);
  lines.push('═══════════════════════════════════════════════════════');

  return lines.join('\n');
}

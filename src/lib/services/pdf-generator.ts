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
 * Produces a proper PDF document with professional prescription layout.
 *
 * @param tenantId - The tenant context
 * @param prescriptionId - The prescription ID to generate PDF for
 * @param baseUrl - The base URL for the QR code link
 * @returns Buffer containing valid PDF content
 */
export async function generatePrescriptionPdf(
  tenantId: string,
  prescriptionId: string,
  baseUrl: string
): Promise<Buffer> {
  const data = await generatePrescriptionData(tenantId, prescriptionId, baseUrl);
  return buildPdfBuffer(data);
}

/**
 * Builds a valid PDF buffer with a professional prescription layout.
 * Uses raw PDF 1.4 syntax to create a proper document.
 */
function buildPdfBuffer(data: PrescriptionPdfData): Buffer {
  const { prescription, doctorName, patientName, generatedAt } = data;
  const date = new Date(prescription.createdAt).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Build structured content with font changes for a professional look
  const contentOps: string[] = [];

  // ─── Header: Clinic Name (bold/large) ───
  contentOps.push('BT');
  contentOps.push('/F2 18 Tf');
  contentOps.push('170 790 Td');
  contentOps.push(`(Cabinet Medical) Tj`);
  contentOps.push('ET');

  // Doctor name below header
  contentOps.push('BT');
  contentOps.push('/F1 12 Tf');
  contentOps.push('200 770 Td');
  contentOps.push(`(Dr. ${escapePdf(doctorName)}) Tj`);
  contentOps.push('ET');

  // Subtitle
  contentOps.push('BT');
  contentOps.push('/F1 9 Tf');
  contentOps.push('180 755 Td');
  contentOps.push(`(Medecin Specialiste en Urologie) Tj`);
  contentOps.push('ET');

  // Horizontal line
  contentOps.push('0.7 0.7 0.7 RG');
  contentOps.push('50 740 m 545 740 l S');
  contentOps.push('0 0 0 RG');

  // ─── ORDONNANCE title ───
  contentOps.push('BT');
  contentOps.push('/F2 16 Tf');
  contentOps.push('220 715 Td');
  contentOps.push('(ORDONNANCE) Tj');
  contentOps.push('ET');

  // ─── Patient & Date info ───
  let y = 685;

  contentOps.push('BT');
  contentOps.push('/F2 10 Tf');
  contentOps.push(`50 ${y} Td`);
  contentOps.push(`(Patient:) Tj`);
  contentOps.push('ET');
  contentOps.push('BT');
  contentOps.push('/F1 10 Tf');
  contentOps.push(`110 ${y} Td`);
  contentOps.push(`(${escapePdf(patientName)}) Tj`);
  contentOps.push('ET');

  y -= 18;
  contentOps.push('BT');
  contentOps.push('/F2 10 Tf');
  contentOps.push(`50 ${y} Td`);
  contentOps.push(`(Date:) Tj`);
  contentOps.push('ET');
  contentOps.push('BT');
  contentOps.push('/F1 10 Tf');
  contentOps.push(`110 ${y} Td`);
  contentOps.push(`(${escapePdf(date)}) Tj`);
  contentOps.push('ET');

  // Light line separator
  y -= 15;
  contentOps.push('0.85 0.85 0.85 RG');
  contentOps.push(`50 ${y} m 545 ${y} l S`);
  contentOps.push('0 0 0 RG');

  // ─── Medications ───
  y -= 25;
  contentOps.push('BT');
  contentOps.push('/F2 11 Tf');
  contentOps.push(`50 ${y} Td`);
  contentOps.push('(Traitement prescrit:) Tj');
  contentOps.push('ET');

  y -= 20;

  for (let i = 0; i < prescription.items.length; i++) {
    const item = prescription.items[i];

    // Medication name (bold)
    contentOps.push('BT');
    contentOps.push('/F2 10 Tf');
    contentOps.push(`70 ${y} Td`);
    contentOps.push(`(${i + 1}. ${escapePdf(item.medicationName)}) Tj`);
    contentOps.push('ET');

    y -= 16;

    // Dosage line
    contentOps.push('BT');
    contentOps.push('/F1 9 Tf');
    contentOps.push(`90 ${y} Td`);
    contentOps.push(`(Posologie: ${escapePdf(item.dosage)}  |  Frequence: ${escapePdf(item.frequency)}  |  Duree: ${escapePdf(item.duration)}) Tj`);
    contentOps.push('ET');

    y -= 14;

    if (item.instructions) {
      contentOps.push('BT');
      contentOps.push('/F1 9 Tf');
      contentOps.push(`90 ${y} Td`);
      contentOps.push(`(Instructions: ${escapePdf(item.instructions)}) Tj`);
      contentOps.push('ET');
      y -= 14;
    }

    y -= 10; // spacing between items
  }

  // ─── Notes section ───
  if (prescription.notes) {
    y -= 10;
    contentOps.push('0.85 0.85 0.85 RG');
    contentOps.push(`50 ${y} m 545 ${y} l S`);
    contentOps.push('0 0 0 RG');
    y -= 18;

    contentOps.push('BT');
    contentOps.push('/F2 10 Tf');
    contentOps.push(`50 ${y} Td`);
    contentOps.push('(Remarques:) Tj');
    contentOps.push('ET');
    y -= 16;

    contentOps.push('BT');
    contentOps.push('/F1 9 Tf');
    contentOps.push(`70 ${y} Td`);
    contentOps.push(`(${escapePdf(prescription.notes)}) Tj`);
    contentOps.push('ET');
    y -= 20;
  }

  // ─── Signature section ───
  y = Math.min(y - 30, 150);
  contentOps.push('0.85 0.85 0.85 RG');
  contentOps.push(`50 ${y + 10} m 545 ${y + 10} l S`);
  contentOps.push('0 0 0 RG');

  contentOps.push('BT');
  contentOps.push('/F1 9 Tf');
  contentOps.push(`380 ${y - 10} Td`);
  contentOps.push('(Signature et cachet du medecin:) Tj');
  contentOps.push('ET');

  contentOps.push('BT');
  contentOps.push('/F1 9 Tf');
  contentOps.push(`380 ${y - 50} Td`);
  contentOps.push(`(Dr. ${escapePdf(doctorName)}) Tj`);
  contentOps.push('ET');

  // ─── Footer ───
  contentOps.push('BT');
  contentOps.push('/F1 7 Tf');
  contentOps.push('0.5 0.5 0.5 rg');
  contentOps.push('50 30 Td');
  contentOps.push(`(Document genere le ${new Date().toLocaleDateString('fr-FR')} - Ref: ${prescription.id.substring(0, 8)}) Tj`);
  contentOps.push('0 0 0 rg');
  contentOps.push('ET');

  const streamContent = contentOps.join('\n');
  const streamLength = Buffer.byteLength(streamContent, 'latin1');

  const offsets: number[] = [];
  let output = '%PDF-1.4\n';

  // Object 1: Catalog
  offsets.push(Buffer.byteLength(output, 'latin1'));
  output += '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';

  // Object 2: Pages
  offsets.push(Buffer.byteLength(output, 'latin1'));
  output += '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n';

  // Object 3: Page
  offsets.push(Buffer.byteLength(output, 'latin1'));
  output += '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\nendobj\n';

  // Object 4: Content stream
  offsets.push(Buffer.byteLength(output, 'latin1'));
  output += `4 0 obj\n<< /Length ${streamLength} >>\nstream\n${streamContent}\nendstream\nendobj\n`;

  // Object 5: Regular font (Helvetica)
  offsets.push(Buffer.byteLength(output, 'latin1'));
  output += '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n';

  // Object 6: Bold font (Helvetica-Bold)
  offsets.push(Buffer.byteLength(output, 'latin1'));
  output += '6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n';

  // Cross-reference table
  const xrefOffset = Buffer.byteLength(output, 'latin1');
  output += 'xref\n';
  output += `0 ${offsets.length + 1}\n`;
  output += '0000000000 65535 f \n';
  for (const offset of offsets) {
    output += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }

  // Trailer
  output += 'trailer\n';
  output += `<< /Size ${offsets.length + 1} /Root 1 0 R >>\n`;
  output += 'startxref\n';
  output += `${xrefOffset}\n`;
  output += '%%EOF\n';

  return Buffer.from(output, 'latin1');
}

/**
 * Escapes special PDF string characters.
 */
function escapePdf(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { handleApiError } from '@/lib/api-response';

/**
 * POST /api/compte-rendu/pdf — Generate a Compte Rendu PDF
 * Accepts visit data and returns a PDF buffer.
 */
export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const body = await request.json();
    const { patientName, doctorName, date, compteRendu, visitNotes, prescriptionItems, vitals } = body;

    const pdfBuffer = buildCompteRenduPdf({
      patientName: patientName || 'Patient',
      doctorName: doctorName || 'Doctor',
      date: date || new Date().toISOString().split('T')[0],
      compteRendu: compteRendu || '',
      visitNotes: visitNotes || '',
      prescriptionItems: prescriptionItems || [],
      vitals: vitals || null,
    });

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="compte-rendu.pdf"`,
        'Content-Length': String(pdfBuffer.length),
      },
    });
  } catch (error) {
    const { body: errBody, status } = handleApiError(error);
    return NextResponse.json(errBody, { status });
  }
});

// ─── PDF Builder ────────────────────────────────────────────────────────────

interface CompteRenduData {
  patientName: string;
  doctorName: string;
  date: string;
  compteRendu: string;
  visitNotes: string;
  prescriptionItems: Array<{ medicationName: string; dosage: string; frequency: string; duration: string }>;
  vitals: { bloodPressure?: string; temperatureC?: string; weightKg?: number; heightCm?: number } | null;
}

function buildCompteRenduPdf(data: CompteRenduData): Buffer {
  const formattedDate = new Date(data.date + 'T00:00:00').toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const contentOps: string[] = [];

  // Header
  contentOps.push('BT');
  contentOps.push('/F2 18 Tf');
  contentOps.push('170 790 Td');
  contentOps.push('(Cabinet Medical) Tj');
  contentOps.push('ET');

  contentOps.push('BT');
  contentOps.push('/F1 12 Tf');
  contentOps.push('200 770 Td');
  contentOps.push(`(Dr. ${esc(data.doctorName)}) Tj`);
  contentOps.push('ET');

  contentOps.push('BT');
  contentOps.push('/F1 9 Tf');
  contentOps.push('180 755 Td');
  contentOps.push('(Medecin Specialiste en Urologie) Tj');
  contentOps.push('ET');

  // Line
  contentOps.push('0.7 0.7 0.7 RG');
  contentOps.push('50 740 m 545 740 l S');
  contentOps.push('0 0 0 RG');

  // Title
  contentOps.push('BT');
  contentOps.push('/F2 16 Tf');
  contentOps.push('200 715 Td');
  contentOps.push('(COMPTE RENDU) Tj');
  contentOps.push('ET');

  // Patient & date
  let y = 690;
  contentOps.push('BT');
  contentOps.push('/F2 10 Tf');
  contentOps.push(`50 ${y} Td`);
  contentOps.push('(Patient:) Tj');
  contentOps.push('ET');
  contentOps.push('BT');
  contentOps.push('/F1 10 Tf');
  contentOps.push(`110 ${y} Td`);
  contentOps.push(`(${esc(data.patientName)}) Tj`);
  contentOps.push('ET');

  y -= 16;
  contentOps.push('BT');
  contentOps.push('/F2 10 Tf');
  contentOps.push(`50 ${y} Td`);
  contentOps.push('(Date:) Tj');
  contentOps.push('ET');
  contentOps.push('BT');
  contentOps.push('/F1 10 Tf');
  contentOps.push(`110 ${y} Td`);
  contentOps.push(`(${esc(formattedDate)}) Tj`);
  contentOps.push('ET');

  // Vitals
  if (data.vitals) {
    y -= 20;
    contentOps.push('0.85 0.85 0.85 RG');
    contentOps.push(`50 ${y} m 545 ${y} l S`);
    contentOps.push('0 0 0 RG');
    y -= 16;
    contentOps.push('BT');
    contentOps.push('/F2 9 Tf');
    contentOps.push(`50 ${y} Td`);
    const vitalsLine = `Constantes: TA ${data.vitals.bloodPressure || '-'} | Temp ${data.vitals.temperatureC || '-'}C | Poids ${data.vitals.weightKg || '-'}kg | Taille ${data.vitals.heightCm || '-'}cm`;
    contentOps.push(`(${esc(vitalsLine)}) Tj`);
    contentOps.push('ET');
  }

  // Visit summary (compte rendu text)
  y -= 25;
  contentOps.push('0.85 0.85 0.85 RG');
  contentOps.push(`50 ${y} m 545 ${y} l S`);
  contentOps.push('0 0 0 RG');
  y -= 18;

  contentOps.push('BT');
  contentOps.push('/F2 10 Tf');
  contentOps.push(`50 ${y} Td`);
  contentOps.push('(Resume de la consultation:) Tj');
  contentOps.push('ET');
  y -= 16;

  // Split compte rendu into lines (max ~80 chars per line)
  const crLines = wrapText(data.compteRendu, 85);
  for (const line of crLines) {
    contentOps.push('BT');
    contentOps.push('/F1 9 Tf');
    contentOps.push(`60 ${y} Td`);
    contentOps.push(`(${esc(line)}) Tj`);
    contentOps.push('ET');
    y -= 13;
    if (y < 100) break; // Don't overflow page
  }

  // Prescription summary if any
  if (data.prescriptionItems.length > 0) {
    y -= 15;
    contentOps.push('0.85 0.85 0.85 RG');
    contentOps.push(`50 ${y} m 545 ${y} l S`);
    contentOps.push('0 0 0 RG');
    y -= 16;

    contentOps.push('BT');
    contentOps.push('/F2 10 Tf');
    contentOps.push(`50 ${y} Td`);
    contentOps.push('(Traitement prescrit:) Tj');
    contentOps.push('ET');
    y -= 14;

    for (const item of data.prescriptionItems) {
      contentOps.push('BT');
      contentOps.push('/F1 9 Tf');
      contentOps.push(`70 ${y} Td`);
      contentOps.push(`(- ${esc(item.medicationName)}: ${esc(item.dosage)}, ${esc(item.frequency)}, ${esc(item.duration)}) Tj`);
      contentOps.push('ET');
      y -= 13;
      if (y < 100) break;
    }
  }

  // Signature
  y = Math.min(y - 30, 120);
  contentOps.push('0.85 0.85 0.85 RG');
  contentOps.push(`50 ${y + 10} m 545 ${y + 10} l S`);
  contentOps.push('0 0 0 RG');

  contentOps.push('BT');
  contentOps.push('/F1 9 Tf');
  contentOps.push(`380 ${y - 10} Td`);
  contentOps.push('(Signature et cachet:) Tj');
  contentOps.push('ET');

  contentOps.push('BT');
  contentOps.push('/F1 9 Tf');
  contentOps.push(`380 ${y - 40} Td`);
  contentOps.push(`(Dr. ${esc(data.doctorName)}) Tj`);
  contentOps.push('ET');

  // Footer
  contentOps.push('BT');
  contentOps.push('/F1 7 Tf');
  contentOps.push('0.5 0.5 0.5 rg');
  contentOps.push('50 30 Td');
  contentOps.push(`(Document genere le ${new Date().toLocaleDateString('fr-FR')}) Tj`);
  contentOps.push('0 0 0 rg');
  contentOps.push('ET');

  // Build PDF structure
  const streamContent = contentOps.join('\n');
  const streamLength = Buffer.byteLength(streamContent, 'latin1');
  const offsets: number[] = [];
  let output = '%PDF-1.4\n';

  offsets.push(Buffer.byteLength(output, 'latin1'));
  output += '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';

  offsets.push(Buffer.byteLength(output, 'latin1'));
  output += '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n';

  offsets.push(Buffer.byteLength(output, 'latin1'));
  output += '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\nendobj\n';

  offsets.push(Buffer.byteLength(output, 'latin1'));
  output += `4 0 obj\n<< /Length ${streamLength} >>\nstream\n${streamContent}\nendstream\nendobj\n`;

  offsets.push(Buffer.byteLength(output, 'latin1'));
  output += '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n';

  offsets.push(Buffer.byteLength(output, 'latin1'));
  output += '6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n';

  const xrefOffset = Buffer.byteLength(output, 'latin1');
  output += 'xref\n';
  output += `0 ${offsets.length + 1}\n`;
  output += '0000000000 65535 f \n';
  for (const offset of offsets) {
    output += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }

  output += 'trailer\n';
  output += `<< /Size ${offsets.length + 1} /Root 1 0 R >>\n`;
  output += 'startxref\n';
  output += `${xrefOffset}\n`;
  output += '%%EOF\n';

  return Buffer.from(output, 'latin1');
}

function esc(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function wrapText(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  const paragraphs = text.split('\n');
  for (const para of paragraphs) {
    if (para.length <= maxChars) {
      lines.push(para);
    } else {
      const words = para.split(' ');
      let current = '';
      for (const word of words) {
        if ((current + ' ' + word).trim().length > maxChars) {
          lines.push(current.trim());
          current = word;
        } else {
          current += ' ' + word;
        }
      }
      if (current.trim()) lines.push(current.trim());
    }
  }
  return lines;
}

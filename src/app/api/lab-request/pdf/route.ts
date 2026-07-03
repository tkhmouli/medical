import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { handleApiError } from '@/lib/api-response';

/**
 * POST /api/lab-request/pdf — Generate a Lab Request PDF
 */
export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const body = await request.json();
    const { patientName, doctorName, date, tests } = body;

    const pdfBuffer = buildLabRequestPdf({
      patientName: patientName || 'Patient',
      doctorName: doctorName || 'Doctor',
      date: date || new Date().toISOString().split('T')[0],
      tests: tests || [],
    });

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="lab-request.pdf"',
        'Content-Length': String(pdfBuffer.length),
      },
    });
  } catch (error) {
    const { body: errBody, status } = handleApiError(error);
    return NextResponse.json(errBody, { status });
  }
});

function buildLabRequestPdf(data: { patientName: string; doctorName: string; date: string; tests: string[] }): Buffer {
  const formattedDate = new Date(data.date + 'T00:00:00').toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
  const ops: string[] = [];

  // Header
  ops.push('BT /F2 18 Tf 170 790 Td (Cabinet Medical) Tj ET');
  ops.push(`BT /F1 12 Tf 200 770 Td (Dr. ${esc(data.doctorName)}) Tj ET`);
  ops.push('BT /F1 9 Tf 180 755 Td (Medecin Specialiste en Urologie) Tj ET');
  ops.push('0.7 0.7 0.7 RG 50 740 m 545 740 l S 0 0 0 RG');

  // Title
  ops.push('BT /F2 16 Tf 180 710 Td (DEMANDE D\'EXAMENS) Tj ET');

  // Patient & date
  ops.push(`BT /F2 10 Tf 50 680 Td (Patient:) Tj ET`);
  ops.push(`BT /F1 10 Tf 110 680 Td (${esc(data.patientName)}) Tj ET`);
  ops.push(`BT /F2 10 Tf 50 664 Td (Date:) Tj ET`);
  ops.push(`BT /F1 10 Tf 110 664 Td (${esc(formattedDate)}) Tj ET`);

  // Separator
  ops.push('0.85 0.85 0.85 RG 50 650 m 545 650 l S 0 0 0 RG');

  // Tests header
  ops.push('BT /F2 11 Tf 50 630 Td (Examens demandes:) Tj ET');

  // Test list
  let y = 608;
  for (let i = 0; i < data.tests.length; i++) {
    // Checkbox
    ops.push(`0.3 0.3 0.3 RG 60 ${y - 2} 8 8 re S 0 0 0 RG`);
    ops.push(`BT /F1 10 Tf 76 ${y} Td (${esc(data.tests[i])}) Tj ET`);
    y -= 22;
    if (y < 120) break;
  }

  // Signature area
  y = Math.min(y - 40, 150);
  ops.push(`0.85 0.85 0.85 RG 50 ${y + 10} m 545 ${y + 10} l S 0 0 0 RG`);
  ops.push(`BT /F1 9 Tf 380 ${y - 10} Td (Signature et cachet:) Tj ET`);
  ops.push(`BT /F1 9 Tf 380 ${y - 40} Td (Dr. ${esc(data.doctorName)}) Tj ET`);

  // Footer
  ops.push(`BT /F1 7 Tf 0.5 0.5 0.5 rg 50 30 Td (Document genere le ${new Date().toLocaleDateString('fr-FR')}) Tj 0 0 0 rg ET`);

  const streamContent = ops.join('\n');
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
  for (const offset of offsets) output += `${String(offset).padStart(10, '0')} 00000 n \n`;
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

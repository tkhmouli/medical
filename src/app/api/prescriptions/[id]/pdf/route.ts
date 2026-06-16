import { NextResponse } from 'next/server';
import { withAuthAndPermission, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { handleApiError } from '@/lib/api-response';
import * as PrescriptionService from '@/lib/services/prescription-service';
import { ValidationError } from '@/lib/errors';

/**
 * GET /api/prescriptions/[id]/pdf — Generate and return a PDF for a prescription
 * Returns the PDF as application/pdf binary content.
 * Accessible to: Admin, Doctor only (Medical_Assistant blocked via 'prescriptions' permission)
 */
export const GET = withAuthAndPermission(
  'prescriptions',
  async (request: AuthenticatedRequest, context?: { params: Record<string, string> }) => {
    try {
      const prescriptionId = context?.params?.id;
      if (!prescriptionId) {
        throw new ValidationError('Prescription ID is required');
      }

      const pdfBuffer = await PrescriptionService.generatePdf(
        request.user.tenantId,
        prescriptionId
      );

      return new NextResponse(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="prescription-${prescriptionId}.pdf"`,
          'Content-Length': String(pdfBuffer.length),
        },
      });
    } catch (error) {
      const { body, status } = handleApiError(error);
      return NextResponse.json(body, { status });
    }
  }
);

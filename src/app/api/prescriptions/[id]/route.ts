import { NextResponse } from 'next/server';
import { withAuthAndPermission, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { successResponse, handleApiError } from '@/lib/api-response';
import * as PrescriptionService from '@/lib/services/prescription-service';
import { ValidationError } from '@/lib/errors';

/**
 * GET /api/prescriptions/[id] — Get prescription detail with items and medication names
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

      const prescription = await PrescriptionService.getById(
        request.user.tenantId,
        prescriptionId
      );
      return NextResponse.json(successResponse(prescription));
    } catch (error) {
      const { body, status } = handleApiError(error);
      return NextResponse.json(body, { status });
    }
  }
);

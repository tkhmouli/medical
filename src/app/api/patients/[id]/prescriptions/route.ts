import { NextResponse } from 'next/server';
import { withAuthAndPermission, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { successResponse, handleApiError } from '@/lib/api-response';
import * as PrescriptionService from '@/lib/services/prescription-service';
import { ValidationError } from '@/lib/errors';

/**
 * GET /api/patients/[id]/prescriptions — List all prescriptions for a patient
 * Returns prescriptions in reverse chronological order.
 * Accessible to: Admin, Doctor only (Medical_Assistant blocked via 'prescriptions' permission)
 */
export const GET = withAuthAndPermission(
  'prescriptions',
  async (request: AuthenticatedRequest, context?: { params: Record<string, string> }) => {
    try {
      const patientId = context?.params?.id;
      if (!patientId) {
        throw new ValidationError('Patient ID is required');
      }

      const prescriptions = await PrescriptionService.getByPatient(
        request.user.tenantId,
        patientId
      );
      return NextResponse.json(successResponse(prescriptions));
    } catch (error) {
      const { body, status } = handleApiError(error);
      return NextResponse.json(body, { status });
    }
  }
);

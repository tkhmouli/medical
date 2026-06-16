import { NextResponse } from 'next/server';
import { withAuthAndPermission, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { successResponse, handleApiError } from '@/lib/api-response';
import * as PatientService from '@/lib/services/patient-service';
import { ValidationError } from '@/lib/errors';

/**
 * GET /api/patients/[id]/visits — Get visit history for a patient
 * Returns VisitHistoryResult with visits, totalCount, classification, lastVisitDate
 * Accessible to: Admin, Doctor, Medical_Assistant
 */
export const GET = withAuthAndPermission(
  'patient_management',
  async (request: AuthenticatedRequest, context?: { params: Record<string, string> }) => {
    try {
      const patientId = context?.params?.id;
      if (!patientId) {
        throw new ValidationError('Patient ID is required');
      }

      const visitHistory = await PatientService.getVisitHistory(
        request.user.tenantId,
        patientId
      );
      return NextResponse.json(successResponse(visitHistory));
    } catch (error) {
      const { body, status } = handleApiError(error);
      return NextResponse.json(body, { status });
    }
  }
);

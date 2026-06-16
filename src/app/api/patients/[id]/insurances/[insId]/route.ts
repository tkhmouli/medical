import { NextResponse } from 'next/server';
import { withAuthAndPermission, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { successResponse, handleApiError } from '@/lib/api-response';
import * as InsuranceService from '@/lib/services/insurance-service';
import { ValidationError } from '@/lib/errors';

/**
 * DELETE /api/patients/[id]/insurances/[insId] — Remove an insurance record
 * Accessible to: Admin, Doctor, Medical_Assistant
 */
export const DELETE = withAuthAndPermission(
  'patient_management',
  async (request: AuthenticatedRequest, context?: { params: Record<string, string> }) => {
    try {
      const insId = context?.params?.insId;
      if (!insId) {
        throw new ValidationError('Insurance ID is required');
      }

      await InsuranceService.removeInsurance(request.user.tenantId, insId);
      return NextResponse.json(successResponse(null));
    } catch (error) {
      const { body, status } = handleApiError(error);
      return NextResponse.json(body, { status });
    }
  }
);

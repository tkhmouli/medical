import { NextResponse } from 'next/server';
import { withAuthAndPermission, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { successResponse, handleApiError } from '@/lib/api-response';
import * as InsuranceService from '@/lib/services/insurance-service';
import { ValidationError } from '@/lib/errors';

/**
 * GET /api/patients/[id]/insurances — List all insurance records for a patient
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

      const insurances = await InsuranceService.listByPatient(
        request.user.tenantId,
        patientId
      );
      return NextResponse.json(successResponse(insurances));
    } catch (error) {
      const { body, status } = handleApiError(error);
      return NextResponse.json(body, { status });
    }
  }
);

/**
 * POST /api/patients/[id]/insurances — Add an insurance record to a patient
 * Accessible to: Admin, Doctor, Medical_Assistant
 */
export const POST = withAuthAndPermission(
  'patient_management',
  async (request: AuthenticatedRequest, context?: { params: Record<string, string> }) => {
    try {
      const patientId = context?.params?.id;
      if (!patientId) {
        throw new ValidationError('Patient ID is required');
      }

      const body = await request.json();
      const insurance = await InsuranceService.addInsurance(
        request.user.tenantId,
        patientId,
        body
      );
      return NextResponse.json(successResponse(insurance), { status: 201 });
    } catch (error) {
      const { body, status } = handleApiError(error);
      return NextResponse.json(body, { status });
    }
  }
);

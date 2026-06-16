import { NextResponse } from 'next/server';
import { withAuthAndPermission, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { successResponse, handleApiError } from '@/lib/api-response';
import * as PatientService from '@/lib/services/patient-service';
import { AuthorizationError, ValidationError } from '@/lib/errors';

/**
 * GET /api/patients/[id] — Get a single patient by ID
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

      const patient = await PatientService.getById(request.user.tenantId, patientId);
      return NextResponse.json(successResponse(patient));
    } catch (error) {
      const { body, status } = handleApiError(error);
      return NextResponse.json(body, { status });
    }
  }
);

/**
 * PATCH /api/patients/[id] — Update a patient within the tenant
 * Accessible to: Admin, Doctor, Medical_Assistant
 */
export const PATCH = withAuthAndPermission(
  'patient_management',
  async (request: AuthenticatedRequest, context?: { params: Record<string, string> }) => {
    try {
      const patientId = context?.params?.id;
      if (!patientId) {
        throw new ValidationError('Patient ID is required');
      }

      const body = await request.json();
      const patient = await PatientService.update(request.user.tenantId, patientId, body);
      return NextResponse.json(successResponse(patient));
    } catch (error) {
      const { body, status } = handleApiError(error);
      return NextResponse.json(body, { status });
    }
  }
);

/**
 * DELETE /api/patients/[id] — Delete a patient (Admin only)
 * Accessible to: Admin only (additional role check beyond permission gate)
 */
export const DELETE = withAuthAndPermission(
  'patient_management',
  async (request: AuthenticatedRequest, context?: { params: Record<string, string> }) => {
    try {
      const patientId = context?.params?.id;
      if (!patientId) {
        throw new ValidationError('Patient ID is required');
      }

      // DELETE is restricted to Admin role only
      if (request.user.role !== 'Admin') {
        throw new AuthorizationError('Only administrators can delete patients');
      }

      await PatientService.deletePatient(request.user.tenantId, patientId);
      return NextResponse.json(successResponse(null));
    } catch (error) {
      const { body, status } = handleApiError(error);
      return NextResponse.json(body, { status });
    }
  }
);

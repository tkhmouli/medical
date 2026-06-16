import { NextResponse } from 'next/server';
import { withAuthAndPermission, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { successResponse, handleApiError } from '@/lib/api-response';
import * as MedicationService from '@/lib/services/medication-service';
import { ValidationError } from '@/lib/errors';

/**
 * PATCH /api/medications/[id] — Update a medication in the catalog
 * Accessible to: Admin only
 */
export const PATCH = withAuthAndPermission(
  'medications',
  async (request: AuthenticatedRequest, context?: { params: Record<string, string> }) => {
    try {
      const medicationId = context?.params?.id;
      if (!medicationId) {
        throw new ValidationError('Medication ID is required');
      }

      const body = await request.json();
      const medication = await MedicationService.update(
        request.user.tenantId,
        medicationId,
        body
      );
      return NextResponse.json(successResponse(medication));
    } catch (error) {
      const { body, status } = handleApiError(error);
      return NextResponse.json(body, { status });
    }
  }
);

/**
 * DELETE /api/medications/[id] — Deactivate a medication (soft delete)
 * Accessible to: Admin only
 */
export const DELETE = withAuthAndPermission(
  'medications',
  async (request: AuthenticatedRequest, context?: { params: Record<string, string> }) => {
    try {
      const medicationId = context?.params?.id;
      if (!medicationId) {
        throw new ValidationError('Medication ID is required');
      }

      await MedicationService.deactivate(request.user.tenantId, medicationId);
      return NextResponse.json(successResponse(null));
    } catch (error) {
      const { body, status } = handleApiError(error);
      return NextResponse.json(body, { status });
    }
  }
);

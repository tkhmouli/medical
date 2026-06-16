import { NextResponse } from 'next/server';
import { withAuthAndPermission, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { successResponse, handleApiError } from '@/lib/api-response';
import * as PrescriptionService from '@/lib/services/prescription-service';

/**
 * POST /api/prescriptions — Create a new prescription
 * Accessible to: Admin, Doctor only (Medical_Assistant blocked via 'prescriptions' permission)
 */
export const POST = withAuthAndPermission(
  'prescriptions',
  async (request: AuthenticatedRequest) => {
    try {
      const body = await request.json();
      const prescription = await PrescriptionService.create(
        request.user.tenantId,
        request.user.userId,
        body
      );
      return NextResponse.json(successResponse(prescription), { status: 201 });
    } catch (error) {
      const { body, status } = handleApiError(error);
      return NextResponse.json(body, { status });
    }
  }
);

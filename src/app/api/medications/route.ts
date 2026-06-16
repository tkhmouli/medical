import { NextResponse } from 'next/server';
import { withAuth, withAuthAndPermission, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { successResponse, handleApiError } from '@/lib/api-response';
import * as MedicationService from '@/lib/services/medication-service';

/**
 * GET /api/medications — List medications for the tenant
 * Accessible to: Admin, Doctor, Medical_Assistant (authenticated users)
 *
 * - Admin role: returns all medications (active + inactive) for catalog management
 * - Other roles: returns active-only medications for prescription selection
 */
export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const medications = request.user.role === 'Admin'
      ? await MedicationService.listAll(request.user.tenantId)
      : await MedicationService.listActive(request.user.tenantId);

    return NextResponse.json(successResponse(medications));
  } catch (error) {
    const { body, status } = handleApiError(error);
    return NextResponse.json(body, { status });
  }
});

/**
 * POST /api/medications — Create a new medication in the catalog
 * Accessible to: Admin only
 */
export const POST = withAuthAndPermission('medications', async (request: AuthenticatedRequest) => {
  try {
    const body = await request.json();
    const medication = await MedicationService.create(request.user.tenantId, body);
    return NextResponse.json(successResponse(medication), { status: 201 });
  } catch (error) {
    const { body, status } = handleApiError(error);
    return NextResponse.json(body, { status });
  }
});

import { NextResponse } from 'next/server';
import { withAuthAndPermission, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { successResponse, handleApiError } from '@/lib/api-response';
import * as UserService from '@/lib/services/user-service';

/**
 * GET /api/doctors — List active doctors for the current tenant
 * Accessible to: Admin, Doctor, Medical_Assistant (via 'appointments' permission)
 *
 * Returns an array of { id, name } sorted alphabetically by name.
 */
export const GET = withAuthAndPermission('appointments', async (request: AuthenticatedRequest) => {
  try {
    const doctors = await UserService.listDoctors(request.user.tenantId);
    return NextResponse.json(successResponse(doctors));
  } catch (error) {
    const { body, status } = handleApiError(error);
    return NextResponse.json(body, { status });
  }
});

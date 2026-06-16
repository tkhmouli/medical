import { NextResponse } from 'next/server';
import { withAuthAndPermission, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { successResponse, handleApiError } from '@/lib/api-response';
import * as AppointmentService from '@/lib/services/appointment-service';
import { ValidationError } from '@/lib/errors';

/**
 * GET /api/appointments/calendar — Get appointments by date range for calendar view
 * Accessible to: Admin, Doctor, Medical_Assistant
 *
 * Query params:
 * - startDate (required): ISO date string (YYYY-MM-DD)
 * - endDate (required): ISO date string (YYYY-MM-DD)
 */
export const GET = withAuthAndPermission('appointments', async (request: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!startDate || !endDate) {
      throw new ValidationError('startDate and endDate are required');
    }

    const appointments = await AppointmentService.getByDateRange(
      request.user.tenantId,
      startDate,
      endDate
    );
    return NextResponse.json(successResponse(appointments));
  } catch (error) {
    const { body, status } = handleApiError(error);
    return NextResponse.json(body, { status });
  }
});

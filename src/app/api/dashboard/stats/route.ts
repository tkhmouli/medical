import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { successResponse, handleApiError } from '@/lib/api-response';
import { getDashboardStats, getScheduleForDate } from '@/lib/services/dashboard-service';

/**
 * GET /api/dashboard/stats — Dashboard statistics
 * Accessible to: Doctor, Medical_Assistant
 *
 * For Doctors: returns their own appointments.
 * For Medical_Assistants: returns all appointments for the clinic.
 *
 * Optional query params:
 * - date (YYYY-MM-DD): If provided, returns schedule for the specified date only.
 */
export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { userId, tenantId, role } = request.user;
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');

    // Doctors see their own appointments; assistants see all
    const doctorId = role === 'Doctor' ? userId : null;

    // If a specific date is requested, return schedule for that date only
    if (dateParam) {
      const schedule = await getScheduleForDate(tenantId, doctorId, dateParam);
      return NextResponse.json(successResponse(schedule));
    }

    // Default: return today's and tomorrow's stats
    const today = new Date().toISOString().split('T')[0];
    const stats = await getDashboardStats(tenantId, doctorId, today);

    return NextResponse.json(successResponse(stats));
  } catch (error) {
    const { body, status } = handleApiError(error);
    return NextResponse.json(body, { status });
  }
});

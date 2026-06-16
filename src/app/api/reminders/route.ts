import { NextResponse } from 'next/server';
import { withAuthAndPermission, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { successResponse, handleApiError } from '@/lib/api-response';
import * as ReminderService from '@/lib/services/reminder-service';

/**
 * GET /api/reminders — List all reminders for the tenant
 * Accessible to: Admin, Doctor, Medical_Assistant
 *
 * Returns reminders with patient name, status, target date, and type.
 */
export const GET = withAuthAndPermission('reminders', async (request: AuthenticatedRequest) => {
  try {
    const reminders = await ReminderService.list(request.user.tenantId);
    return NextResponse.json(successResponse(reminders));
  } catch (error) {
    const { body, status } = handleApiError(error);
    return NextResponse.json(body, { status });
  }
});

/**
 * POST /api/reminders — Create a new reminder
 * Accessible to: Admin, Doctor, Medical_Assistant
 *
 * Body: { patientId, intervalDays, reminderType, customMessage? }
 */
export const POST = withAuthAndPermission('reminders', async (request: AuthenticatedRequest) => {
  try {
    const body = await request.json();
    const reminder = await ReminderService.create(request.user.tenantId, body);
    return NextResponse.json(successResponse(reminder), { status: 201 });
  } catch (error) {
    const { body, status } = handleApiError(error);
    return NextResponse.json(body, { status });
  }
});

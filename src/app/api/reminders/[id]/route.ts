import { NextResponse } from 'next/server';
import { withAuthAndPermission, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { successResponse, handleApiError } from '@/lib/api-response';
import * as ReminderService from '@/lib/services/reminder-service';
import { ValidationError } from '@/lib/errors';

/**
 * PATCH /api/reminders/[id] — Dismiss a reminder
 * Accessible to: Admin, Doctor, Medical_Assistant
 *
 * Sets the reminder status to 'dismissed'. This action is irreversible.
 */
export const PATCH = withAuthAndPermission(
  'reminders',
  async (request: AuthenticatedRequest, context?: { params: Record<string, string> }) => {
    try {
      const reminderId = context?.params?.id;
      if (!reminderId) {
        throw new ValidationError('Reminder ID is required');
      }

      await ReminderService.dismiss(request.user.tenantId, reminderId);
      return NextResponse.json(successResponse(null));
    } catch (error) {
      const { body, status } = handleApiError(error);
      return NextResponse.json(body, { status });
    }
  }
);

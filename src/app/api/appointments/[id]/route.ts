import { NextResponse } from 'next/server';
import { withAuthAndPermission, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { successResponse, handleApiError } from '@/lib/api-response';
import * as AppointmentService from '@/lib/services/appointment-service';
import { ValidationError } from '@/lib/errors';

/**
 * PATCH /api/appointments/[id] — Update an appointment
 * Accessible to: Admin, Doctor, Medical_Assistant
 *
 * Returns the updated appointment.
 * Includes conflictWarning in response if a scheduling overlap is detected.
 */
export const PATCH = withAuthAndPermission(
  'appointments',
  async (request: AuthenticatedRequest, context?: { params: Record<string, string> }) => {
    try {
      const appointmentId = context?.params?.id;
      if (!appointmentId) {
        throw new ValidationError('Appointment ID is required');
      }

      const body = await request.json();
      const result = await AppointmentService.update(
        request.user.tenantId,
        appointmentId,
        body
      );
      return NextResponse.json(successResponse(result));
    } catch (error) {
      const { body, status } = handleApiError(error);
      return NextResponse.json(body, { status });
    }
  }
);

/**
 * DELETE /api/appointments/[id] — Cancel an appointment
 * Accessible to: Admin, Doctor, Medical_Assistant
 *
 * Sets the appointment as cancelled (soft delete).
 */
export const DELETE = withAuthAndPermission(
  'appointments',
  async (request: AuthenticatedRequest, context?: { params: Record<string, string> }) => {
    try {
      const appointmentId = context?.params?.id;
      if (!appointmentId) {
        throw new ValidationError('Appointment ID is required');
      }

      await AppointmentService.cancel(request.user.tenantId, appointmentId);
      return NextResponse.json(successResponse(null));
    } catch (error) {
      const { body, status } = handleApiError(error);
      return NextResponse.json(body, { status });
    }
  }
);

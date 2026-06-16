import { NextResponse } from 'next/server';
import { withAuthAndPermission, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { successResponse, handleApiError } from '@/lib/api-response';
import * as AppointmentService from '@/lib/services/appointment-service';
import { ValidationError } from '@/lib/errors';

/**
 * GET /api/appointments — List appointments
 * Accessible to: Admin, Doctor, Medical_Assistant
 *
 * Query params:
 * - date (required when patientId is not provided): ISO date string (YYYY-MM-DD)
 * - patientId (optional): Filter results to a specific patient
 * - excludeCancelled (optional): When "true", exclude cancelled appointments
 */
export const GET = withAuthAndPermission('appointments', async (request: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const patientId = searchParams.get('patientId');
    const excludeCancelled = searchParams.get('excludeCancelled') === 'true';

    // When patientId is provided with excludeCancelled, use getByPatient
    // (returns non-cancelled appointments for the patient, sorted by date DESC)
    if (patientId && excludeCancelled) {
      const appointments = await AppointmentService.getByPatient(request.user.tenantId, patientId);
      return NextResponse.json(successResponse(appointments));
    }

    // When only patientId is provided (without excludeCancelled), also use getByPatient
    // since the primary use case is the appointment selector which needs patient-scoped results
    if (patientId) {
      const appointments = await AppointmentService.getByPatient(request.user.tenantId, patientId);
      return NextResponse.json(successResponse(appointments));
    }

    // Default behavior: require date param for listing all appointments on a given day
    if (!date) {
      throw new ValidationError('date is required');
    }

    const appointments = await AppointmentService.getByDate(request.user.tenantId, date);
    return NextResponse.json(successResponse(appointments));
  } catch (error) {
    const { body, status } = handleApiError(error);
    return NextResponse.json(body, { status });
  }
});

/**
 * POST /api/appointments — Create a new appointment
 * Accessible to: Admin, Doctor, Medical_Assistant
 *
 * Returns 201 with the created appointment.
 * Includes conflictWarning in response if a scheduling overlap is detected.
 */
export const POST = withAuthAndPermission('appointments', async (request: AuthenticatedRequest) => {
  try {
    const body = await request.json();
    const result = await AppointmentService.create(request.user.tenantId, body);
    return NextResponse.json(successResponse(result), { status: 201 });
  } catch (error) {
    const { body, status } = handleApiError(error);
    return NextResponse.json(body, { status });
  }
});

import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { successResponse, handleApiError } from '@/lib/api-response';
import { db } from '@/lib/db';
import { appointments } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { NotFoundError } from '@/lib/errors';

/**
 * PATCH /api/appointments/[id]/vitals — Update vital signs for an appointment
 * Accessible to: Any authenticated user (Doctor, Medical_Assistant, Admin)
 *
 * Request body (all optional):
 * - bloodPressure: string (e.g. "120/80")
 * - temperatureC: string (e.g. "37.2")
 * - weightKg: number
 * - heightCm: number
 */
export const PATCH = withAuth(
  async (request: AuthenticatedRequest, context?: { params: Record<string, string> }) => {
    try {
      const appointmentId = context?.params?.id;
      if (!appointmentId) {
        return NextResponse.json({ success: false, error: { message: 'Appointment ID required' } }, { status: 400 });
      }

      const body = await request.json();
      const updateData: Record<string, any> = { updatedAt: new Date() };

      if (body.bloodPressure !== undefined) updateData.bloodPressure = body.bloodPressure;
      if (body.temperatureC !== undefined) updateData.temperatureC = body.temperatureC;
      if (body.weightKg !== undefined) updateData.weightKg = body.weightKg;
      if (body.heightCm !== undefined) updateData.heightCm = body.heightCm;

      const [updated] = await db
        .update(appointments)
        .set(updateData)
        .where(
          and(
            eq(appointments.id, appointmentId),
            eq(appointments.tenantId, request.user.tenantId)
          )
        )
        .returning({ id: appointments.id });

      if (!updated) {
        throw new NotFoundError('Appointment');
      }

      return NextResponse.json(successResponse({ id: appointmentId, ...updateData }));
    } catch (error) {
      const { body: errBody, status } = handleApiError(error);
      return NextResponse.json(errBody, { status });
    }
  }
);

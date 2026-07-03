import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { successResponse, handleApiError } from '@/lib/api-response';
import { updateAppointmentStatus, updateStatusSchema } from '@/lib/services/dashboard-service';
import { ValidationError } from '@/lib/errors';

/**
 * PATCH /api/appointments/[id]/status — Update an appointment's status
 * Accessible to: Any authenticated user (Doctor, Medical_Assistant, Admin)
 *
 * Request body: { status: "scheduled" | "waiting" | "in_progress" | "completed" }
 * Returns: { success: true, data: { id, status } }
 */
export const PATCH = withAuth(
  async (request: AuthenticatedRequest, context?: { params: Record<string, string> }) => {
    try {
      const appointmentId = context?.params?.id;
      if (!appointmentId) {
        throw new ValidationError('Appointment ID is required');
      }

      const body = await request.json();
      const parsed = updateStatusSchema.safeParse(body);

      if (!parsed.success) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
          const field = issue.path.join('.') || 'status';
          fieldErrors[field] = issue.message;
        }
        throw new ValidationError('Invalid appointment status', fieldErrors);
      }

      await updateAppointmentStatus(
        request.user.tenantId,
        appointmentId,
        parsed.data.status
      );

      return NextResponse.json(
        successResponse({ id: appointmentId, status: parsed.data.status })
      );
    } catch (error) {
      const { body, status } = handleApiError(error);
      return NextResponse.json(body, { status });
    }
  }
);

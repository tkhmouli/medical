import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthAndPermission, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { successResponse, handleApiError } from '@/lib/api-response';
import * as UserService from '@/lib/services/user-service';
import { ValidationError } from '@/lib/errors';

const updateUserSchema = z.object({
  name: z.string().min(1, 'Name cannot be empty').optional(),
  email: z.string().email('Invalid email format').optional(),
  role: z
    .enum(['Admin', 'Doctor', 'Medical_Assistant'], {
      errorMap: () => ({ message: 'Role must be Admin, Doctor, or Medical_Assistant' }),
    })
    .optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update',
});

/**
 * PATCH /api/users/[id] — Update a user within the tenant (Admin only)
 */
export const PATCH = withAuthAndPermission(
  'user_management',
  async (request: AuthenticatedRequest, context?: { params: Record<string, string> }) => {
    try {
      const userId = context?.params?.id;
      if (!userId) {
        throw new ValidationError('User ID is required');
      }

      const body = await request.json();
      const parsed = updateUserSchema.safeParse(body);

      if (!parsed.success) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
          const field = issue.path.join('.') || '_form';
          fieldErrors[field] = issue.message;
        }
        throw new ValidationError('Invalid input', fieldErrors);
      }

      const user = await UserService.update(request.user.tenantId, userId, parsed.data);
      return NextResponse.json(successResponse(user));
    } catch (error) {
      const { body, status } = handleApiError(error);
      return NextResponse.json(body, { status });
    }
  }
);

/**
 * DELETE /api/users/[id] — Deactivate a user within the tenant (Admin only)
 */
export const DELETE = withAuthAndPermission(
  'user_management',
  async (request: AuthenticatedRequest, context?: { params: Record<string, string> }) => {
    try {
      const userId = context?.params?.id;
      if (!userId) {
        throw new ValidationError('User ID is required');
      }

      await UserService.deactivate(request.user.tenantId, userId);
      return NextResponse.json(successResponse(null));
    } catch (error) {
      const { body, status } = handleApiError(error);
      return NextResponse.json(body, { status });
    }
  }
);

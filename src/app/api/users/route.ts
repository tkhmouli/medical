import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthAndPermission, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { successResponse, handleApiError } from '@/lib/api-response';
import * as UserService from '@/lib/services/user-service';
import { ValidationError } from '@/lib/errors';

const createUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  name: z.string().min(1, 'Name is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['Admin', 'Doctor', 'Medical_Assistant'], {
    errorMap: () => ({ message: 'Role must be Admin, Doctor, or Medical_Assistant' }),
  }),
});

/**
 * GET /api/users — List all users for the tenant (Admin only)
 */
export const GET = withAuthAndPermission('user_management', async (request: AuthenticatedRequest) => {
  try {
    const users = await UserService.list(request.user.tenantId);
    return NextResponse.json(successResponse(users));
  } catch (error) {
    const { body, status } = handleApiError(error);
    return NextResponse.json(body, { status });
  }
});

/**
 * POST /api/users — Create a new user within the tenant (Admin only)
 */
export const POST = withAuthAndPermission('user_management', async (request: AuthenticatedRequest) => {
  try {
    const body = await request.json();
    const parsed = createUserSchema.safeParse(body);

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path.join('.');
        fieldErrors[field] = issue.message;
      }
      throw new ValidationError('Invalid input', fieldErrors);
    }

    const user = await UserService.create(request.user.tenantId, parsed.data);
    return NextResponse.json(successResponse(user), { status: 201 });
  } catch (error) {
    const { body, status } = handleApiError(error);
    return NextResponse.json(body, { status });
  }
});

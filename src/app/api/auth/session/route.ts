import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { validateSession } from '@/lib/services/auth-service';
import { handleApiError } from '@/lib/api-response';
import { AuthenticationError } from '@/lib/errors';

/**
 * GET /api/auth/session
 * Returns the current user's session information.
 * Used by the dashboard layout to get user context.
 */
export async function GET(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;

    if (!sessionToken) {
      throw new AuthenticationError('Authentication required');
    }

    const user = await validateSession(sessionToken);

    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
      },
    });
  } catch (error) {
    const { body, status } = handleApiError(error);
    return NextResponse.json(body, { status });
  }
}

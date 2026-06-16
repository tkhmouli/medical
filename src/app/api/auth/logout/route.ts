import { NextRequest, NextResponse } from 'next/server';
import { successResponse, handleApiError } from '@/lib/api-response';
import { logout } from '@/lib/services/auth-service';
import { SESSION_COOKIE_NAME, getClearSessionCookieOptions } from '@/lib/auth/session';

/**
 * POST /api/auth/logout — Invalidate the current session and clear the cookie.
 *
 * Reads the session token from the cookie, deletes the session from the database,
 * and clears the cookie from the response.
 *
 * Validates: Requirement 2.5
 */
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;

    if (token) {
      await logout(token);
    }

    const clearOptions = getClearSessionCookieOptions();
    const response = NextResponse.json(successResponse(null), { status: 200 });

    response.cookies.set(
      clearOptions.name,
      clearOptions.value,
      {
        httpOnly: clearOptions.httpOnly,
        secure: clearOptions.secure,
        sameSite: clearOptions.sameSite,
        path: clearOptions.path,
        maxAge: clearOptions.maxAge,
      }
    );

    return response;
  } catch (error) {
    const { body, status } = handleApiError(error);
    return NextResponse.json(body, { status });
  }
}

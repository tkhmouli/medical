import { NextRequest, NextResponse } from 'next/server';
import { successResponse, handleApiError } from '@/lib/api-response';
import { login } from '@/lib/services/auth-service';
import { getSessionCookieOptions } from '@/lib/auth/session';
import { ValidationError } from '@/lib/errors';
import { TenantService } from '@/lib/services/tenant-service';

/**
 * POST /api/auth/login — Authenticate a user and create a session.
 *
 * Expects JSON body with `email` and `password`.
 * Tenant is resolved from the `x-tenant-subdomain` header (set by middleware).
 *
 * On success: sets an httpOnly session cookie and returns a redirect URL.
 * On failure: returns a 401 with "Invalid email or password" message.
 *
 * Validates: Requirements 2.1, 2.2
 */
export async function POST(request: NextRequest) {
  try {
    // Resolve tenant from subdomain header
    const subdomain = request.headers.get('x-tenant-subdomain');
    if (!subdomain) {
      throw new ValidationError('Tenant context is required');
    }

    const tenant = await TenantService.resolveBySubdomain(subdomain);
    const tenantId = tenant.id;

    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      throw new ValidationError('Email and password are required', {
        ...(email ? {} : { email: 'Email is required' }),
        ...(password ? {} : { password: 'Password is required' }),
      });
    }

    const token = await login(tenantId, email, password);

    const cookieOptions = getSessionCookieOptions(token);
    const response = NextResponse.json(
      successResponse({ redirectUrl: '/' }),
      { status: 200 }
    );

    response.cookies.set(
      cookieOptions.name,
      cookieOptions.value,
      {
        httpOnly: cookieOptions.httpOnly,
        secure: cookieOptions.secure,
        sameSite: cookieOptions.sameSite,
        path: cookieOptions.path,
        maxAge: cookieOptions.maxAge,
      }
    );

    return response;
  } catch (error) {
    const { body, status } = handleApiError(error);
    return NextResponse.json(body, { status });
  }
}

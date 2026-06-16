import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { validateSession } from '@/lib/services/auth-service';
import { hasPermission, type Feature, type Role } from '@/lib/auth/permissions';
import { handleApiError } from '@/lib/api-response';
import { AuthenticationError, AuthorizationError } from '@/lib/errors';

/**
 * User context attached to authenticated requests.
 */
export interface UserContext {
  userId: string;
  tenantId: string;
  role: Role;
  name: string;
  email: string;
}

/**
 * An authenticated request extends the standard NextRequest
 * with a user context object populated by the auth middleware.
 */
export interface AuthenticatedRequest extends NextRequest {
  user: UserContext;
}

/**
 * Type for API route handlers that receive an authenticated request.
 */
export type AuthenticatedHandler = (
  request: AuthenticatedRequest,
  context?: { params: Record<string, string> }
) => Promise<NextResponse>;

/**
 * Type for standard Next.js API route handlers.
 */
export type RouteHandler = (
  request: NextRequest,
  context?: { params: Record<string, string> }
) => Promise<NextResponse>;

/**
 * Higher-order function that wraps an API route handler with authentication.
 *
 * - Reads the session cookie from the request
 * - Validates the session via the auth service
 * - Attaches user context (userId, tenantId, role, name, email) to the request
 * - Returns 401 if no session cookie is present or if the session is invalid/expired
 */
export function withAuth(handler: AuthenticatedHandler): RouteHandler {
  return async (request: NextRequest, context?: { params: Record<string, string> }) => {
    try {
      const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;

      if (!sessionToken) {
        throw new AuthenticationError('Authentication required');
      }

      const userInfo = await validateSession(sessionToken);

      // Attach user context to request
      const authenticatedRequest = request as AuthenticatedRequest;
      authenticatedRequest.user = {
        userId: userInfo.id,
        tenantId: userInfo.tenantId,
        role: userInfo.role,
        name: userInfo.name,
        email: userInfo.email,
      };

      return await handler(authenticatedRequest, context);
    } catch (error) {
      const { body, status } = handleApiError(error);
      return NextResponse.json(body, { status });
    }
  };
}

/**
 * Higher-order function that wraps an API route handler with authentication
 * AND role-based permission checking.
 *
 * - Performs all authentication checks from `withAuth`
 * - Additionally verifies the user's role has access to the specified feature
 * - Returns 401 if not authenticated
 * - Returns 403 if authenticated but lacking the required permission
 */
export function withAuthAndPermission(
  feature: Feature,
  handler: AuthenticatedHandler
): RouteHandler {
  return withAuth(async (request: AuthenticatedRequest, context) => {
    if (!hasPermission(request.user.role, feature)) {
      throw new AuthorizationError();
    }

    return await handler(request, context);
  });
}

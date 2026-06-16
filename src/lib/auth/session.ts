import { SignJWT, jwtVerify } from 'jose';
import { AuthenticationError } from '@/lib/errors';

/**
 * JWT secret key for signing and verifying session tokens.
 * Uses JWT_SECRET environment variable with a dev-only fallback.
 */
function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET || 'dev-secret-do-not-use-in-production';
  return new TextEncoder().encode(secret);
}

/** Name of the session cookie */
export const SESSION_COOKIE_NAME = 'clinic-session';

/** JWT session token payload structure */
export interface SessionPayload {
  userId: string;
  tenantId: string;
  role: 'Admin' | 'Doctor' | 'Medical_Assistant';
}

/**
 * Creates a signed JWT session token with user claims.
 * Token expires in 24 hours.
 */
export async function createSessionToken(
  userId: string,
  tenantId: string,
  role: 'Admin' | 'Doctor' | 'Medical_Assistant'
): Promise<string> {
  const token = await new SignJWT({ userId, tenantId, role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(getJwtSecret());

  return token;
}

/**
 * Verifies a JWT session token and returns its payload.
 * Throws AuthenticationError if the token is invalid or expired.
 */
export async function verifySessionToken(token: string): Promise<SessionPayload> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());

    const userId = payload.userId as string | undefined;
    const tenantId = payload.tenantId as string | undefined;
    const role = payload.role as string | undefined;

    if (!userId || !tenantId || !role) {
      throw new AuthenticationError('Invalid session token');
    }

    return { userId, tenantId, role: role as SessionPayload['role'] };
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }
    throw new AuthenticationError('Invalid or expired session token');
  }
}

/**
 * Cookie options for the session cookie.
 */
export interface CookieOptions {
  name: string;
  value: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax' | 'strict' | 'none';
  path: string;
  maxAge: number;
}

/**
 * Returns the cookie options for setting the session cookie.
 * Used with Next.js response cookies API.
 */
export function getSessionCookieOptions(token: string): CookieOptions {
  return {
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24, // 24 hours in seconds
  };
}

/**
 * Returns the cookie options for clearing the session cookie.
 * Used with Next.js response cookies API.
 */
export function getClearSessionCookieOptions(): Omit<CookieOptions, 'value' | 'maxAge'> & { value: string; maxAge: number } {
  return {
    name: SESSION_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  };
}

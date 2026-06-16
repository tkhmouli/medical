import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users, sessions } from '@/lib/db/schema';
import { AuthenticationError } from '@/lib/errors';
import { createSessionToken, verifySessionToken } from '@/lib/auth/session';

const scryptAsync = promisify(scrypt);

/** Salt length in bytes */
const SALT_LENGTH = 32;

/** Key length for scrypt output in bytes */
const KEY_LENGTH = 64;

/**
 * Hashes a password using scrypt with a random salt.
 * Returns a string in the format: `salt:hash` (both hex encoded).
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  return `${salt.toString('hex')}:${derivedKey.toString('hex')}`;
}

/**
 * Verifies a password against a stored hash.
 * Uses timing-safe comparison to prevent timing attacks.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [saltHex, hashHex] = storedHash.split(':');
  if (!saltHex || !hashHex) {
    return false;
  }

  const salt = Buffer.from(saltHex, 'hex');
  const storedKey = Buffer.from(hashHex, 'hex');
  const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;

  if (storedKey.length !== derivedKey.length) {
    return false;
  }

  return timingSafeEqual(storedKey, derivedKey);
}

/**
 * Authenticates a user by tenantId, email, and password.
 * Creates a database session and returns a JWT session token.
 * Throws AuthenticationError on invalid credentials or inactive user.
 */
export async function login(
  tenantId: string,
  email: string,
  password: string
): Promise<string> {
  // Find user by tenant and email
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.tenantId, tenantId), eq(users.email, email)))
    .limit(1);

  if (!user) {
    throw new AuthenticationError();
  }

  // Check if user is active
  if (!user.isActive) {
    throw new AuthenticationError();
  }

  // Verify password
  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    throw new AuthenticationError();
  }

  // Create JWT token
  const token = await createSessionToken(user.id, tenantId, user.role);

  // Store session in database
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  await db.insert(sessions).values({
    userId: user.id,
    tenantId,
    token,
    expiresAt,
  });

  return token;
}

/**
 * Logs out by deleting the session from the database.
 */
export async function logout(token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.token, token));
}

/**
 * Validates a session token.
 * Verifies the JWT signature, checks the session exists in the DB, and confirms it hasn't expired.
 * Returns user info on success or throws AuthenticationError on failure.
 */
export async function validateSession(token: string): Promise<{
  id: string;
  tenantId: string;
  role: 'Admin' | 'Doctor' | 'Medical_Assistant';
  name: string;
  email: string;
}> {
  // Verify JWT signature and extract payload
  const payload = await verifySessionToken(token);

  // Check session exists in DB and is not expired
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.token, token))
    .limit(1);

  if (!session) {
    throw new AuthenticationError('Session not found');
  }

  if (new Date() > session.expiresAt) {
    // Clean up expired session
    await db.delete(sessions).where(eq(sessions.token, token));
    throw new AuthenticationError('Session expired');
  }

  // Get user info
  const [user] = await db
    .select({
      id: users.id,
      tenantId: users.tenantId,
      role: users.role,
      name: users.name,
      email: users.email,
      isActive: users.isActive,
    })
    .from(users)
    .where(eq(users.id, payload.userId))
    .limit(1);

  if (!user || !user.isActive) {
    throw new AuthenticationError('User not found or inactive');
  }

  return {
    id: user.id,
    tenantId: user.tenantId,
    role: user.role,
    name: user.name,
    email: user.email,
  };
}

/**
 * Invalidates all sessions for a user.
 * Used when a user is deactivated.
 */
export async function invalidateUserSessions(userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

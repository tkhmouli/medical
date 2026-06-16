import { eq, and, asc, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { ConflictError, NotFoundError } from '@/lib/errors';
import { hashPassword, invalidateUserSessions } from '@/lib/services/auth-service';

export interface CreateUserInput {
  email: string;
  name: string;
  password: string;
  role: 'Admin' | 'Doctor' | 'Medical_Assistant';
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  role?: 'Admin' | 'Doctor' | 'Medical_Assistant';
}

export interface UserResult {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: 'Admin' | 'Doctor' | 'Medical_Assistant';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Creates a new user within the specified tenant.
 * Enforces unique email per tenant. Hashes password before storage.
 * Returns the created user without the passwordHash.
 */
export async function create(
  tenantId: string,
  data: CreateUserInput
): Promise<UserResult> {
  // Check if email already exists for this tenant
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.tenantId, tenantId), eq(users.email, data.email)))
    .limit(1);

  if (existing) {
    throw new ConflictError('email already in use');
  }

  // Hash the password
  const passwordHash = await hashPassword(data.password);

  // Insert the user
  const [created] = await db
    .insert(users)
    .values({
      tenantId,
      email: data.email,
      name: data.name,
      passwordHash,
      role: data.role,
    })
    .returning({
      id: users.id,
      tenantId: users.tenantId,
      email: users.email,
      name: users.name,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    });

  return created;
}

/**
 * Updates a user's name, email, or role.
 * If email is being changed, enforces uniqueness within the tenant.
 * Role changes take effect on the next request (no session invalidation needed).
 */
export async function update(
  tenantId: string,
  userId: string,
  data: UpdateUserInput
): Promise<UserResult> {
  // If email is being changed, check uniqueness
  if (data.email) {
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.tenantId, tenantId),
          eq(users.email, data.email)
        )
      )
      .limit(1);

    if (existing && existing.id !== userId) {
      throw new ConflictError('email already in use');
    }
  }

  // Build the update payload
  const updatePayload: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (data.name !== undefined) {
    updatePayload.name = data.name;
  }
  if (data.email !== undefined) {
    updatePayload.email = data.email;
  }
  if (data.role !== undefined) {
    updatePayload.role = data.role;
  }

  const [updated] = await db
    .update(users)
    .set(updatePayload)
    .where(and(eq(users.id, userId), eq(users.tenantId, tenantId)))
    .returning({
      id: users.id,
      tenantId: users.tenantId,
      email: users.email,
      name: users.name,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    });

  if (!updated) {
    throw new NotFoundError('User');
  }

  return updated;
}

/**
 * Deactivates a user by setting isActive=false and invalidating all sessions.
 * Prevents the user from logging in after deactivation.
 */
export async function deactivate(
  tenantId: string,
  userId: string
): Promise<void> {
  const [updated] = await db
    .update(users)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(eq(users.id, userId), eq(users.tenantId, tenantId)))
    .returning({ id: users.id });

  if (!updated) {
    throw new NotFoundError('User');
  }

  // Invalidate all active sessions for this user
  await invalidateUserSessions(userId);
}

/**
 * Lists all users for a given tenant.
 * Returns id, email, name, role, isActive, and createdAt.
 */
export async function list(tenantId: string): Promise<UserResult[]> {
  const result = await db
    .select({
      id: users.id,
      tenantId: users.tenantId,
      email: users.email,
      name: users.name,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .where(eq(users.tenantId, tenantId));

  return result;
}

/**
 * Gets a single user by id within the specified tenant.
 * Throws NotFoundError if the user doesn't exist.
 */
export async function getById(
  tenantId: string,
  userId: string
): Promise<UserResult> {
  const [user] = await db
    .select({
      id: users.id,
      tenantId: users.tenantId,
      email: users.email,
      name: users.name,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.tenantId, tenantId)))
    .limit(1);

  if (!user) {
    throw new NotFoundError('User');
  }

  return user;
}

// ─── Doctor List Types ────────────────────────────────────────────────────────

export interface DoctorListResult {
  id: string;
  name: string;
}

// ─── Doctor List Function ─────────────────────────────────────────────────────

/**
 * Lists active doctors for a tenant, sorted alphabetically by name (case-insensitive).
 * Returns only id and name for dropdown display.
 *
 * Requirements: 3.1, 3.2, 5.1
 */
export async function listDoctors(
  tenantId: string
): Promise<DoctorListResult[]> {
  const results = await db
    .select({
      id: users.id,
      name: users.name,
    })
    .from(users)
    .where(
      and(
        eq(users.tenantId, tenantId),
        eq(users.role, 'Doctor'),
        eq(users.isActive, true)
      )
    )
    .orderBy(asc(sql`lower(${users.name})`));

  return results;
}

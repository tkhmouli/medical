import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictError, NotFoundError } from '@/lib/errors';

// Mock the db module
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock the auth-service module
vi.mock('@/lib/services/auth-service', () => ({
  hashPassword: vi.fn().mockResolvedValue('mocked-salt:mocked-hash'),
  invalidateUserSessions: vi.fn().mockResolvedValue(undefined),
}));

import { db } from '@/lib/db';
import { hashPassword, invalidateUserSessions } from '@/lib/services/auth-service';
import { create, update, deactivate, list, getById } from './user-service';

// Helper to create chainable query mocks
function mockSelectChain(result: unknown[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(result),
  };
  (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  return chain;
}

function mockInsertChain(result: unknown[]) {
  const chain = {
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(result),
  };
  (db.insert as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  return chain;
}

function mockUpdateChain(result: unknown[]) {
  const chain = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(result),
  };
  (db.update as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  return chain;
}

describe('UserService', () => {
  const tenantId = 'tenant-123';
  const userId = 'user-456';
  const now = new Date('2024-01-15T10:00:00Z');

  const mockUser = {
    id: userId,
    tenantId,
    email: 'doctor@clinic.com',
    name: 'Dr. Smith',
    role: 'Doctor' as const,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should create a user with a unique email', async () => {
      // First select checks for existing email — returns empty (no conflict)
      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      (db.select as ReturnType<typeof vi.fn>).mockReturnValue(selectChain);

      // Insert returns created user
      mockInsertChain([mockUser]);

      const result = await create(tenantId, {
        email: 'doctor@clinic.com',
        name: 'Dr. Smith',
        password: 'securePass123',
        role: 'Doctor',
      });

      expect(hashPassword).toHaveBeenCalledWith('securePass123');
      expect(result).toEqual(mockUser);
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('should throw ConflictError when email already exists in tenant', async () => {
      // Select returns an existing user with the same email
      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: 'existing-user-id' }]),
      };
      (db.select as ReturnType<typeof vi.fn>).mockReturnValue(selectChain);

      await expect(
        create(tenantId, {
          email: 'doctor@clinic.com',
          name: 'Dr. Duplicate',
          password: 'pass123',
          role: 'Doctor',
        })
      ).rejects.toThrow(ConflictError);

      await expect(
        create(tenantId, {
          email: 'doctor@clinic.com',
          name: 'Dr. Duplicate',
          password: 'pass123',
          role: 'Doctor',
        })
      ).rejects.toThrow('email already in use');
    });
  });

  describe('deactivate', () => {
    it('should set isActive=false and invalidate sessions', async () => {
      mockUpdateChain([{ id: userId }]);

      await deactivate(tenantId, userId);

      expect(db.update).toHaveBeenCalled();
      expect(invalidateUserSessions).toHaveBeenCalledWith(userId);
    });

    it('should throw NotFoundError when user does not exist', async () => {
      mockUpdateChain([]);

      await expect(deactivate(tenantId, 'nonexistent-id')).rejects.toThrow(NotFoundError);
    });
  });

  describe('update', () => {
    it('should throw ConflictError when updating to an email already used by another user', async () => {
      // Select for email uniqueness check returns a different user with that email
      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: 'other-user-id' }]),
      };
      (db.select as ReturnType<typeof vi.fn>).mockReturnValue(selectChain);

      await expect(
        update(tenantId, userId, { email: 'taken@clinic.com' })
      ).rejects.toThrow(ConflictError);
    });

    it('should allow updating email to the same user own email', async () => {
      // Select returns the same user (own email)
      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: userId }]),
      };
      (db.select as ReturnType<typeof vi.fn>).mockReturnValue(selectChain);

      const updatedUser = { ...mockUser, email: 'doctor@clinic.com', updatedAt: new Date() };
      mockUpdateChain([updatedUser]);

      const result = await update(tenantId, userId, { email: 'doctor@clinic.com' });

      expect(result.email).toBe('doctor@clinic.com');
    });

    it('should update role without invalidating sessions', async () => {
      // No email change, so no select for uniqueness
      // We need to mock the update chain directly since email is undefined
      const updateChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ ...mockUser, role: 'Admin' }]),
      };
      (db.update as ReturnType<typeof vi.fn>).mockReturnValue(updateChain);

      const result = await update(tenantId, userId, { role: 'Admin' });

      expect(result.role).toBe('Admin');
      expect(invalidateUserSessions).not.toHaveBeenCalled();
    });

    it('should throw NotFoundError when user does not exist', async () => {
      // No email change so skip select
      mockUpdateChain([]);

      await expect(
        update(tenantId, 'nonexistent-id', { name: 'New Name' })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('list', () => {
    it('should return all users for a tenant', async () => {
      const users = [mockUser, { ...mockUser, id: 'user-789', email: 'nurse@clinic.com', role: 'Medical_Assistant' as const }];

      // list doesn't call .limit() — it resolves from .where()
      const chain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(users),
      };
      (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);

      const result = await list(tenantId);

      expect(result).toHaveLength(2);
      expect(result[0].email).toBe('doctor@clinic.com');
      expect(result[1].email).toBe('nurse@clinic.com');
    });
  });

  describe('getById', () => {
    it('should return a user when found', async () => {
      mockSelectChain([mockUser]);

      const result = await getById(tenantId, userId);

      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundError when user is not found', async () => {
      mockSelectChain([]);

      await expect(getById(tenantId, 'nonexistent')).rejects.toThrow(NotFoundError);
    });
  });
});

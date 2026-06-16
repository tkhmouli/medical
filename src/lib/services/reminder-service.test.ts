import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundError, ValidationError } from '@/lib/errors';

// Mock the db module
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

import { db } from '@/lib/db';
import { create, dismiss, list, getByPatient } from './reminder-service';

// Helper to create chainable query mocks
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

function mockSelectChain(result: unknown[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(result),
  };
  (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  return chain;
}

describe('ReminderService', () => {
  const tenantId = 'tenant-123';
  const patientId = '550e8400-e29b-41d4-a716-446655440000';
  const reminderId = 'reminder-456';
  const now = new Date('2024-01-15T10:00:00Z');

  const mockReminder = {
    id: reminderId,
    tenantId,
    patientId,
    targetDate: '2024-01-30',
    reminderType: 'follow_up' as const,
    customMessage: null,
    status: 'pending' as const,
    intervalDays: 15,
    createdAt: now,
    updatedAt: now,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should create a reminder with follow_up type and 15-day interval', async () => {
      mockInsertChain([mockReminder]);

      const result = await create(tenantId, {
        patientId,
        intervalDays: 15,
        reminderType: 'follow_up',
      });

      expect(db.insert).toHaveBeenCalled();
      expect(result).toEqual(mockReminder);
      expect(result.status).toBe('pending');
    });

    it('should create a reminder with check_up type and 30-day interval', async () => {
      const checkUpReminder = {
        ...mockReminder,
        reminderType: 'check_up' as const,
        intervalDays: 30,
        targetDate: '2024-02-14',
      };
      mockInsertChain([checkUpReminder]);

      const result = await create(tenantId, {
        patientId,
        intervalDays: 30,
        reminderType: 'check_up',
      });

      expect(db.insert).toHaveBeenCalled();
      expect(result.reminderType).toBe('check_up');
      expect(result.intervalDays).toBe(30);
    });

    it('should create a reminder with custom type and customMessage', async () => {
      const customReminder = {
        ...mockReminder,
        reminderType: 'custom' as const,
        customMessage: 'Please bring lab results',
        intervalDays: 7,
      };
      mockInsertChain([customReminder]);

      const result = await create(tenantId, {
        patientId,
        intervalDays: 7,
        reminderType: 'custom',
        customMessage: 'Please bring lab results',
      });

      expect(db.insert).toHaveBeenCalled();
      expect(result.reminderType).toBe('custom');
      expect(result.customMessage).toBe('Please bring lab results');
    });

    it('should throw ValidationError when patientId is not a valid UUID', async () => {
      await expect(
        create(tenantId, {
          patientId: 'invalid-id',
          intervalDays: 15,
          reminderType: 'follow_up',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when intervalDays is zero', async () => {
      await expect(
        create(tenantId, {
          patientId,
          intervalDays: 0,
          reminderType: 'follow_up',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when intervalDays is negative', async () => {
      await expect(
        create(tenantId, {
          patientId,
          intervalDays: -5,
          reminderType: 'follow_up',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when intervalDays is not an integer', async () => {
      await expect(
        create(tenantId, {
          patientId,
          intervalDays: 15.5,
          reminderType: 'follow_up',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when reminderType is invalid', async () => {
      await expect(
        create(tenantId, {
          patientId,
          intervalDays: 15,
          reminderType: 'invalid_type' as 'follow_up',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when custom type is missing customMessage', async () => {
      await expect(
        create(tenantId, {
          patientId,
          intervalDays: 15,
          reminderType: 'custom',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when custom type has empty customMessage', async () => {
      await expect(
        create(tenantId, {
          patientId,
          intervalDays: 15,
          reminderType: 'custom',
          customMessage: '   ',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should allow customMessage to be omitted for non-custom types', async () => {
      mockInsertChain([mockReminder]);

      const result = await create(tenantId, {
        patientId,
        intervalDays: 15,
        reminderType: 'follow_up',
      });

      expect(result).toEqual(mockReminder);
    });

    it('should allow customMessage to be provided for non-custom types', async () => {
      const reminderWithMsg = { ...mockReminder, customMessage: 'Optional note' };
      mockInsertChain([reminderWithMsg]);

      const result = await create(tenantId, {
        patientId,
        intervalDays: 15,
        reminderType: 'follow_up',
        customMessage: 'Optional note',
      });

      expect(result.customMessage).toBe('Optional note');
    });
  });

  describe('dismiss', () => {
    it('should dismiss an existing reminder', async () => {
      mockUpdateChain([{ id: reminderId }]);

      await expect(dismiss(tenantId, reminderId)).resolves.toBeUndefined();
      expect(db.update).toHaveBeenCalled();
    });

    it('should throw NotFoundError when reminder does not exist', async () => {
      mockUpdateChain([]);

      await expect(
        dismiss(tenantId, 'nonexistent-id')
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when reminder belongs to different tenant', async () => {
      mockUpdateChain([]);

      await expect(
        dismiss('other-tenant', reminderId)
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('list', () => {
    it('should return reminders with patient names for the tenant', async () => {
      const reminderRows = [
        {
          id: reminderId,
          tenantId,
          patientId,
          patientFirstName: 'John',
          patientLastName: 'Doe',
          targetDate: '2024-01-30',
          reminderType: 'follow_up' as const,
          customMessage: null,
          status: 'pending' as const,
          intervalDays: 15,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'reminder-789',
          tenantId,
          patientId: 'patient-002',
          patientFirstName: 'Jane',
          patientLastName: 'Smith',
          targetDate: '2024-02-14',
          reminderType: 'check_up' as const,
          customMessage: null,
          status: 'sent' as const,
          intervalDays: 30,
          createdAt: now,
          updatedAt: now,
        },
      ];
      mockSelectChain(reminderRows);

      const result = await list(tenantId);

      expect(db.select).toHaveBeenCalled();
      expect(result).toHaveLength(2);
      expect(result[0].patientName).toBe('John Doe');
      expect(result[1].patientName).toBe('Jane Smith');
    });

    it('should return an empty array when no reminders exist', async () => {
      mockSelectChain([]);

      const result = await list(tenantId);

      expect(result).toEqual([]);
    });
  });

  describe('getByPatient', () => {
    it('should return all reminders for a specific patient', async () => {
      const patientReminders = [
        mockReminder,
        {
          ...mockReminder,
          id: 'reminder-789',
          reminderType: 'check_up' as const,
          intervalDays: 30,
          targetDate: '2024-02-14',
        },
      ];
      mockSelectChain(patientReminders);

      const result = await getByPatient(tenantId, patientId);

      expect(db.select).toHaveBeenCalled();
      expect(result).toHaveLength(2);
      expect(result[0].patientId).toBe(patientId);
      expect(result[1].patientId).toBe(patientId);
    });

    it('should return an empty array when patient has no reminders', async () => {
      mockSelectChain([]);

      const result = await getByPatient(tenantId, patientId);

      expect(result).toEqual([]);
    });
  });
});

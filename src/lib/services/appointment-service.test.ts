import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { timeRangesOverlap, parseTimeToMinutes } from './appointment-service';

// Mock the db module
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

import { db } from '@/lib/db';
import { create, update, cancel, getByDateRange, getByDate, checkConflict } from './appointment-service';

// Helper to create chainable query mocks
function mockSelectChain(result: unknown[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(result),
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

describe('AppointmentService', () => {
  const tenantId = 'tenant-123';
  const now = new Date('2024-01-15T10:00:00Z');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('parseTimeToMinutes', () => {
    it('should parse 00:00 to 0', () => {
      expect(parseTimeToMinutes('00:00')).toBe(0);
    });

    it('should parse 01:30 to 90', () => {
      expect(parseTimeToMinutes('01:30')).toBe(90);
    });

    it('should parse 12:00 to 720', () => {
      expect(parseTimeToMinutes('12:00')).toBe(720);
    });

    it('should parse 23:59 to 1439', () => {
      expect(parseTimeToMinutes('23:59')).toBe(1439);
    });
  });

  describe('timeRangesOverlap', () => {
    it('should return true when ranges are identical', () => {
      expect(timeRangesOverlap('09:00', 30, '09:00', 30)).toBe(true);
    });

    it('should return true when range A starts during range B', () => {
      // A: 09:15-09:45, B: 09:00-09:30
      expect(timeRangesOverlap('09:15', 30, '09:00', 30)).toBe(true);
    });

    it('should return true when range B starts during range A', () => {
      // A: 09:00-09:30, B: 09:15-09:45
      expect(timeRangesOverlap('09:00', 30, '09:15', 30)).toBe(true);
    });

    it('should return true when one range completely contains the other', () => {
      // A: 09:00-10:00, B: 09:15-09:45
      expect(timeRangesOverlap('09:00', 60, '09:15', 30)).toBe(true);
    });

    it('should return true when one range is contained by the other', () => {
      // A: 09:15-09:45, B: 09:00-10:00
      expect(timeRangesOverlap('09:15', 30, '09:00', 60)).toBe(true);
    });

    it('should return false when ranges are adjacent (A ends when B starts)', () => {
      // A: 09:00-09:30, B: 09:30-10:00
      expect(timeRangesOverlap('09:00', 30, '09:30', 30)).toBe(false);
    });

    it('should return false when ranges are adjacent (B ends when A starts)', () => {
      // A: 09:30-10:00, B: 09:00-09:30
      expect(timeRangesOverlap('09:30', 30, '09:00', 30)).toBe(false);
    });

    it('should return false when ranges are completely separate', () => {
      // A: 09:00-09:30, B: 14:00-14:30
      expect(timeRangesOverlap('09:00', 30, '14:00', 30)).toBe(false);
    });

    it('should return false when A is entirely before B', () => {
      // A: 08:00-08:30, B: 10:00-10:30
      expect(timeRangesOverlap('08:00', 30, '10:00', 30)).toBe(false);
    });

    it('should return false when B is entirely before A', () => {
      // A: 10:00-10:30, B: 08:00-08:30
      expect(timeRangesOverlap('10:00', 30, '08:00', 30)).toBe(false);
    });

    it('should handle single-minute appointments', () => {
      // A: 09:00-09:01, B: 09:00-09:01
      expect(timeRangesOverlap('09:00', 1, '09:00', 1)).toBe(true);
    });

    it('should return true for overlapping ranges with different durations', () => {
      // A: 09:00-09:45, B: 09:30-10:30
      expect(timeRangesOverlap('09:00', 45, '09:30', 60)).toBe(true);
    });
  });

  describe('checkConflict', () => {
    it('should return no conflict when no existing appointments', async () => {
      mockSelectChain([]);

      const result = await checkConflict(tenantId, 'doctor-1', '2024-01-15', '09:00', 30);

      expect(result.hasConflict).toBe(false);
      expect(result.conflictingAppointment).toBeUndefined();
    });

    it('should return conflict when an overlapping appointment exists', async () => {
      const existingAppointment = {
        id: 'appt-1',
        tenantId,
        patientId: 'patient-1',
        doctorId: 'doctor-1',
        date: '2024-01-15',
        startTime: '09:00',
        duration: 30,
        visitType: 'new_visit',
        isCancelled: false,
        notes: null,
        createdAt: now,
        updatedAt: now,
      };
      mockSelectChain([existingAppointment]);

      const result = await checkConflict(tenantId, 'doctor-1', '2024-01-15', '09:15', 30);

      expect(result.hasConflict).toBe(true);
      expect(result.conflictingAppointment).toEqual(existingAppointment);
    });

    it('should exclude the specified appointment from conflict check', async () => {
      const existingAppointment = {
        id: 'appt-1',
        tenantId,
        patientId: 'patient-1',
        doctorId: 'doctor-1',
        date: '2024-01-15',
        startTime: '09:00',
        duration: 30,
        visitType: 'new_visit',
        isCancelled: false,
        notes: null,
        createdAt: now,
        updatedAt: now,
      };
      mockSelectChain([existingAppointment]);

      const result = await checkConflict(tenantId, 'doctor-1', '2024-01-15', '09:00', 30, 'appt-1');

      expect(result.hasConflict).toBe(false);
    });
  });

  describe('create', () => {
    const validInput = {
      patientId: 'patient-1',
      doctorId: 'doctor-1',
      date: '2024-01-15',
      startTime: '09:00',
      duration: 30,
      visitType: 'new_visit' as const,
      notes: 'Initial consultation',
    };

    const mockAppointment = {
      id: 'appt-1',
      tenantId,
      patientId: 'patient-1',
      doctorId: 'doctor-1',
      date: '2024-01-15',
      startTime: '09:00',
      duration: 30,
      visitType: 'new_visit',
      isCancelled: false,
      notes: 'Initial consultation',
      createdAt: now,
      updatedAt: now,
    };

    it('should create an appointment with valid data', async () => {
      mockSelectChain([]); // No conflicts
      mockInsertChain([mockAppointment]);

      const result = await create(tenantId, validInput);

      expect(result.appointment).toEqual(mockAppointment);
      expect(result.conflictWarning).toBeUndefined();
    });

    it('should create appointment and include conflict warning when overlap exists', async () => {
      const conflictingAppt = {
        id: 'appt-existing',
        tenantId,
        patientId: 'patient-2',
        doctorId: 'doctor-1',
        date: '2024-01-15',
        startTime: '09:00',
        duration: 30,
        visitType: 'control_visit',
        isCancelled: false,
        notes: null,
        createdAt: now,
        updatedAt: now,
      };
      mockSelectChain([conflictingAppt]);
      mockInsertChain([mockAppointment]);

      const result = await create(tenantId, validInput);

      expect(result.appointment).toEqual(mockAppointment);
      expect(result.conflictWarning).toBeDefined();
      expect(result.conflictWarning!.hasConflict).toBe(true);
    });

    it('should support all visit types', async () => {
      const visitTypes = ['new_visit', 'control_visit', 'follow_up'] as const;

      for (const visitType of visitTypes) {
        vi.clearAllMocks();
        const appt = { ...mockAppointment, visitType };
        mockSelectChain([]);
        mockInsertChain([appt]);

        const result = await create(tenantId, { ...validInput, visitType });
        expect(result.appointment.visitType).toBe(visitType);
      }
    });

    it('should throw ValidationError when date format is invalid', async () => {
      await expect(
        create(tenantId, { ...validInput, date: '15-01-2024' })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when startTime format is invalid', async () => {
      await expect(
        create(tenantId, { ...validInput, startTime: '9:00' })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when duration is not positive', async () => {
      await expect(
        create(tenantId, { ...validInput, duration: 0 })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when duration is negative', async () => {
      await expect(
        create(tenantId, { ...validInput, duration: -15 })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when visitType is invalid', async () => {
      await expect(
        create(tenantId, { ...validInput, visitType: 'invalid' as 'new_visit' })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when patientId is empty', async () => {
      await expect(
        create(tenantId, { ...validInput, patientId: '' })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when doctorId is empty', async () => {
      await expect(
        create(tenantId, { ...validInput, doctorId: '' })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('update', () => {
    const existingAppointment = {
      id: 'appt-1',
      tenantId,
      patientId: 'patient-1',
      doctorId: 'doctor-1',
      date: '2024-01-15',
      startTime: '09:00',
      duration: 30,
      visitType: 'new_visit',
      isCancelled: false,
      notes: null,
      createdAt: now,
      updatedAt: now,
    };

    it('should update an existing appointment', async () => {
      const updatedAppt = { ...existingAppointment, notes: 'Updated notes', updatedAt: new Date() };

      // First select for the existing appointment check
      const selectChain = mockSelectChain([existingAppointment]);
      mockUpdateChain([updatedAppt]);

      const result = await update(tenantId, 'appt-1', { notes: 'Updated notes' });

      expect(result.appointment.notes).toBe('Updated notes');
    });

    it('should throw NotFoundError when appointment does not exist', async () => {
      mockSelectChain([]);

      await expect(
        update(tenantId, 'nonexistent', { notes: 'test' })
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError for invalid update data', async () => {
      await expect(
        update(tenantId, 'appt-1', { date: 'invalid-date' })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('cancel', () => {
    it('should cancel an existing appointment', async () => {
      mockUpdateChain([{ id: 'appt-1' }]);

      await expect(cancel(tenantId, 'appt-1')).resolves.toBeUndefined();
      expect(db.update).toHaveBeenCalled();
    });

    it('should throw NotFoundError when appointment does not exist', async () => {
      mockUpdateChain([]);

      await expect(cancel(tenantId, 'nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  describe('getByDateRange', () => {
    it('should return non-cancelled appointments within date range', async () => {
      const appts = [
        {
          id: 'appt-1',
          tenantId,
          patientId: 'patient-1',
          doctorId: 'doctor-1',
          date: '2024-01-15',
          startTime: '09:00',
          duration: 30,
          visitType: 'new_visit',
          isCancelled: false,
          notes: null,
          createdAt: now,
          updatedAt: now,
        },
      ];
      mockSelectChain(appts);

      const result = await getByDateRange(tenantId, '2024-01-01', '2024-01-31');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('appt-1');
    });

    it('should return empty array when no appointments in range', async () => {
      mockSelectChain([]);

      const result = await getByDateRange(tenantId, '2024-02-01', '2024-02-28');

      expect(result).toEqual([]);
    });
  });

  describe('getByDate', () => {
    it('should return non-cancelled appointments for a specific date', async () => {
      const appts = [
        {
          id: 'appt-1',
          tenantId,
          patientId: 'patient-1',
          doctorId: 'doctor-1',
          date: '2024-01-15',
          startTime: '09:00',
          duration: 30,
          visitType: 'new_visit',
          isCancelled: false,
          notes: null,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'appt-2',
          tenantId,
          patientId: 'patient-2',
          doctorId: 'doctor-1',
          date: '2024-01-15',
          startTime: '10:00',
          duration: 45,
          visitType: 'follow_up',
          isCancelled: false,
          notes: 'Follow up visit',
          createdAt: now,
          updatedAt: now,
        },
      ];
      mockSelectChain(appts);

      const result = await getByDate(tenantId, '2024-01-15');

      expect(result).toHaveLength(2);
    });

    it('should return empty array when no appointments on date', async () => {
      mockSelectChain([]);

      const result = await getByDate(tenantId, '2024-01-20');

      expect(result).toEqual([]);
    });
  });
});

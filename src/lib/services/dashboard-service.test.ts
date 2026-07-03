import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundError, ValidationError } from '@/lib/errors';
import {
  countByStatus,
  filterAndSortAppointments,
  APPOINTMENT_STATUSES,
  type AppointmentStatus,
} from './dashboard-service';

// Mock the db module
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
}));

import { db } from '@/lib/db';
import {
  getDashboardStats,
  getScheduleForDate,
  updateAppointmentStatus,
} from './dashboard-service';

// Helper to create chainable query mocks
function mockSelectChain(result: unknown[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue(result),
  };
  (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);
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

describe('DashboardService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Pure Function Tests ──────────────────────────────────────────────────

  describe('countByStatus', () => {
    it('should return 0 for empty array', () => {
      expect(countByStatus([], 'waiting')).toBe(0);
    });

    it('should count appointments matching the target status', () => {
      const appointments = [
        { status: 'waiting' as AppointmentStatus },
        { status: 'completed' as AppointmentStatus },
        { status: 'waiting' as AppointmentStatus },
        { status: 'scheduled' as AppointmentStatus },
      ];
      expect(countByStatus(appointments, 'waiting')).toBe(2);
    });

    it('should return 0 when no appointments match', () => {
      const appointments = [
        { status: 'scheduled' as AppointmentStatus },
        { status: 'completed' as AppointmentStatus },
      ];
      expect(countByStatus(appointments, 'in_progress')).toBe(0);
    });

    it('should count all appointments when all match', () => {
      const appointments = [
        { status: 'completed' as AppointmentStatus },
        { status: 'completed' as AppointmentStatus },
        { status: 'completed' as AppointmentStatus },
      ];
      expect(countByStatus(appointments, 'completed')).toBe(3);
    });
  });

  describe('filterAndSortAppointments', () => {
    it('should return empty array for empty input', () => {
      expect(filterAndSortAppointments([])).toEqual([]);
    });

    it('should filter out cancelled appointments', () => {
      const appointments = [
        { isCancelled: false, startTime: '09:00' },
        { isCancelled: true, startTime: '10:00' },
        { isCancelled: false, startTime: '11:00' },
      ];
      const result = filterAndSortAppointments(appointments);
      expect(result).toHaveLength(2);
      expect(result.every((a) => !a.isCancelled)).toBe(true);
    });

    it('should sort by startTime ascending', () => {
      const appointments = [
        { isCancelled: false, startTime: '14:00' },
        { isCancelled: false, startTime: '09:00' },
        { isCancelled: false, startTime: '11:30' },
      ];
      const result = filterAndSortAppointments(appointments);
      expect(result[0].startTime).toBe('09:00');
      expect(result[1].startTime).toBe('11:30');
      expect(result[2].startTime).toBe('14:00');
    });

    it('should both filter and sort', () => {
      const appointments = [
        { isCancelled: false, startTime: '14:00' },
        { isCancelled: true, startTime: '08:00' },
        { isCancelled: false, startTime: '09:00' },
        { isCancelled: true, startTime: '10:00' },
      ];
      const result = filterAndSortAppointments(appointments);
      expect(result).toHaveLength(2);
      expect(result[0].startTime).toBe('09:00');
      expect(result[1].startTime).toBe('14:00');
    });

    it('should return empty array when all appointments are cancelled', () => {
      const appointments = [
        { isCancelled: true, startTime: '09:00' },
        { isCancelled: true, startTime: '10:00' },
      ];
      expect(filterAndSortAppointments(appointments)).toEqual([]);
    });
  });

  // ─── Service Function Tests ───────────────────────────────────────────────

  describe('getDashboardStats', () => {
    const tenantId = 'tenant-123';
    const doctorId = 'doctor-1';

    it('should return today and tomorrow appointments with counts', async () => {
      const todayRows = [
        {
          id: 'appt-1',
          firstName: 'John',
          lastName: 'Doe',
          startTime: '09:00',
          duration: 30,
          visitType: 'new_visit',
          status: 'waiting',
        },
        {
          id: 'appt-2',
          firstName: 'Jane',
          lastName: 'Smith',
          startTime: '10:00',
          duration: 45,
          visitType: 'follow_up',
          status: 'completed',
        },
      ];

      const tomorrowRows = [
        {
          id: 'appt-3',
          firstName: 'Bob',
          lastName: 'Jones',
          startTime: '08:00',
          duration: 30,
          visitType: 'control_visit',
          status: 'scheduled',
        },
      ];

      // getDashboardStats calls queryAppointmentsForDate twice (today and tomorrow)
      let callCount = 0;
      const chain = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockImplementation(() => {
          callCount++;
          return callCount === 1
            ? Promise.resolve(todayRows)
            : Promise.resolve(tomorrowRows);
        }),
      };
      (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);

      const result = await getDashboardStats(tenantId, doctorId, '2024-01-15');

      expect(result.today).toHaveLength(2);
      expect(result.tomorrow).toHaveLength(1);
      expect(result.waitingCount).toBe(1);
      expect(result.seenCount).toBe(1);
      expect(result.today[0].patientName).toBe('John Doe');
    });

    it('should return empty arrays when no appointments exist', async () => {
      mockSelectChain([]);

      const result = await getDashboardStats(tenantId, doctorId, '2024-01-15');

      expect(result.today).toEqual([]);
      expect(result.tomorrow).toEqual([]);
      expect(result.waitingCount).toBe(0);
      expect(result.seenCount).toBe(0);
    });
  });

  describe('getScheduleForDate', () => {
    const tenantId = 'tenant-123';
    const doctorId = 'doctor-1';

    it('should return appointments for the specified date', async () => {
      const rows = [
        {
          id: 'appt-1',
          firstName: 'Alice',
          lastName: 'Brown',
          startTime: '09:00',
          duration: 30,
          visitType: 'new_visit',
          status: 'scheduled',
        },
      ];
      mockSelectChain(rows);

      const result = await getScheduleForDate(tenantId, doctorId, '2024-02-01');

      expect(result).toHaveLength(1);
      expect(result[0].patientName).toBe('Alice Brown');
      expect(result[0].startTime).toBe('09:00');
    });

    it('should return empty array when no appointments on date', async () => {
      mockSelectChain([]);

      const result = await getScheduleForDate(tenantId, doctorId, '2024-02-01');

      expect(result).toEqual([]);
    });
  });

  describe('updateAppointmentStatus', () => {
    const tenantId = 'tenant-123';

    it('should update status with valid value', async () => {
      mockUpdateChain([{ id: 'appt-1' }]);

      await expect(
        updateAppointmentStatus(tenantId, 'appt-1', 'waiting')
      ).resolves.toBeUndefined();
    });

    it('should accept all valid status values', async () => {
      for (const status of APPOINTMENT_STATUSES) {
        vi.clearAllMocks();
        mockUpdateChain([{ id: 'appt-1' }]);

        await expect(
          updateAppointmentStatus(tenantId, 'appt-1', status)
        ).resolves.toBeUndefined();
      }
    });

    it('should throw ValidationError for invalid status', async () => {
      await expect(
        updateAppointmentStatus(tenantId, 'appt-1', 'invalid_status')
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for empty status', async () => {
      await expect(
        updateAppointmentStatus(tenantId, 'appt-1', '')
      ).rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError when appointment does not exist', async () => {
      mockUpdateChain([]);

      await expect(
        updateAppointmentStatus(tenantId, 'nonexistent', 'waiting')
      ).rejects.toThrow(NotFoundError);
    });
  });
});

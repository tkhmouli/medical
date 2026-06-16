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
import { createEntry, updateEntry, getPaymentStatus, getSummary } from './financial-service';

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
    where: vi.fn().mockResolvedValue(result),
  };
  (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  return chain;
}

function mockSelectChainMultiple(results: unknown[][]) {
  let callIndex = 0;
  const mockFn = db.select as ReturnType<typeof vi.fn>;
  mockFn.mockImplementation(() => {
    const result = results[callIndex] || [];
    callIndex++;
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(result),
    };
    return chain;
  });
}

describe('FinancialService', () => {
  const tenantId = 'tenant-123';
  const appointmentId = '550e8400-e29b-41d4-a716-446655440000';
  const entryId = 'entry-456';
  const now = new Date('2024-01-15T10:00:00Z');

  const mockEntry = {
    id: entryId,
    tenantId,
    appointmentId,
    amount: 50000,
    paymentDate: '2024-01-15',
    notes: null,
    createdAt: now,
    updatedAt: now,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createEntry', () => {
    it('should create a financial entry with valid data', async () => {
      mockInsertChain([mockEntry]);

      const result = await createEntry(tenantId, {
        appointmentId,
        amount: 50000,
        paymentDate: '2024-01-15',
      });

      expect(db.insert).toHaveBeenCalled();
      expect(result).toEqual(mockEntry);
    });

    it('should create a financial entry with notes', async () => {
      const entryWithNotes = { ...mockEntry, notes: 'Consultation fee' };
      mockInsertChain([entryWithNotes]);

      const result = await createEntry(tenantId, {
        appointmentId,
        amount: 50000,
        paymentDate: '2024-01-15',
        notes: 'Consultation fee',
      });

      expect(result.notes).toBe('Consultation fee');
    });

    it('should throw ValidationError when appointmentId is not a valid UUID', async () => {
      await expect(
        createEntry(tenantId, {
          appointmentId: 'invalid-id',
          amount: 50000,
          paymentDate: '2024-01-15',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when amount is zero', async () => {
      await expect(
        createEntry(tenantId, {
          appointmentId,
          amount: 0,
          paymentDate: '2024-01-15',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when amount is negative', async () => {
      await expect(
        createEntry(tenantId, {
          appointmentId,
          amount: -100,
          paymentDate: '2024-01-15',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when amount is not an integer', async () => {
      await expect(
        createEntry(tenantId, {
          appointmentId,
          amount: 50.5,
          paymentDate: '2024-01-15',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when paymentDate is not ISO format', async () => {
      await expect(
        createEntry(tenantId, {
          appointmentId,
          amount: 50000,
          paymentDate: '15/01/2024',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when paymentDate is empty', async () => {
      await expect(
        createEntry(tenantId, {
          appointmentId,
          amount: 50000,
          paymentDate: '',
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('updateEntry', () => {
    it('should update an existing entry amount', async () => {
      const updatedEntry = { ...mockEntry, amount: 75000, updatedAt: new Date() };
      mockUpdateChain([updatedEntry]);

      const result = await updateEntry(tenantId, entryId, { amount: 75000 });

      expect(db.update).toHaveBeenCalled();
      expect(result.amount).toBe(75000);
    });

    it('should update an existing entry paymentDate', async () => {
      const updatedEntry = { ...mockEntry, paymentDate: '2024-02-01', updatedAt: new Date() };
      mockUpdateChain([updatedEntry]);

      const result = await updateEntry(tenantId, entryId, { paymentDate: '2024-02-01' });

      expect(result.paymentDate).toBe('2024-02-01');
    });

    it('should update an existing entry notes', async () => {
      const updatedEntry = { ...mockEntry, notes: 'Updated note', updatedAt: new Date() };
      mockUpdateChain([updatedEntry]);

      const result = await updateEntry(tenantId, entryId, { notes: 'Updated note' });

      expect(result.notes).toBe('Updated note');
    });

    it('should throw NotFoundError when entry does not exist', async () => {
      mockUpdateChain([]);

      await expect(
        updateEntry(tenantId, 'nonexistent-id', { amount: 75000 })
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when entry belongs to different tenant', async () => {
      mockUpdateChain([]);

      await expect(
        updateEntry('other-tenant', entryId, { amount: 75000 })
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError when amount is not a positive integer', async () => {
      await expect(
        updateEntry(tenantId, entryId, { amount: -50 })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when paymentDate is invalid format', async () => {
      await expect(
        updateEntry(tenantId, entryId, { paymentDate: 'not-a-date' })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('getPaymentStatus', () => {
    it('should return paid when total amount > 0', async () => {
      mockSelectChain([{ totalAmount: 50000 }]);

      const result = await getPaymentStatus(tenantId, appointmentId);

      expect(result).toBe('paid');
    });

    it('should return unpaid when total amount is 0', async () => {
      mockSelectChain([{ totalAmount: 0 }]);

      const result = await getPaymentStatus(tenantId, appointmentId);

      expect(result).toBe('unpaid');
    });

    it('should return unpaid when no entries exist (null/0)', async () => {
      mockSelectChain([{ totalAmount: 0 }]);

      const result = await getPaymentStatus(tenantId, appointmentId);

      expect(result).toBe('unpaid');
    });
  });

  describe('getSummary', () => {
    it('should calculate summary with paid and unpaid appointments', async () => {
      const entries = [
        { appointmentId: 'apt-1', amount: 30000 },
        { appointmentId: 'apt-1', amount: 20000 },
        { appointmentId: 'apt-2', amount: 50000 },
      ];
      const appointmentsInRange = [
        { id: 'apt-1' },
        { id: 'apt-2' },
        { id: 'apt-3' },
      ];

      mockSelectChainMultiple([entries, appointmentsInRange]);

      const result = await getSummary(tenantId, '2024-01-01', '2024-01-31');

      expect(result.totalReceived).toBe(100000);
      expect(result.paidCount).toBe(2);
      expect(result.unpaidCount).toBe(1);
      expect(result.dateRange).toEqual({ start: '2024-01-01', end: '2024-01-31' });
    });

    it('should return zeros when no entries or appointments exist', async () => {
      mockSelectChainMultiple([[], []]);

      const result = await getSummary(tenantId, '2024-01-01', '2024-01-31');

      expect(result.totalReceived).toBe(0);
      expect(result.paidCount).toBe(0);
      expect(result.unpaidCount).toBe(0);
    });

    it('should count all appointments as unpaid when no financial entries exist', async () => {
      const appointmentsInRange = [
        { id: 'apt-1' },
        { id: 'apt-2' },
      ];

      mockSelectChainMultiple([[], appointmentsInRange]);

      const result = await getSummary(tenantId, '2024-01-01', '2024-01-31');

      expect(result.totalReceived).toBe(0);
      expect(result.paidCount).toBe(0);
      expect(result.unpaidCount).toBe(2);
    });

    it('should include dateRange in the summary', async () => {
      mockSelectChainMultiple([[], []]);

      const result = await getSummary(tenantId, '2024-03-01', '2024-03-31');

      expect(result.dateRange).toEqual({ start: '2024-03-01', end: '2024-03-31' });
    });
  });
});

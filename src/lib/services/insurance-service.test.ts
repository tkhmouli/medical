import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundError, ValidationError } from '@/lib/errors';

// Mock the db module
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
  },
}));

import { db } from '@/lib/db';
import { addInsurance, removeInsurance, listByPatient } from './insurance-service';

// Helper to create chainable query mocks
function mockInsertChain(result: unknown[]) {
  const chain = {
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(result),
  };
  (db.insert as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  return chain;
}

function mockDeleteChain(result: unknown[]) {
  const chain = {
    where: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(result),
  };
  (db.delete as ReturnType<typeof vi.fn>).mockReturnValue(chain);
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

describe('InsuranceService', () => {
  const tenantId = 'tenant-123';
  const patientId = 'patient-456';
  const insuranceId = 'insurance-789';
  const now = new Date('2024-01-15T10:00:00Z');

  const mockInsurance = {
    id: insuranceId,
    tenantId,
    patientId,
    providerType: 'CNSS' as const,
    providerName: null,
    membershipNumber: 'MEM-001',
    createdAt: now,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('addInsurance', () => {
    it('should create an insurance record with a standard provider type', async () => {
      mockInsertChain([mockInsurance]);

      const result = await addInsurance(tenantId, patientId, {
        providerType: 'CNSS',
        membershipNumber: 'MEM-001',
      });

      expect(db.insert).toHaveBeenCalled();
      expect(result).toEqual(mockInsurance);
    });

    it('should create an insurance record with providerType "other" and providerName', async () => {
      const otherInsurance = {
        ...mockInsurance,
        providerType: 'other' as const,
        providerName: 'Custom Insurance Co',
      };
      mockInsertChain([otherInsurance]);

      const result = await addInsurance(tenantId, patientId, {
        providerType: 'other',
        providerName: 'Custom Insurance Co',
        membershipNumber: 'MEM-001',
      });

      expect(db.insert).toHaveBeenCalled();
      expect(result.providerType).toBe('other');
      expect(result.providerName).toBe('Custom Insurance Co');
    });

    it('should support all valid provider types', async () => {
      const providerTypes = ['CNSS', 'CNOPS', 'AXA', 'Atlanta', 'SAHAM', 'RMA'] as const;

      for (const providerType of providerTypes) {
        vi.clearAllMocks();
        const insurance = { ...mockInsurance, providerType };
        mockInsertChain([insurance]);

        const result = await addInsurance(tenantId, patientId, {
          providerType,
          membershipNumber: 'MEM-001',
        });

        expect(result.providerType).toBe(providerType);
      }
    });

    it('should throw ValidationError when providerType is missing', async () => {
      await expect(
        addInsurance(tenantId, patientId, {
          providerType: '' as 'CNSS',
          membershipNumber: 'MEM-001',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when providerType is invalid', async () => {
      await expect(
        addInsurance(tenantId, patientId, {
          providerType: 'INVALID' as 'CNSS',
          membershipNumber: 'MEM-001',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when membershipNumber is empty', async () => {
      await expect(
        addInsurance(tenantId, patientId, {
          providerType: 'CNSS',
          membershipNumber: '',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when providerType is "other" but providerName is missing', async () => {
      await expect(
        addInsurance(tenantId, patientId, {
          providerType: 'other',
          membershipNumber: 'MEM-001',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when providerType is "other" but providerName is empty', async () => {
      await expect(
        addInsurance(tenantId, patientId, {
          providerType: 'other',
          providerName: '',
          membershipNumber: 'MEM-001',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when providerType is "other" but providerName is whitespace only', async () => {
      await expect(
        addInsurance(tenantId, patientId, {
          providerType: 'other',
          providerName: '   ',
          membershipNumber: 'MEM-001',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should not require providerName for standard provider types', async () => {
      mockInsertChain([mockInsurance]);

      const result = await addInsurance(tenantId, patientId, {
        providerType: 'CNSS',
        membershipNumber: 'MEM-001',
      });

      expect(result).toEqual(mockInsurance);
    });
  });

  describe('removeInsurance', () => {
    it('should remove an existing insurance record', async () => {
      mockDeleteChain([{ id: insuranceId }]);

      await expect(removeInsurance(tenantId, insuranceId)).resolves.toBeUndefined();
      expect(db.delete).toHaveBeenCalled();
    });

    it('should throw NotFoundError when insurance record does not exist', async () => {
      mockDeleteChain([]);

      await expect(removeInsurance(tenantId, 'nonexistent-id')).rejects.toThrow(
        NotFoundError
      );
    });

    it('should scope deletion to the specified tenant', async () => {
      mockDeleteChain([{ id: insuranceId }]);

      await removeInsurance(tenantId, insuranceId);

      expect(db.delete).toHaveBeenCalled();
    });
  });

  describe('listByPatient', () => {
    it('should return all insurance records for a patient', async () => {
      const insurances = [
        mockInsurance,
        {
          ...mockInsurance,
          id: 'insurance-002',
          providerType: 'CNOPS' as const,
          membershipNumber: 'MEM-002',
        },
      ];
      mockSelectChain(insurances);

      const result = await listByPatient(tenantId, patientId);

      expect(db.select).toHaveBeenCalled();
      expect(result).toHaveLength(2);
      expect(result[0].providerType).toBe('CNSS');
      expect(result[1].providerType).toBe('CNOPS');
    });

    it('should return an empty array when patient has no insurance records', async () => {
      mockSelectChain([]);

      const result = await listByPatient(tenantId, patientId);

      expect(result).toEqual([]);
    });

    it('should scope query to the specified tenant and patient', async () => {
      mockSelectChain([mockInsurance]);

      await listByPatient(tenantId, patientId);

      expect(db.select).toHaveBeenCalled();
    });
  });
});

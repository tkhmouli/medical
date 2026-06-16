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
import { create, update, deactivate, listActive, listAll } from './medication-service';

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

describe('MedicationService', () => {
  const tenantId = 'tenant-123';
  const medicationId = 'med-456';
  const now = new Date('2024-01-15T10:00:00Z');

  const mockMedication = {
    id: medicationId,
    tenantId,
    name: 'Amoxicillin',
    dosageForm: 'tablet',
    defaultInstructions: 'Take with food',
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should create a medication with all fields', async () => {
      mockInsertChain([mockMedication]);

      const result = await create(tenantId, {
        name: 'Amoxicillin',
        dosageForm: 'tablet',
        defaultInstructions: 'Take with food',
      });

      expect(db.insert).toHaveBeenCalled();
      expect(result).toEqual(mockMedication);
    });

    it('should create a medication without defaultInstructions', async () => {
      const medWithoutInstructions = {
        ...mockMedication,
        defaultInstructions: null,
      };
      mockInsertChain([medWithoutInstructions]);

      const result = await create(tenantId, {
        name: 'Amoxicillin',
        dosageForm: 'tablet',
      });

      expect(db.insert).toHaveBeenCalled();
      expect(result.defaultInstructions).toBeNull();
    });

    it('should throw ValidationError when name is empty', async () => {
      await expect(
        create(tenantId, {
          name: '',
          dosageForm: 'tablet',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when dosageForm is empty', async () => {
      await expect(
        create(tenantId, {
          name: 'Amoxicillin',
          dosageForm: '',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when name is missing', async () => {
      await expect(
        create(tenantId, {
          dosageForm: 'tablet',
        } as { name: string; dosageForm: string })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('update', () => {
    it('should update a medication name', async () => {
      const updatedMed = { ...mockMedication, name: 'Amoxicillin 500mg' };
      mockUpdateChain([updatedMed]);

      const result = await update(tenantId, medicationId, {
        name: 'Amoxicillin 500mg',
      });

      expect(db.update).toHaveBeenCalled();
      expect(result.name).toBe('Amoxicillin 500mg');
    });

    it('should update a medication dosageForm', async () => {
      const updatedMed = { ...mockMedication, dosageForm: 'syrup' };
      mockUpdateChain([updatedMed]);

      const result = await update(tenantId, medicationId, {
        dosageForm: 'syrup',
      });

      expect(db.update).toHaveBeenCalled();
      expect(result.dosageForm).toBe('syrup');
    });

    it('should update defaultInstructions', async () => {
      const updatedMed = { ...mockMedication, defaultInstructions: 'Take after meals' };
      mockUpdateChain([updatedMed]);

      const result = await update(tenantId, medicationId, {
        defaultInstructions: 'Take after meals',
      });

      expect(db.update).toHaveBeenCalled();
      expect(result.defaultInstructions).toBe('Take after meals');
    });

    it('should throw NotFoundError when medication does not exist', async () => {
      mockUpdateChain([]);

      await expect(
        update(tenantId, 'nonexistent-id', { name: 'Updated' })
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError when name is empty string', async () => {
      await expect(
        update(tenantId, medicationId, { name: '' })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when dosageForm is empty string', async () => {
      await expect(
        update(tenantId, medicationId, { dosageForm: '' })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('deactivate', () => {
    it('should deactivate an existing medication', async () => {
      mockUpdateChain([{ id: medicationId }]);

      await expect(deactivate(tenantId, medicationId)).resolves.toBeUndefined();
      expect(db.update).toHaveBeenCalled();
    });

    it('should throw NotFoundError when medication does not exist', async () => {
      mockUpdateChain([]);

      await expect(
        deactivate(tenantId, 'nonexistent-id')
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('listActive', () => {
    it('should return only active medications for the tenant', async () => {
      const activeMeds = [
        mockMedication,
        { ...mockMedication, id: 'med-002', name: 'Ibuprofen' },
      ];
      mockSelectChain(activeMeds);

      const result = await listActive(tenantId);

      expect(db.select).toHaveBeenCalled();
      expect(result).toHaveLength(2);
      expect(result[0].isActive).toBe(true);
      expect(result[1].isActive).toBe(true);
    });

    it('should return an empty array when no active medications exist', async () => {
      mockSelectChain([]);

      const result = await listActive(tenantId);

      expect(result).toEqual([]);
    });
  });

  describe('listAll', () => {
    it('should return all medications including inactive ones', async () => {
      const allMeds = [
        mockMedication,
        { ...mockMedication, id: 'med-002', name: 'Ibuprofen', isActive: false },
      ];
      mockSelectChain(allMeds);

      const result = await listAll(tenantId);

      expect(db.select).toHaveBeenCalled();
      expect(result).toHaveLength(2);
      expect(result[0].isActive).toBe(true);
      expect(result[1].isActive).toBe(false);
    });

    it('should return an empty array when no medications exist', async () => {
      mockSelectChain([]);

      const result = await listAll(tenantId);

      expect(result).toEqual([]);
    });
  });
});

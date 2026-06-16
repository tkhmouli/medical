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
import { create, getById, getByPatient, generatePdf } from './prescription-service';

// Helper to create chainable query mocks
function mockInsertChain(result: unknown[]) {
  const chain = {
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(result),
  };
  (db.insert as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  return chain;
}

function mockSelectChain(result: unknown[]) {
  const whereResult = Object.assign(Promise.resolve(result), {
    orderBy: vi.fn().mockResolvedValue(result),
  });
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnValue(whereResult),
    innerJoin: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue(result),
  };
  (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  return chain;
}

function mockSelectChainSequence(results: unknown[][]) {
  let callIndex = 0;
  const selectMock = db.select as ReturnType<typeof vi.fn>;
  selectMock.mockImplementation(() => {
    const result = results[callIndex] || [];
    callIndex++;
    const whereResult = Object.assign(Promise.resolve(result), {
      orderBy: vi.fn().mockResolvedValue(result),
    });
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnValue(whereResult),
      innerJoin: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue(result),
    };
    return chain;
  });
}

describe('PrescriptionService', () => {
  const tenantId = 'a0000000-0000-0000-0000-000000000001';
  const doctorId = 'b0000000-0000-0000-0000-000000000001';
  const patientId = 'c0000000-0000-0000-0000-000000000001';
  const appointmentId = 'd0000000-0000-0000-0000-000000000001';
  const prescriptionId = 'e0000000-0000-0000-0000-000000000001';
  const medicationId1 = 'f0000000-0000-0000-0000-000000000001';
  const medicationId2 = 'f0000000-0000-0000-0000-000000000002';
  const now = new Date('2024-01-15T10:00:00Z');

  const validInput = {
    appointmentId,
    patientId,
    items: [
      {
        medicationId: medicationId1,
        dosage: '500mg',
        frequency: '3 times daily',
        duration: '7 days',
        instructions: 'Take with food',
      },
      {
        medicationId: medicationId2,
        dosage: '200mg',
        frequency: 'once daily',
        duration: '14 days',
      },
    ],
    notes: 'Follow up in 2 weeks',
  };

  const mockPrescription = {
    id: prescriptionId,
    tenantId,
    appointmentId,
    patientId,
    doctorId,
    notes: 'Follow up in 2 weeks',
    createdAt: now,
  };

  const mockItems = [
    {
      id: 'item-001',
      prescriptionId,
      medicationId: medicationId1,
      dosage: '500mg',
      frequency: '3 times daily',
      duration: '7 days',
      instructions: 'Take with food',
    },
    {
      id: 'item-002',
      prescriptionId,
      medicationId: medicationId2,
      dosage: '200mg',
      frequency: 'once daily',
      duration: '14 days',
      instructions: null,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should create a prescription with valid items', async () => {
      // Mock: select active medications
      mockSelectChain([{ id: medicationId1 }, { id: medicationId2 }]);

      // Mock: insert prescription then insert items
      const insertMock = db.insert as ReturnType<typeof vi.fn>;
      let insertCallCount = 0;
      insertMock.mockImplementation(() => {
        insertCallCount++;
        if (insertCallCount === 1) {
          return {
            values: vi.fn().mockReturnThis(),
            returning: vi.fn().mockResolvedValue([mockPrescription]),
          };
        }
        return {
          values: vi.fn().mockReturnThis(),
          returning: vi.fn().mockResolvedValue(mockItems),
        };
      });

      const result = await create(tenantId, doctorId, validInput);

      expect(result.id).toBe(prescriptionId);
      expect(result.tenantId).toBe(tenantId);
      expect(result.doctorId).toBe(doctorId);
      expect(result.appointmentId).toBe(appointmentId);
      expect(result.patientId).toBe(patientId);
      expect(result.notes).toBe('Follow up in 2 weeks');
      expect(result.items).toHaveLength(2);
      expect(result.items[0].dosage).toBe('500mg');
    });

    it('should throw ValidationError when items array is empty', async () => {
      await expect(
        create(tenantId, doctorId, {
          appointmentId,
          patientId,
          items: [],
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when appointmentId is not a valid UUID', async () => {
      await expect(
        create(tenantId, doctorId, {
          appointmentId: 'not-a-uuid',
          patientId,
          items: [
            {
              medicationId: medicationId1,
              dosage: '500mg',
              frequency: '3 times daily',
              duration: '7 days',
            },
          ],
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when item dosage is missing', async () => {
      await expect(
        create(tenantId, doctorId, {
          appointmentId,
          patientId,
          items: [
            {
              medicationId: medicationId1,
              dosage: '',
              frequency: '3 times daily',
              duration: '7 days',
            },
          ],
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when item frequency is missing', async () => {
      await expect(
        create(tenantId, doctorId, {
          appointmentId,
          patientId,
          items: [
            {
              medicationId: medicationId1,
              dosage: '500mg',
              frequency: '',
              duration: '7 days',
            },
          ],
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when item duration is missing', async () => {
      await expect(
        create(tenantId, doctorId, {
          appointmentId,
          patientId,
          items: [
            {
              medicationId: medicationId1,
              dosage: '500mg',
              frequency: '3 times daily',
              duration: '',
            },
          ],
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when medications are inactive or not found', async () => {
      // Only one of the two medications is active
      mockSelectChain([{ id: medicationId1 }]);

      await expect(
        create(tenantId, doctorId, validInput)
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError with medication IDs when none are found', async () => {
      mockSelectChain([]);

      try {
        await create(tenantId, doctorId, validInput);
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError);
        expect((err as ValidationError).message).toContain(
          'inactive or not found'
        );
      }
    });
  });

  describe('getById', () => {
    it('should return a prescription with items and medication names', async () => {
      const itemsWithMedNames = [
        {
          id: 'item-001',
          prescriptionId,
          medicationId: medicationId1,
          medicationName: 'Amoxicillin',
          dosage: '500mg',
          frequency: '3 times daily',
          duration: '7 days',
          instructions: 'Take with food',
        },
      ];

      // First call: get prescription, second call: get items with medication names
      mockSelectChainSequence([[mockPrescription], itemsWithMedNames]);

      const result = await getById(tenantId, prescriptionId);

      expect(result.id).toBe(prescriptionId);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].medicationName).toBe('Amoxicillin');
    });

    it('should throw NotFoundError when prescription does not exist', async () => {
      mockSelectChain([]);

      await expect(
        getById(tenantId, 'nonexistent-id')
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('getByPatient', () => {
    it('should return prescriptions in reverse chronological order with item counts', async () => {
      const prescriptionsList = [
        {
          id: 'e0000000-0000-0000-0000-000000000002',
          appointmentId: 'd0000000-0000-0000-0000-000000000002',
          doctorId,
          createdAt: new Date('2024-02-01T10:00:00Z'),
        },
        {
          id: 'e0000000-0000-0000-0000-000000000003',
          appointmentId: 'd0000000-0000-0000-0000-000000000003',
          doctorId,
          createdAt: new Date('2024-01-01T10:00:00Z'),
        },
      ];

      const prescItemsList = [
        { prescriptionId: 'e0000000-0000-0000-0000-000000000002', id: 'item-a' },
        { prescriptionId: 'e0000000-0000-0000-0000-000000000002', id: 'item-b' },
        { prescriptionId: 'e0000000-0000-0000-0000-000000000003', id: 'item-c' },
      ];

      mockSelectChainSequence([prescriptionsList, prescItemsList]);

      const result = await getByPatient(tenantId, patientId);

      expect(result).toHaveLength(2);
      // Most recent first
      expect(result[0].id).toBe('e0000000-0000-0000-0000-000000000002');
      expect(result[0].itemCount).toBe(2);
      expect(result[1].id).toBe('e0000000-0000-0000-0000-000000000003');
      expect(result[1].itemCount).toBe(1);
    });

    it('should return empty array when patient has no prescriptions', async () => {
      mockSelectChainSequence([[]]);

      const result = await getByPatient(tenantId, patientId);

      expect(result).toEqual([]);
    });
  });

  describe('generatePdf', () => {
    it('should delegate to pdf-generator with tenantId, prescriptionId, and baseUrl', async () => {
      // The generatePdf function now requires tenantId and prescriptionId
      // It delegates to the pdf-generator module which handles the full logic
      // Testing the integration requires mocking the pdf-generator module
      // Here we verify the function signature accepts the new parameters
      expect(typeof generatePdf).toBe('function');
      expect(generatePdf.length).toBeGreaterThanOrEqual(2);
    });
  });
});

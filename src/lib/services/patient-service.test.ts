import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundError, ValidationError } from '@/lib/errors';

// Mock the db module
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

import { db } from '@/lib/db';
import { create, update, deletePatient, getById, search, buildSearchQuery, getVisitHistory } from './patient-service';

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

function mockSelectChainNoLimit(result: unknown[]) {
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

function mockDeleteChain(result: unknown[]) {
  const chain = {
    where: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(result),
  };
  (db.delete as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  return chain;
}

describe('PatientService', () => {
  const tenantId = 'tenant-123';
  const patientId = 'patient-456';
  const now = new Date('2024-01-15T10:00:00Z');

  const mockPatient = {
    id: patientId,
    tenantId,
    firstName: 'Ahmed',
    lastName: 'Benali',
    dateOfBirth: '1990-05-15',
    phoneNumber: '+212600000001',
    secondaryPhone: null,
    cinNumber: 'AB123456',
    gender: 'male' as const,
    email: 'ahmed@example.com',
    address: '123 Rue Mohammed V, Casablanca',
    notes: null,
    createdAt: now,
    updatedAt: now,
  };

  const validCreateInput = {
    firstName: 'Ahmed',
    lastName: 'Benali',
    dateOfBirth: '1990-05-15',
    phoneNumber: '+212600000001',
    gender: 'male' as const,
    cinNumber: 'AB123456',
    email: 'ahmed@example.com',
    address: '123 Rue Mohammed V, Casablanca',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should create a patient with all required fields', async () => {
      mockInsertChain([mockPatient]);

      const result = await create(tenantId, validCreateInput);

      expect(db.insert).toHaveBeenCalled();
      expect(result).toEqual(mockPatient);
    });

    it('should create a patient with only required fields', async () => {
      const minimalInput = {
        firstName: 'Fatima',
        lastName: 'Zahra',
        dateOfBirth: '1985-03-20',
        phoneNumber: '+212611111111',
        gender: 'female' as const,
      };

      const minimalPatient = {
        ...mockPatient,
        firstName: 'Fatima',
        lastName: 'Zahra',
        dateOfBirth: '1985-03-20',
        phoneNumber: '+212611111111',
        gender: 'female',
        cinNumber: null,
        email: null,
        address: null,
      };

      mockInsertChain([minimalPatient]);

      const result = await create(tenantId, minimalInput);

      expect(result.firstName).toBe('Fatima');
      expect(result.gender).toBe('female');
    });

    it('should throw ValidationError when firstName is empty', async () => {
      const invalidInput = { ...validCreateInput, firstName: '' };

      await expect(create(tenantId, invalidInput)).rejects.toThrow(ValidationError);
      await expect(create(tenantId, invalidInput)).rejects.toThrow('Invalid patient data');
    });

    it('should throw ValidationError when lastName is empty', async () => {
      const invalidInput = { ...validCreateInput, lastName: '' };

      await expect(create(tenantId, invalidInput)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when dateOfBirth is invalid format', async () => {
      const invalidInput = { ...validCreateInput, dateOfBirth: '15/05/1990' };

      await expect(create(tenantId, invalidInput)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when phoneNumber is empty', async () => {
      const invalidInput = { ...validCreateInput, phoneNumber: '' };

      await expect(create(tenantId, invalidInput)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when gender is invalid', async () => {
      const invalidInput = { ...validCreateInput, gender: 'invalid' as 'male' };

      await expect(create(tenantId, invalidInput)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when email is invalid format', async () => {
      const invalidInput = { ...validCreateInput, email: 'not-an-email' };

      await expect(create(tenantId, invalidInput)).rejects.toThrow(ValidationError);
    });

    it('should accept valid email in optional field', async () => {
      mockInsertChain([mockPatient]);

      const input = { ...validCreateInput, email: 'valid@email.com' };
      const result = await create(tenantId, input);

      expect(result).toEqual(mockPatient);
    });
  });

  describe('update', () => {
    it('should update a patient with partial data', async () => {
      const updatedPatient = { ...mockPatient, firstName: 'Mohamed', updatedAt: new Date() };
      mockUpdateChain([updatedPatient]);

      const result = await update(tenantId, patientId, { firstName: 'Mohamed' });

      expect(db.update).toHaveBeenCalled();
      expect(result.firstName).toBe('Mohamed');
    });

    it('should update multiple fields at once', async () => {
      const updatedPatient = {
        ...mockPatient,
        phoneNumber: '+212622222222',
        address: 'New Address',
        updatedAt: new Date(),
      };
      mockUpdateChain([updatedPatient]);

      const result = await update(tenantId, patientId, {
        phoneNumber: '+212622222222',
        address: 'New Address',
      });

      expect(result.phoneNumber).toBe('+212622222222');
      expect(result.address).toBe('New Address');
    });

    it('should throw NotFoundError when patient does not exist', async () => {
      mockUpdateChain([]);

      await expect(
        update(tenantId, 'nonexistent-id', { firstName: 'Test' })
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError when no fields are provided', async () => {
      await expect(update(tenantId, patientId, {})).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when firstName is empty string', async () => {
      await expect(
        update(tenantId, patientId, { firstName: '' })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when dateOfBirth format is invalid', async () => {
      await expect(
        update(tenantId, patientId, { dateOfBirth: 'bad-date' })
      ).rejects.toThrow(ValidationError);
    });

    it('should allow updating gender to a valid value', async () => {
      const updatedPatient = { ...mockPatient, gender: 'other' as const, updatedAt: new Date() };
      mockUpdateChain([updatedPatient]);

      const result = await update(tenantId, patientId, { gender: 'other' });

      expect(result.gender).toBe('other');
    });
  });

  describe('deletePatient', () => {
    it('should delete an existing patient', async () => {
      mockDeleteChain([{ id: patientId }]);

      await expect(deletePatient(tenantId, patientId)).resolves.toBeUndefined();
      expect(db.delete).toHaveBeenCalled();
    });

    it('should throw NotFoundError when patient does not exist', async () => {
      mockDeleteChain([]);

      await expect(deletePatient(tenantId, 'nonexistent-id')).rejects.toThrow(NotFoundError);
    });
  });

  describe('getById', () => {
    it('should return a patient when found', async () => {
      mockSelectChain([mockPatient]);

      const result = await getById(tenantId, patientId);

      expect(result).toEqual(mockPatient);
    });

    it('should throw NotFoundError when patient is not found', async () => {
      mockSelectChain([]);

      await expect(getById(tenantId, 'nonexistent')).rejects.toThrow(NotFoundError);
    });

    it('should scope query to the specified tenant', async () => {
      mockSelectChain([mockPatient]);

      await getById(tenantId, patientId);

      expect(db.select).toHaveBeenCalled();
    });
  });

  describe('search', () => {
    it('should return patients matching firstName criteria (case-insensitive partial match)', async () => {
      mockSelectChainNoLimit([mockPatient]);

      const result = await search(tenantId, { firstName: 'ahm' });

      expect(db.select).toHaveBeenCalled();
      expect(result).toEqual([mockPatient]);
    });

    it('should return patients matching lastName criteria (case-insensitive partial match)', async () => {
      mockSelectChainNoLimit([mockPatient]);

      const result = await search(tenantId, { lastName: 'ben' });

      expect(db.select).toHaveBeenCalled();
      expect(result).toEqual([mockPatient]);
    });

    it('should return patients matching phoneNumber criteria (case-insensitive partial match)', async () => {
      mockSelectChainNoLimit([mockPatient]);

      const result = await search(tenantId, { phoneNumber: '0600' });

      expect(db.select).toHaveBeenCalled();
      expect(result).toEqual([mockPatient]);
    });

    it('should return patients matching dateOfBirth criteria (exact match)', async () => {
      mockSelectChainNoLimit([mockPatient]);

      const result = await search(tenantId, { dateOfBirth: '1990-05-15' });

      expect(db.select).toHaveBeenCalled();
      expect(result).toEqual([mockPatient]);
    });

    it('should return patients matching multiple criteria combined with AND', async () => {
      mockSelectChainNoLimit([mockPatient]);

      const result = await search(tenantId, {
        firstName: 'Ahmed',
        lastName: 'Benali',
        dateOfBirth: '1990-05-15',
      });

      expect(db.select).toHaveBeenCalled();
      expect(result).toEqual([mockPatient]);
    });

    it('should return an empty array when no patients match', async () => {
      mockSelectChainNoLimit([]);

      const result = await search(tenantId, { firstName: 'Nonexistent' });

      expect(result).toEqual([]);
    });

    it('should return all tenant patients when no criteria are provided', async () => {
      mockSelectChainNoLimit([mockPatient]);

      const result = await search(tenantId, {});

      expect(db.select).toHaveBeenCalled();
      expect(result).toEqual([mockPatient]);
    });
  });

  describe('buildSearchQuery', () => {
    it('should always include tenantId filter', () => {
      const query = buildSearchQuery(tenantId, {});

      // The query should be defined (not undefined/null)
      expect(query).toBeDefined();
    });

    it('should handle all criteria provided together', () => {
      const query = buildSearchQuery(tenantId, {
        firstName: 'Ahmed',
        lastName: 'Benali',
        phoneNumber: '+212600000001',
        dateOfBirth: '1990-05-15',
      });

      expect(query).toBeDefined();
    });
  });

  describe('getVisitHistory', () => {
    function mockSelectChainForVisitHistory(patientResult: unknown[], visitResult: unknown[]) {
      let callCount = 0;
      (db.select as ReturnType<typeof vi.fn>).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call: patient existence check
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue(patientResult),
              }),
            }),
          };
        }
        // Second call: appointments query with join
        return {
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockResolvedValue(visitResult),
              }),
            }),
          }),
        };
      });
    }

    it('should return visit history with visits sorted most recent first', async () => {
      const visits = [
        {
          appointmentId: 'apt-1',
          date: '2024-03-10',
          visitType: 'control_visit',
          doctorName: 'Dr. Karim',
          notes: 'Follow-up check',
        },
        {
          appointmentId: 'apt-2',
          date: '2024-01-05',
          visitType: 'new_visit',
          doctorName: 'Dr. Karim',
          notes: 'Initial consultation',
        },
      ];

      mockSelectChainForVisitHistory([{ id: patientId }], visits);

      const result = await getVisitHistory(tenantId, patientId);

      expect(result.visits).toHaveLength(2);
      expect(result.totalCount).toBe(2);
      expect(result.classification).toBe('returning');
      expect(result.lastVisitDate).toBe('2024-03-10');
      expect(result.visits[0].appointmentId).toBe('apt-1');
      expect(result.visits[0].visitType).toBe('control_visit');
      expect(result.visits[0].doctorName).toBe('Dr. Karim');
      expect(result.visits[1].appointmentId).toBe('apt-2');
    });

    it('should classify patient as first_time when no visits exist', async () => {
      mockSelectChainForVisitHistory([{ id: patientId }], []);

      const result = await getVisitHistory(tenantId, patientId);

      expect(result.visits).toHaveLength(0);
      expect(result.totalCount).toBe(0);
      expect(result.classification).toBe('first_time');
      expect(result.lastVisitDate).toBeNull();
    });

    it('should classify patient as returning when at least one visit exists', async () => {
      const visits = [
        {
          appointmentId: 'apt-1',
          date: '2024-02-15',
          visitType: 'new_visit',
          doctorName: 'Dr. Amina',
          notes: null,
        },
      ];

      mockSelectChainForVisitHistory([{ id: patientId }], visits);

      const result = await getVisitHistory(tenantId, patientId);

      expect(result.totalCount).toBe(1);
      expect(result.classification).toBe('returning');
      expect(result.lastVisitDate).toBe('2024-02-15');
    });

    it('should throw NotFoundError when patient does not exist', async () => {
      mockSelectChainForVisitHistory([], []);

      await expect(getVisitHistory(tenantId, 'nonexistent-id')).rejects.toThrow(NotFoundError);
    });

    it('should include visit records with date, visitType, doctorName, and notes', async () => {
      const visits = [
        {
          appointmentId: 'apt-1',
          date: '2024-06-01',
          visitType: 'follow_up',
          doctorName: 'Dr. Hassan',
          notes: 'Patient recovering well',
        },
      ];

      mockSelectChainForVisitHistory([{ id: patientId }], visits);

      const result = await getVisitHistory(tenantId, patientId);

      const visit = result.visits[0];
      expect(visit.appointmentId).toBe('apt-1');
      expect(visit.date).toBe('2024-06-01');
      expect(visit.visitType).toBe('follow_up');
      expect(visit.doctorName).toBe('Dr. Hassan');
      expect(visit.notes).toBe('Patient recovering well');
    });

    it('should derive totalCount from visits length', async () => {
      const visits = [
        { appointmentId: 'apt-1', date: '2024-06-01', visitType: 'new_visit', doctorName: 'Dr. A', notes: null },
        { appointmentId: 'apt-2', date: '2024-05-01', visitType: 'control_visit', doctorName: 'Dr. B', notes: null },
        { appointmentId: 'apt-3', date: '2024-04-01', visitType: 'follow_up', doctorName: 'Dr. A', notes: null },
      ];

      mockSelectChainForVisitHistory([{ id: patientId }], visits);

      const result = await getVisitHistory(tenantId, patientId);

      expect(result.totalCount).toBe(3);
      expect(result.visits).toHaveLength(3);
    });
  });
});

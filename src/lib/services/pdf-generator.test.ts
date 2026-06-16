import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundError } from '@/lib/errors';

// Mock the db module
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

// Mock the qrcode module
vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,mockQRCodeData'),
  },
}));

// Mock the prescription-service getById
vi.mock('./prescription-service', () => ({
  getById: vi.fn(),
}));

import { db } from '@/lib/db';
import { getById } from './prescription-service';
import { generatePrescriptionData, generatePrescriptionPdf } from './pdf-generator';
import QRCode from 'qrcode';

// Helper to create chainable select mocks that resolve from .where()
function mockSelectChainSequence(results: unknown[][]) {
  let callIndex = 0;
  const selectMock = db.select as ReturnType<typeof vi.fn>;
  selectMock.mockImplementation(() => {
    const result = results[callIndex] || [];
    callIndex++;
    return {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(result),
    };
  });
}

describe('PdfGenerator', () => {
  const tenantId = 'tenant-123';
  const prescriptionId = 'presc-001';
  const doctorId = 'doctor-456';
  const patientId = 'patient-789';
  const baseUrl = 'https://clinic.example.com';

  const mockPrescription = {
    id: prescriptionId,
    tenantId,
    appointmentId: 'appt-101',
    patientId,
    doctorId,
    notes: 'Take with food',
    createdAt: new Date('2024-03-15T10:00:00Z'),
    items: [
      {
        id: 'item-001',
        prescriptionId,
        medicationId: 'med-001',
        medicationName: 'Amoxicillin',
        dosage: '500mg',
        frequency: '3 times daily',
        duration: '7 days',
        instructions: 'Take after meals',
      },
      {
        id: 'item-002',
        prescriptionId,
        medicationId: 'med-002',
        medicationName: 'Ibuprofen',
        dosage: '400mg',
        frequency: 'twice daily',
        duration: '5 days',
        instructions: null,
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (getById as ReturnType<typeof vi.fn>).mockResolvedValue(mockPrescription);
  });

  describe('generatePrescriptionData', () => {
    it('should return full prescription data with doctor name, patient name, and QR code', async () => {
      mockSelectChainSequence([
        [{ name: 'Dr. Ahmed Benali' }],
        [{ firstName: 'Youssef', lastName: 'El Amrani' }],
      ]);

      const result = await generatePrescriptionData(tenantId, prescriptionId, baseUrl);

      expect(result.prescription).toEqual(mockPrescription);
      expect(result.doctorName).toBe('Dr. Ahmed Benali');
      expect(result.patientName).toBe('Youssef El Amrani');
      expect(result.qrCodeDataUrl).toBe('data:image/png;base64,mockQRCodeData');
      expect(result.generatedAt).toBeDefined();
      expect(new Date(result.generatedAt).getTime()).not.toBeNaN();
    });

    it('should call getById with correct tenantId and prescriptionId', async () => {
      mockSelectChainSequence([
        [{ name: 'Dr. Smith' }],
        [{ firstName: 'John', lastName: 'Doe' }],
      ]);

      await generatePrescriptionData(tenantId, prescriptionId, baseUrl);

      expect(getById).toHaveBeenCalledWith(tenantId, prescriptionId);
    });

    it('should generate QR code with correct URL', async () => {
      mockSelectChainSequence([
        [{ name: 'Dr. Smith' }],
        [{ firstName: 'John', lastName: 'Doe' }],
      ]);

      await generatePrescriptionData(tenantId, prescriptionId, baseUrl);

      expect(QRCode.toDataURL).toHaveBeenCalledWith(
        `${baseUrl}/prescriptions/${prescriptionId}`,
        {
          errorCorrectionLevel: 'M',
          margin: 2,
          width: 150,
        }
      );
    });

    it('should throw NotFoundError when doctor is not found', async () => {
      mockSelectChainSequence([
        [], // No doctor found
        [{ firstName: 'John', lastName: 'Doe' }],
      ]);

      await expect(
        generatePrescriptionData(tenantId, prescriptionId, baseUrl)
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when patient is not found', async () => {
      mockSelectChainSequence([
        [{ name: 'Dr. Smith' }],
        [], // No patient found
      ]);

      await expect(
        generatePrescriptionData(tenantId, prescriptionId, baseUrl)
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('generatePrescriptionPdf', () => {
    it('should return a Buffer with prescription content', async () => {
      mockSelectChainSequence([
        [{ name: 'Dr. Ahmed Benali' }],
        [{ firstName: 'Youssef', lastName: 'El Amrani' }],
      ]);

      const result = await generatePrescriptionPdf(tenantId, prescriptionId, baseUrl);

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should include doctor name in the PDF content', async () => {
      mockSelectChainSequence([
        [{ name: 'Dr. Ahmed Benali' }],
        [{ firstName: 'Youssef', lastName: 'El Amrani' }],
      ]);

      const result = await generatePrescriptionPdf(tenantId, prescriptionId, baseUrl);
      const content = result.toString('utf-8');

      expect(content).toContain('Dr. Ahmed Benali');
    });

    it('should include patient name in the PDF content', async () => {
      mockSelectChainSequence([
        [{ name: 'Dr. Ahmed Benali' }],
        [{ firstName: 'Youssef', lastName: 'El Amrani' }],
      ]);

      const result = await generatePrescriptionPdf(tenantId, prescriptionId, baseUrl);
      const content = result.toString('utf-8');

      expect(content).toContain('Youssef El Amrani');
    });

    it('should include medication details in the PDF content', async () => {
      mockSelectChainSequence([
        [{ name: 'Dr. Smith' }],
        [{ firstName: 'Jane', lastName: 'Doe' }],
      ]);

      const result = await generatePrescriptionPdf(tenantId, prescriptionId, baseUrl);
      const content = result.toString('utf-8');

      expect(content).toContain('Amoxicillin');
      expect(content).toContain('500mg');
      expect(content).toContain('3 times daily');
      expect(content).toContain('7 days');
      expect(content).toContain('Take after meals');
      expect(content).toContain('Ibuprofen');
      expect(content).toContain('400mg');
      expect(content).toContain('twice daily');
      expect(content).toContain('5 days');
    });

    it('should include prescription notes in the PDF content', async () => {
      mockSelectChainSequence([
        [{ name: 'Dr. Smith' }],
        [{ firstName: 'Jane', lastName: 'Doe' }],
      ]);

      const result = await generatePrescriptionPdf(tenantId, prescriptionId, baseUrl);
      const content = result.toString('utf-8');

      expect(content).toContain('Take with food');
    });

    it('should include QR code reference in the PDF content', async () => {
      mockSelectChainSequence([
        [{ name: 'Dr. Smith' }],
        [{ firstName: 'Jane', lastName: 'Doe' }],
      ]);

      const result = await generatePrescriptionPdf(tenantId, prescriptionId, baseUrl);
      const content = result.toString('utf-8');

      expect(content).toContain('QR Code:');
      expect(content).toContain('data:image/png;base64');
    });

    it('should include date in the PDF content', async () => {
      mockSelectChainSequence([
        [{ name: 'Dr. Smith' }],
        [{ firstName: 'Jane', lastName: 'Doe' }],
      ]);

      const result = await generatePrescriptionPdf(tenantId, prescriptionId, baseUrl);
      const content = result.toString('utf-8');

      // The date should be formatted as a readable date string
      expect(content).toContain('March');
      expect(content).toContain('2024');
    });
  });
});

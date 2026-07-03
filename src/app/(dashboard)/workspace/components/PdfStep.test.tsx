import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PdfStep from './PdfStep';
import type { VisitContextState, VisitContextAction, WorkflowStep } from './visit-context';
import type { Role } from '@/lib/auth/permissions';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createMockState(overrides: Partial<VisitContextState> = {}): VisitContextState {
  return {
    activeStep: 'pdf',
    completedSteps: new Set<WorkflowStep>(['patient', 'appointment', 'visit_notes', 'prescription']),
    patient: { id: 'p1', firstName: 'John', lastName: 'Doe', phoneNumber: '0600000000', dateOfBirth: '1990-01-01' },
    appointment: { id: 'a1', date: '2024-01-15', startTime: '10:00', duration: 30, visitType: 'new_visit', doctorId: 'd1', doctorName: 'Dr. Smith' },
    appointmentSkipped: false,
    visitNotes: 'Patient presents with...',
    prescriptionId: 'rx-123',
    prescriptionSkipped: false,
    prescriptionItems: [],
    pdfGenerated: false,
    pdfDownloaded: false,
    ...overrides,
  };
}

function createMockUser(role: Role = 'Doctor') {
  return { id: 'u1', name: 'Dr. Smith', email: 'dr@clinic.com', role, tenantId: 't1' };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PdfStep', () => {
  let mockDispatch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockDispatch = vi.fn();
    vi.restoreAllMocks();
  });

  describe('when prescriptionId is present', () => {
    it('should render Generate PDF enabled and Download PDF disabled', () => {
      render(
        <PdfStep state={createMockState()} dispatch={mockDispatch} user={createMockUser()} />
      );

      const generateBtn = screen.getByRole('button', { name: /generate pdf/i });
      const downloadBtn = screen.getByRole('button', { name: /download pdf/i });

      expect(generateBtn).toBeEnabled();
      expect(downloadBtn).toBeDisabled();
    });

    it('should render Continue button disabled initially', () => {
      render(
        <PdfStep state={createMockState()} dispatch={mockDispatch} user={createMockUser()} />
      );

      const continueBtn = screen.getByRole('button', { name: /^continue$/i });
      expect(continueBtn).toBeDisabled();
    });

    it('should call fetch on Generate PDF click and dispatch SET_PDF_GENERATED on success', async () => {
      const mockBlob = new Blob(['pdf-content'], { type: 'application/pdf' });
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      render(
        <PdfStep state={createMockState()} dispatch={mockDispatch} user={createMockUser()} />
      );

      fireEvent.click(screen.getByRole('button', { name: /generate pdf/i }));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/prescriptions/rx-123/pdf');
      });

      await waitFor(() => {
        expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_PDF_GENERATED' });
      });
    });

    it('should show error and increment retry count on generation failure', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 500 });

      render(
        <PdfStep state={createMockState()} dispatch={mockDispatch} user={createMockUser()} />
      );

      fireEvent.click(screen.getByRole('button', { name: /generate pdf/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      expect(screen.getByText(/attempt 1 of 3 failed/i)).toBeInTheDocument();
    });

    it('should disable Generate button and show support message after 3 failures', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });

      render(
        <PdfStep state={createMockState()} dispatch={mockDispatch} user={createMockUser()} />
      );

      // Fail 3 times
      for (let i = 0; i < 3; i++) {
        const generateBtn = screen.getByRole('button', { name: /generate pdf/i });
        if (generateBtn.hasAttribute('disabled')) break;
        fireEvent.click(generateBtn);
        await waitFor(() => {
          expect(screen.getByRole('alert')).toBeInTheDocument();
        });
      }

      await waitFor(() => {
        expect(screen.getByText(/contact support/i)).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /generate pdf/i })).toBeDisabled();
    });
  });

  describe('when prescription was skipped', () => {
    it('should show "No prescription" message and "Continue to History" button', () => {
      render(
        <PdfStep
          state={createMockState({ prescriptionId: null, prescriptionSkipped: true })}
          dispatch={mockDispatch}
          user={createMockUser()}
        />
      );

      expect(screen.getByText(/no prescription was created/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /continue to history/i })).toBeEnabled();
    });

    it('should dispatch ADVANCE_STEP when "Continue to History" is clicked', () => {
      render(
        <PdfStep
          state={createMockState({ prescriptionId: null, prescriptionSkipped: true })}
          dispatch={mockDispatch}
          user={createMockUser()}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /continue to history/i }));
      expect(mockDispatch).toHaveBeenCalledWith({ type: 'ADVANCE_STEP', payload: { role: 'Doctor' } });
    });
  });

  describe('Continue button behavior', () => {
    it('should enable Continue when pdfDownloaded is true', () => {
      render(
        <PdfStep
          state={createMockState({ pdfDownloaded: true })}
          dispatch={mockDispatch}
          user={createMockUser()}
        />
      );

      const continueBtn = screen.getByRole('button', { name: /^continue$/i });
      expect(continueBtn).toBeEnabled();
    });

    it('should dispatch ADVANCE_STEP when Continue is clicked', () => {
      render(
        <PdfStep
          state={createMockState({ pdfDownloaded: true })}
          dispatch={mockDispatch}
          user={createMockUser()}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));
      expect(mockDispatch).toHaveBeenCalledWith({ type: 'ADVANCE_STEP', payload: { role: 'Doctor' } });
    });
  });

  describe('Download PDF', () => {
    it('should dispatch SET_PDF_DOWNLOADED when download is clicked after generation', async () => {
      const mockBlob = new Blob(['pdf-content'], { type: 'application/pdf' });
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      // Mock URL.createObjectURL and revokeObjectURL
      global.URL.createObjectURL = vi.fn().mockReturnValue('blob:http://localhost/fake-url');
      global.URL.revokeObjectURL = vi.fn();

      render(
        <PdfStep state={createMockState()} dispatch={mockDispatch} user={createMockUser()} />
      );

      // Generate PDF first
      fireEvent.click(screen.getByRole('button', { name: /generate pdf/i }));

      await waitFor(() => {
        expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_PDF_GENERATED' });
      });

      // Now Download should be enabled
      const downloadBtn = screen.getByRole('button', { name: /download pdf/i });
      await waitFor(() => {
        expect(downloadBtn).toBeEnabled();
      });

      fireEvent.click(downloadBtn);

      expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_PDF_DOWNLOADED' });
    });
  });
});

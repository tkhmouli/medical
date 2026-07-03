'use client';

import { useState, useCallback } from 'react';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import type { VisitContextState, VisitContextAction } from './visit-context';
import type { Role } from '@/lib/auth/permissions';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface PdfStepProps {
  state: VisitContextState;
  dispatch: React.Dispatch<VisitContextAction>;
  user: {
    id: string;
    name: string;
    email: string;
    role: Role;
    tenantId: string;
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_RETRIES = 3;

// ─── Translation keys (hardcoded English for now) ─────────────────────────────

const t = {
  title: 'PDF Generation',
  description: 'Generate and download the prescription PDF.',
  generatePdf: 'Generate PDF',
  downloadPdf: 'Download PDF',
  continue: 'Continue',
  continueToHistory: 'Continue to History',
  noPrescription: 'No prescription was created for this visit.',
  generating: 'Generating PDF...',
  downloading: 'Downloading PDF...',
  generationSuccess: 'PDF generated successfully. You can now download it.',
  generationFailed: 'PDF generation failed. Please try again.',
  contactSupport:
    'PDF generation failed after multiple attempts. Please contact support for assistance.',
  retryCount: (count: number) =>
    `Attempt ${count} of ${MAX_RETRIES} failed.`,
};

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * PdfStep handles PDF generation and download for a prescription.
 * - If prescriptionId is non-null: shows Generate/Download workflow
 * - If prescription was skipped: shows message and Continue to History action
 * - Retry logic: up to 3 generation attempts before disabling
 * - Not rendered for Medical_Assistant role (handled by WorkspaceClient)
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8
 */
export default function PdfStep({ state, dispatch, user }: PdfStepProps) {
  const [retryCount, setRetryCount] = useState(0);
  const [pdfGenerated, setPdfGenerated] = useState(false);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prescriptionId = state.prescriptionId;
  const prescriptionSkipped = state.prescriptionSkipped;

  // ─── Generate PDF handler ─────────────────────────────────────────────────

  const handleGeneratePdf = useCallback(async () => {
    if (!prescriptionId || loading) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/prescriptions/${prescriptionId}/pdf`);

      if (!response.ok) {
        throw new Error(`PDF generation failed with status ${response.status}`);
      }

      const blob = await response.blob();
      setPdfBlob(blob);
      setPdfGenerated(true);
      dispatch({ type: 'SET_PDF_GENERATED' });
    } catch (err) {
      const newRetryCount = retryCount + 1;
      setRetryCount(newRetryCount);

      if (newRetryCount >= MAX_RETRIES) {
        setError(t.contactSupport);
      } else {
        setError(t.retryCount(newRetryCount));
      }
    } finally {
      setLoading(false);
    }
  }, [prescriptionId, loading, retryCount, dispatch]);

  // ─── Download PDF handler ─────────────────────────────────────────────────

  const handleDownloadPdf = useCallback(() => {
    if (!pdfBlob || !prescriptionId) return;

    const url = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `prescription-${prescriptionId}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    dispatch({ type: 'SET_PDF_DOWNLOADED' });
  }, [pdfBlob, prescriptionId, dispatch]);

  // ─── Continue handler ─────────────────────────────────────────────────────

  const handleContinue = useCallback(() => {
    dispatch({ type: 'ADVANCE_STEP', payload: { role: user.role } });
  }, [dispatch, user.role]);

  // ─── Prescription was skipped ─────────────────────────────────────────────

  if (prescriptionSkipped) {
    return (
      <div
        data-testid="step-panel-pdf"
        className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
      >
        <h2 className="text-lg font-semibold text-gray-900">{t.title}</h2>
        <p className="mt-2 text-sm text-gray-600">{t.description}</p>

        <div className="mt-6 rounded-md bg-yellow-50 p-4">
          <p className="text-sm text-yellow-800">{t.noPrescription}</p>
        </div>

        <div className="mt-6">
          <button
            type="button"
            onClick={handleContinue}
            className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {t.continueToHistory}
          </button>
        </div>
      </div>
    );
  }

  // ─── PDF generation/download workflow ─────────────────────────────────────

  const isGenerateDisabled = loading || pdfGenerated || retryCount >= MAX_RETRIES;
  const isDownloadDisabled = loading || !pdfGenerated;
  const isContinueDisabled = false; // Always allow continue — doctor can skip PDF

  return (
    <div
      data-testid="step-panel-pdf"
      className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
    >
      <h2 className="text-lg font-semibold text-gray-900">{t.title}</h2>
      <p className="mt-2 text-sm text-gray-600">{t.description}</p>

      {/* Loading indicator */}
      {loading && (
        <div className="mt-4">
          <LoadingSpinner size="sm" label={pdfGenerated ? t.downloading : t.generating} />
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mt-4 rounded-md bg-red-50 p-4" role="alert">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Success message */}
      {pdfGenerated && !loading && !error && (
        <div className="mt-4 rounded-md bg-green-50 p-4">
          <p className="text-sm text-green-800">{t.generationSuccess}</p>
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-6 flex flex-wrap gap-3">
        {/* Generate PDF button */}
        <button
          type="button"
          onClick={handleGeneratePdf}
          disabled={isGenerateDisabled}
          className="inline-flex items-center rounded-md px-4 py-2 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300 disabled:hover:bg-blue-300"
        >
          {t.generatePdf}
        </button>

        {/* Download PDF button */}
        <button
          type="button"
          onClick={handleDownloadPdf}
          disabled={isDownloadDisabled}
          className="inline-flex items-center rounded-md px-4 py-2 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 bg-green-600 text-white hover:bg-green-700 disabled:bg-green-300 disabled:hover:bg-green-300"
        >
          {t.downloadPdf}
        </button>
      </div>

      {/* Continue button */}
      <div className="mt-6 border-t border-gray-200 pt-4">
        <button
          type="button"
          onClick={handleContinue}
          disabled={isContinueDisabled}
          className="inline-flex items-center rounded-md px-4 py-2 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300 disabled:hover:bg-blue-300"
        >
          {t.continue}
        </button>
      </div>
    </div>
  );
}

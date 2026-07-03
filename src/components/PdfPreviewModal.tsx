'use client';

import { useEffect, useRef } from 'react';

interface PdfPreviewModalProps {
  open: boolean;
  onClose: () => void;
  pdfUrl: string | null;
  title?: string;
}

/**
 * Modal that displays a PDF preview with a Print button.
 * The PDF is rendered in an iframe. The user can print directly from the modal.
 */
export function PdfPreviewModal({ open, onClose, pdfUrl, title = 'Document Preview' }: PdfPreviewModalProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open || !pdfUrl) return null;

  const handlePrint = () => {
    const iframe = iframeRef.current;
    if (iframe?.contentWindow) {
      iframe.contentWindow.print();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative z-10 flex h-[90vh] w-[90vw] max-w-4xl flex-col rounded-lg bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
            >
              🖨️ Print
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              aria-label="Close preview"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* PDF iframe */}
        <div className="flex-1 overflow-hidden p-2">
          <iframe
            ref={iframeRef}
            src={pdfUrl}
            className="h-full w-full rounded border border-gray-200"
            title="PDF Preview"
          />
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback, createContext, useContext, useRef } from 'react';

// ----------------------------
// Toast Types
// ----------------------------

type ToastType = 'success' | 'error';

interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  showToast: (type: ToastType, message: string) => void;
}

// ----------------------------
// Toast Context
// ----------------------------

const ToastContext = createContext<ToastContextValue | null>(null);

/**
 * Hook to access the toast notification system.
 * Must be used within a `ToastProvider`.
 *
 * Usage:
 * ```tsx
 * const { showToast } = useToast();
 * showToast('success', 'Patient created successfully');
 * ```
 */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

// ----------------------------
// Toast Provider
// ----------------------------

interface ToastProviderProps {
  children: React.ReactNode;
}

/**
 * Provides toast notification context to the application.
 * Wrap your app (or layout) with this provider to enable `useToast()`.
 *
 * Validates: Requirements 17.4
 */
export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((type: ToastType, message: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    setToasts((prev) => [...prev, { id, type, message }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast container - fixed top-right */}
      <div
        className="pointer-events-none fixed right-4 top-4 z-50 flex flex-col gap-2"
        aria-live="polite"
        aria-label="Notifications"
      >
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onDismiss={dismissToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ----------------------------
// Individual Toast Component
// ----------------------------

interface ToastProps {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
  /** Auto-dismiss duration in ms. Defaults to 5000ms */
  autoDismissMs?: number;
}

function Toast({ toast, onDismiss, autoDismissMs = 5000 }: ToastProps) {
  const [exiting, setExiting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDismiss = useCallback(() => {
    setExiting(true);
    // Wait for exit animation before removing from DOM
    setTimeout(() => onDismiss(toast.id), 200);
  }, [onDismiss, toast.id]);

  useEffect(() => {
    timerRef.current = setTimeout(handleDismiss, autoDismissMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [autoDismissMs, handleDismiss]);

  const isSuccess = toast.type === 'success';

  return (
    <div
      role="alert"
      className={`pointer-events-auto flex w-80 items-start gap-3 rounded-lg border p-4 shadow-lg transition-all duration-200 ${
        exiting ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'
      } ${
        isSuccess
          ? 'border-green-200 bg-green-50 text-green-900'
          : 'border-red-200 bg-red-50 text-red-900'
      }`}
    >
      {/* Icon */}
      <div className="flex-shrink-0">
        {isSuccess ? <SuccessIcon /> : <ErrorIcon />}
      </div>

      {/* Message */}
      <p className="flex-1 text-sm font-medium">{toast.message}</p>

      {/* Dismiss button */}
      <button
        type="button"
        onClick={handleDismiss}
        className={`flex-shrink-0 rounded p-1 transition-colors ${
          isSuccess ? 'hover:bg-green-100' : 'hover:bg-red-100'
        }`}
        aria-label="Dismiss notification"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// ----------------------------
// Icons
// ----------------------------

function SuccessIcon() {
  return (
    <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
    </svg>
  );
}

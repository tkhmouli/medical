'use client';

import { useState, useEffect } from 'react';

interface LoadingSpinnerProps {
  /** Delay in milliseconds before showing the spinner. Defaults to 300ms per requirement 17.3 */
  delay?: number;
  /** Optional size: 'sm' | 'md' | 'lg'. Defaults to 'md' */
  size?: 'sm' | 'md' | 'lg';
  /** Optional label for screen readers */
  label?: string;
}

const SIZE_CLASSES = {
  sm: 'h-5 w-5',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
} as const;

/**
 * Loading spinner that only appears after a configurable delay (default 300ms).
 * Prevents flash of loading state for fast operations.
 *
 * Validates: Requirements 17.3
 */
export function LoadingSpinner({ delay = 300, size = 'md', label = 'Loading...' }: LoadingSpinnerProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [delay]);

  if (!visible) {
    return null;
  }

  return (
    <div className="flex items-center justify-center p-4" role="status" aria-label={label}>
      <svg
        className={`${SIZE_CLASSES[size]} animate-spin text-blue-600`}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      <span className="sr-only">{label}</span>
    </div>
  );
}

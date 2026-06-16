'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// ----------------------------
// Types
// ----------------------------

export interface PatientSearchResult {
  id: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
}

export interface PatientSelectorDropdownProps {
  /** Currently selected patient ID */
  value: string | null;
  /** Callback when a patient is selected */
  onChange: (patient: { id: string; firstName: string; lastName: string } | null) => void;
  /** Maximum results to display (default: 20) */
  limit?: number;
  /** Whether the selector is locked (pre-filled from URL param) */
  disabled?: boolean;
  /** Display name when locked/pre-filled */
  displayName?: string;
  /** Error message to show (e.g., "Patient not found") */
  error?: string;
  /** Placeholder text */
  placeholder?: string;
}

// ----------------------------
// Component
// ----------------------------

/**
 * Reusable typeahead dropdown for searching and selecting patients.
 * Supports typeahead with 300ms debounce, minimum 2-character threshold.
 * Fetches from GET /api/patients/search?q={query}&limit={limit}.
 * Keyboard accessible with arrow keys, Enter, and Escape.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.5, 4.1, 4.2, 4.5
 */
export function PatientSelectorDropdown({
  value,
  onChange,
  limit = 20,
  disabled = false,
  displayName,
  error,
  placeholder = 'Search patients by name or phone...',
}: PatientSelectorDropdownProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PatientSearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch patients from API
  const fetchPatients = useCallback(
    async (searchQuery: string) => {
      // Abort any in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      setIsLoading(true);

      try {
        const params = new URLSearchParams({
          q: searchQuery,
          limit: String(limit),
        });

        const response = await fetch(`/api/patients/search?${params.toString()}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          setResults([]);
          setHasSearched(true);
          return;
        }

        const data = await response.json();
        const patients: PatientSearchResult[] = data.data ?? [];
        setResults(patients);
        setHasSearched(true);
        setIsOpen(true);
        setActiveIndex(-1);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        setResults([]);
        setHasSearched(true);
      } finally {
        setIsLoading(false);
      }
    },
    [limit]
  );

  // Debounced search on input change
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (query.length < 2) {
      setResults([]);
      setIsOpen(false);
      setHasSearched(false);
      setActiveIndex(-1);
      return;
    }

    debounceTimer.current = setTimeout(() => {
      fetchPatients(query);
    }, 300);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [query, fetchPatients]);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Handle patient selection
  function handleSelect(patient: PatientSearchResult) {
    onChange({
      id: patient.id,
      firstName: patient.firstName,
      lastName: patient.lastName,
    });
    setQuery(`${patient.firstName} ${patient.lastName}`);
    setIsOpen(false);
    setActiveIndex(-1);
    inputRef.current?.blur();
  }

  // Clear selection
  function handleClear() {
    onChange(null);
    setQuery('');
    setResults([]);
    setIsOpen(false);
    setHasSearched(false);
    setActiveIndex(-1);
    inputRef.current?.focus();
  }

  // Keyboard navigation
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen || results.length === 0) {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setActiveIndex(-1);
        inputRef.current?.blur();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < results.length) {
          handleSelect(results[activeIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setActiveIndex(-1);
        inputRef.current?.blur();
        break;
    }
  }

  // Scroll active option into view
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const activeElement = listRef.current.children[activeIndex] as HTMLElement;
      if (activeElement) {
        activeElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [activeIndex]);

  // Disabled/locked state
  if (disabled) {
    return (
      <div className="relative" ref={containerRef}>
        <div
          className="block w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700"
          aria-label="Selected patient"
        >
          {displayName || 'Patient selected'}
        </div>
      </div>
    );
  }

  const showDropdown = isOpen && hasSearched;
  const listboxId = 'patient-selector-listbox';

  return (
    <div className="relative" ref={containerRef}>
      {/* Search input */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (value && e.target.value !== `${displayName || ''}`) {
              // If user edits the text after selecting, clear the selection
              onChange(null);
            }
          }}
          onFocus={() => {
            if (query.length >= 2 && hasSearched) {
              setIsOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`block w-full rounded-md border px-3 py-2 pr-8 text-sm shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-0 ${
            error
              ? 'border-red-300 text-red-900 focus:border-red-500 focus:ring-red-500'
              : 'border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-blue-500'
          }`}
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={listboxId}
          aria-activedescendant={
            activeIndex >= 0 ? `patient-option-${activeIndex}` : undefined
          }
          aria-autocomplete="list"
          aria-invalid={!!error}
          aria-describedby={error ? 'patient-selector-error' : undefined}
        />

        {/* Clear button */}
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute inset-y-0 right-0 flex items-center pr-2 text-gray-400 hover:text-gray-600"
            aria-label="Clear patient selection"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}

        {/* Loading indicator */}
        {isLoading && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-2">
            <svg
              className="h-4 w-4 animate-spin text-gray-400"
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
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <p
          id="patient-selector-error"
          className="mt-1 text-sm text-red-600"
          role="alert"
        >
          {error}
        </p>
      )}

      {/* Dropdown results */}
      {showDropdown && (
        <ul
          id={listboxId}
          ref={listRef}
          role="listbox"
          aria-label="Patient search results"
          className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg"
        >
          {results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-gray-500" role="option" aria-selected={false}>
              No patients found
            </li>
          ) : (
            results.map((patient, index) => (
              <li
                key={patient.id}
                id={`patient-option-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                className={`cursor-pointer px-3 py-2 text-sm ${
                  index === activeIndex
                    ? 'bg-blue-50 text-blue-900'
                    : 'text-gray-900 hover:bg-gray-50'
                }`}
                onClick={() => handleSelect(patient)}
                onMouseEnter={() => setActiveIndex(index)}
              >
                <div className="font-medium">
                  {patient.firstName} {patient.lastName}
                </div>
                <div className="text-xs text-gray-500">{patient.phoneNumber}</div>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

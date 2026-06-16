'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ----------------------------
// Types
// ----------------------------

export interface PatientSearchCriteria {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  dateOfBirth?: string;
}

interface PatientSearchBarProps {
  /** Callback invoked with current search criteria after debounce */
  onSearch: (criteria: PatientSearchCriteria) => void;
  /** Debounce delay in ms. Defaults to 300ms */
  debounceMs?: number;
  /** Whether a search is currently in progress */
  isLoading?: boolean;
}

// ----------------------------
// Component
// ----------------------------

/**
 * Multi-criteria patient search bar with debounced input.
 * Supports searching by first name, last name, phone number, and date of birth.
 * Uses a responsive grid layout that adapts from 1 to 4 columns.
 *
 * Validates: Requirements 6.1
 */
export function PatientSearchBar({ onSearch, debounceMs = 300, isLoading = false }: PatientSearchBarProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSearchRef = useRef(onSearch);

  // Keep onSearch ref up-to-date without triggering effect re-runs
  useEffect(() => {
    onSearchRef.current = onSearch;
  }, [onSearch]);

  const buildCriteria = useCallback((): PatientSearchCriteria => {
    const criteria: PatientSearchCriteria = {};
    if (firstName.trim()) criteria.firstName = firstName.trim();
    if (lastName.trim()) criteria.lastName = lastName.trim();
    if (phoneNumber.trim()) criteria.phoneNumber = phoneNumber.trim();
    if (dateOfBirth) criteria.dateOfBirth = dateOfBirth;
    return criteria;
  }, [firstName, lastName, phoneNumber, dateOfBirth]);

  // Debounced search trigger
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      onSearchRef.current(buildCriteria());
    }, debounceMs);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [firstName, lastName, phoneNumber, dateOfBirth, debounceMs, buildCriteria]);

  const handleClearAll = () => {
    setFirstName('');
    setLastName('');
    setPhoneNumber('');
    setDateOfBirth('');
    // Immediately trigger search with empty criteria
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    onSearchRef.current({});
  };

  const hasAnyInput = firstName || lastName || phoneNumber || dateOfBirth;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* First Name */}
        <div>
          <label htmlFor="search-firstName" className="block text-sm font-medium text-gray-700">
            First Name
          </label>
          <input
            id="search-firstName"
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Search by first name"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Last Name */}
        <div>
          <label htmlFor="search-lastName" className="block text-sm font-medium text-gray-700">
            Last Name
          </label>
          <input
            id="search-lastName"
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Search by last name"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Phone Number */}
        <div>
          <label htmlFor="search-phone" className="block text-sm font-medium text-gray-700">
            Phone Number
          </label>
          <input
            id="search-phone"
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="Search by phone"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Date of Birth */}
        <div>
          <label htmlFor="search-dob" className="block text-sm font-medium text-gray-700">
            Date of Birth
          </label>
          <input
            id="search-dob"
            type="date"
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Action row */}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isLoading && (
            <span className="text-xs text-gray-600" role="status">
              Searching...
            </span>
          )}
        </div>

        {hasAnyInput && (
          <button
            type="button"
            onClick={handleClearAll}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
          >
            Clear All
          </button>
        )}
      </div>
    </div>
  );
}

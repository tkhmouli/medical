'use client';

import { useState, useEffect } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface FinancialData {
  ytdRevenue: number;
  monthlyRevenue: number;
  weeklyRevenue: number;
  ytdPatientsSeen: number;
}

// ─── Utility ────────────────────────────────────────────────────────────────

/**
 * Formats a number as USD currency string (e.g., $12,345.00).
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

// ─── Component ──────────────────────────────────────────────────────────────

/**
 * FinancialWidget displays financial statistics for the practice:
 * YTD revenue, monthly revenue, weekly revenue, and YTD patients seen.
 * Data is fetched on mount from /api/dashboard/financial.
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */
export default function FinancialWidget() {
  const [financials, setFinancials] = useState<FinancialData | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchFinancials() {
      try {
        const response = await fetch('/api/dashboard/financial');
        if (response.ok) {
          const json = await response.json();
          if (json.success && json.data) {
            setFinancials(json.data);
            setError(false);
          } else {
            setFinancials(null);
            setError(true);
          }
        } else {
          setFinancials(null);
          setError(true);
        }
      } catch {
        setFinancials(null);
        setError(true);
      } finally {
        setLoading(false);
      }
    }

    fetchFinancials();
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
        <p className="text-sm text-emerald-700">Loading financial data...</p>
      </div>
    );
  }

  // Error state
  if (error || !financials) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <p className="text-sm text-gray-600">Financial data unavailable</p>
      </div>
    );
  }

  // Success state
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-700">Financial Overview</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* YTD Revenue */}
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-medium text-emerald-700">YTD Revenue</p>
          <p className="mt-2 text-2xl font-bold text-emerald-900">
            {formatCurrency(financials.ytdRevenue)}
          </p>
        </div>

        {/* Monthly Revenue */}
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-medium text-emerald-700">Monthly Revenue</p>
          <p className="mt-2 text-2xl font-bold text-emerald-900">
            {formatCurrency(financials.monthlyRevenue)}
          </p>
        </div>

        {/* Weekly Revenue */}
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-medium text-emerald-700">Weekly Revenue</p>
          <p className="mt-2 text-2xl font-bold text-emerald-900">
            {formatCurrency(financials.weeklyRevenue)}
          </p>
        </div>

        {/* YTD Patients Seen */}
        <div className="rounded-lg border border-violet-200 bg-violet-50 p-4">
          <p className="text-sm font-medium text-violet-700">YTD Patients Seen</p>
          <p className="mt-2 text-2xl font-bold text-violet-900">
            {financials.ytdPatientsSeen.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}

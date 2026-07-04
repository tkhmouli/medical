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
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Financial Overview</h3>
      <div className="space-y-3">
        <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-4 py-3">
          <div>
            <p className="text-xs text-emerald-600">YTD Revenue</p>
            <p className="text-lg font-bold text-emerald-800">{formatCurrency(financials.ytdRevenue)}</p>
          </div>
          <span className="text-xl">💰</span>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-blue-50 px-4 py-3">
          <div>
            <p className="text-xs text-blue-600">This Month</p>
            <p className="text-lg font-bold text-blue-800">{formatCurrency(financials.monthlyRevenue)}</p>
          </div>
          <span className="text-xl">📊</span>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-violet-50 px-4 py-3">
          <div>
            <p className="text-xs text-violet-600">This Week</p>
            <p className="text-lg font-bold text-violet-800">{formatCurrency(financials.weeklyRevenue)}</p>
          </div>
          <span className="text-xl">📈</span>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
          <div>
            <p className="text-xs text-gray-600">YTD Patients</p>
            <p className="text-lg font-bold text-gray-800">{financials.ytdPatientsSeen.toLocaleString()}</p>
          </div>
          <span className="text-xl">👥</span>
        </div>
      </div>
    </div>
  );
}

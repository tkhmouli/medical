'use client';

import { useState, useEffect, useCallback } from 'react';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useToast } from '@/components/NotificationToast';
import type { Role } from '@/lib/auth/permissions';
import { hasPermission } from '@/lib/auth/permissions';

// --- Types ---

interface FinancialSummary {
  totalReceived: number;
  paidCount: number;
  unpaidCount: number;
  dateRange: { start: string; end: string };
}

interface FinancialEntry {
  id: string;
  appointmentId: string;
  amount: number;
  paymentDate: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AppointmentOption {
  id: string;
  patientName: string;
  date: string;
  visitType: string;
}

// --- Utility Functions ---

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getDefaultDateRange(): { start: string; end: string } {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start: formatDate(startOfMonth), end: formatDate(endOfMonth) };
}

function formatCentimesToMAD(centimes: number): string {
  return (centimes / 100).toFixed(2);
}

const VISIT_TYPE_LABELS: Record<string, string> = {
  new_visit: 'New Visit',
  control_visit: 'Control Visit',
  follow_up: 'Follow-up',
};

// --- Main Component ---

/**
 * Financial dashboard page.
 * - Date range picker for viewing financial summary
 * - Summary cards: total received, paid count, unpaid count
 * - Record payment form (amount, payment date, associated appointment)
 * - Edit existing financial entries
 * - Only accessible to Admin and Doctor (hidden from Medical_Assistant via AppShell RoleGate)
 *
 * Requirements: 15.1, 15.2, 15.3, 15.4, 15.5
 */
export default function FinancialDashboardPage() {
  const { showToast } = useToast();

  // Auth state
  const [userRole, setUserRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  // Date range state
  const defaultRange = getDefaultDateRange();
  const [startDate, setStartDate] = useState(defaultRange.start);
  const [endDate, setEndDate] = useState(defaultRange.end);

  // Summary state
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Create form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createFormData, setCreateFormData] = useState({
    appointmentId: '',
    amount: '',
    paymentDate: formatDate(new Date()),
    notes: '',
  });
  const [createSubmitting, setCreateSubmitting] = useState(false);

  // Edit form state
  const [editingEntry, setEditingEntry] = useState<FinancialEntry | null>(null);
  const [editFormData, setEditFormData] = useState({
    amount: '',
    paymentDate: '',
    notes: '',
  });
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Appointments for the dropdown
  const [appointments, setAppointments] = useState<AppointmentOption[]>([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);

  // --- Session Fetch ---

  const fetchSession = useCallback(async (): Promise<Role | null> => {
    try {
      const response = await fetch('/api/auth/session');
      if (response.ok) {
        const data = await response.json();
        return data.data?.role ?? null;
      }
    } catch {
      // Session fetch failure handled by layout redirect
    }
    return null;
  }, []);

  // --- Fetch Financial Summary ---

  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const response = await fetch(
        `/api/financial?startDate=${startDate}&endDate=${endDate}`
      );
      if (!response.ok) {
        showToast('error', 'Failed to load financial summary');
        return;
      }
      const data = await response.json();
      setSummary(data.data || null);
    } catch {
      showToast('error', 'Failed to load financial summary');
    } finally {
      setSummaryLoading(false);
    }
  }, [startDate, endDate, showToast]);

  // --- Fetch Appointments ---

  const fetchAppointments = useCallback(async () => {
    setAppointmentsLoading(true);
    try {
      const response = await fetch('/api/appointments');
      if (!response.ok) {
        return;
      }
      const data = await response.json();
      const appts = data.data || [];
      const options: AppointmentOption[] = appts.map((appt: {
        id: string;
        patientId: string;
        date: string;
        visitType: string;
        patient?: { firstName: string; lastName: string };
      }) => ({
        id: appt.id,
        patientName: appt.patient
          ? `${appt.patient.firstName} ${appt.patient.lastName}`
          : 'Unknown Patient',
        date: appt.date,
        visitType: appt.visitType,
      }));
      setAppointments(options);
    } catch {
      // Silently fail - form will show empty dropdown
    } finally {
      setAppointmentsLoading(false);
    }
  }, []);

  // --- Initial Load ---

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const role = await fetchSession();
      setUserRole(role);

      if (!role || !hasPermission(role, 'financial')) {
        setAccessDenied(true);
        setLoading(false);
        return;
      }

      await Promise.all([fetchSummary(), fetchAppointments()]);
      setLoading(false);
    }
    loadData();
  }, [fetchSession, fetchSummary, fetchAppointments]);

  // --- Refresh Summary on Date Range Change ---

  const handleDateRangeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchSummary();
  };

  // --- Create Entry ---

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateSubmitting(true);

    try {
      const amountInCentimes = Math.round(parseFloat(createFormData.amount) * 100);
      if (isNaN(amountInCentimes) || amountInCentimes <= 0) {
        showToast('error', 'Amount must be a positive number');
        setCreateSubmitting(false);
        return;
      }

      const response = await fetch('/api/financial/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointmentId: createFormData.appointmentId,
          amount: amountInCentimes,
          paymentDate: createFormData.paymentDate,
          notes: createFormData.notes || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        showToast('error', errorData.error?.message || 'Failed to record payment');
        setCreateSubmitting(false);
        return;
      }

      showToast('success', 'Payment recorded successfully');
      setCreateFormData({
        appointmentId: '',
        amount: '',
        paymentDate: formatDate(new Date()),
        notes: '',
      });
      setShowCreateForm(false);
      // Refresh summary
      fetchSummary();
    } catch {
      showToast('error', 'Failed to record payment');
    } finally {
      setCreateSubmitting(false);
    }
  };

  // --- Edit Entry ---

  const startEditing = (entry: FinancialEntry) => {
    setEditingEntry(entry);
    setEditFormData({
      amount: formatCentimesToMAD(entry.amount),
      paymentDate: entry.paymentDate,
      notes: entry.notes || '',
    });
  };

  const cancelEditing = () => {
    setEditingEntry(null);
    setEditFormData({ amount: '', paymentDate: '', notes: '' });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry) return;
    setEditSubmitting(true);

    try {
      const amountInCentimes = Math.round(parseFloat(editFormData.amount) * 100);
      if (isNaN(amountInCentimes) || amountInCentimes <= 0) {
        showToast('error', 'Amount must be a positive number');
        setEditSubmitting(false);
        return;
      }

      const response = await fetch(`/api/financial/entries/${editingEntry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountInCentimes,
          paymentDate: editFormData.paymentDate,
          notes: editFormData.notes || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        showToast('error', errorData.error?.message || 'Failed to update payment');
        setEditSubmitting(false);
        return;
      }

      showToast('success', 'Payment updated successfully');
      cancelEditing();
      // Refresh summary
      fetchSummary();
    } catch {
      showToast('error', 'Failed to update payment');
    } finally {
      setEditSubmitting(false);
    }
  };

  // --- Access Denied ---

  if (loading) {
    return <LoadingSpinner label="Loading financial dashboard..." />;
  }

  if (accessDenied) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-gray-900">Access Denied</h2>
          <p className="mt-2 text-sm text-gray-600">
            You do not have permission to access financial data.
          </p>
        </div>
      </div>
    );
  }

  // --- Render ---

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Financial Dashboard
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Track payments and view financial summaries.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateForm(true)}
          className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          + Record Payment
        </button>
      </div>

      {/* Date Range Picker */}
      <form
        onSubmit={handleDateRangeSubmit}
        className="mt-6 flex flex-wrap items-end gap-4 rounded-lg border border-gray-200 bg-white p-4"
      >
        <div>
          <label
            htmlFor="startDate"
            className="block text-sm font-medium text-gray-700"
          >
            Start Date
          </label>
          <input
            type="date"
            id="startDate"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1 block rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            required
          />
        </div>
        <div>
          <label
            htmlFor="endDate"
            className="block text-sm font-medium text-gray-700"
          >
            End Date
          </label>
          <input
            type="date"
            id="endDate"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="mt-1 block rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            required
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-gray-800 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
        >
          Update Summary
        </button>
      </form>

      {/* Summary Cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {summaryLoading ? (
          <div className="col-span-3">
            <LoadingSpinner label="Loading summary..." size="sm" />
          </div>
        ) : summary ? (
          <>
            {/* Total Received */}
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <p className="text-sm font-medium text-gray-600">Total Received</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {formatCentimesToMAD(summary.totalReceived)} MAD
              </p>
              <p className="mt-1 text-xs text-gray-600">
                {summary.dateRange.start} to {summary.dateRange.end}
              </p>
            </div>

            {/* Paid Count */}
            <div className="rounded-lg border border-green-200 bg-green-50 p-6">
              <p className="text-sm font-medium text-green-700">Paid Appointments</p>
              <p className="mt-2 text-3xl font-bold text-green-900">
                {summary.paidCount}
              </p>
              <p className="mt-1 text-xs text-green-600">
                Appointments with recorded payments
              </p>
            </div>

            {/* Unpaid Count */}
            <div className="rounded-lg border border-red-200 bg-red-50 p-6">
              <p className="text-sm font-medium text-red-700">Unpaid Appointments</p>
              <p className="mt-2 text-3xl font-bold text-red-900">
                {summary.unpaidCount}
              </p>
              <p className="mt-1 text-xs text-red-600">
                Appointments without payments
              </p>
            </div>
          </>
        ) : (
          <div className="col-span-3 rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
            <p className="text-sm text-gray-600">
              Select a date range and click &quot;Update Summary&quot; to view financial data.
            </p>
          </div>
        )}
      </div>

      {/* Record Payment Form (modal-like section) */}
      {showCreateForm && (
        <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Record Payment
            </h2>
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="rounded p-1 text-gray-400 hover:text-gray-600"
              aria-label="Close form"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleCreateSubmit} className="mt-4 space-y-4">
            {/* Appointment Selection */}
            <div>
              <label
                htmlFor="create-appointment"
                className="block text-sm font-medium text-gray-700"
              >
                Appointment <span className="text-red-500">*</span>
              </label>
              <select
                id="create-appointment"
                value={createFormData.appointmentId}
                onChange={(e) =>
                  setCreateFormData({ ...createFormData, appointmentId: e.target.value })
                }
                className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
              >
                <option value="">Select an appointment...</option>
                {appointmentsLoading ? (
                  <option disabled>Loading appointments...</option>
                ) : (
                  appointments.map((appt) => (
                    <option key={appt.id} value={appt.id}>
                      {appt.patientName} — {appt.date} ({VISIT_TYPE_LABELS[appt.visitType] || appt.visitType})
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Amount */}
            <div>
              <label
                htmlFor="create-amount"
                className="block text-sm font-medium text-gray-700"
              >
                Amount (MAD) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="create-amount"
                value={createFormData.amount}
                onChange={(e) =>
                  setCreateFormData({ ...createFormData, amount: e.target.value })
                }
                min="0.01"
                step="0.01"
                placeholder="0.00"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
              />
            </div>

            {/* Payment Date */}
            <div>
              <label
                htmlFor="create-paymentDate"
                className="block text-sm font-medium text-gray-700"
              >
                Payment Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                id="create-paymentDate"
                value={createFormData.paymentDate}
                onChange={(e) =>
                  setCreateFormData({ ...createFormData, paymentDate: e.target.value })
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
              />
            </div>

            {/* Notes */}
            <div>
              <label
                htmlFor="create-notes"
                className="block text-sm font-medium text-gray-700"
              >
                Notes
              </label>
              <textarea
                id="create-notes"
                value={createFormData.notes}
                onChange={(e) =>
                  setCreateFormData({ ...createFormData, notes: e.target.value })
                }
                rows={2}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Optional notes..."
              />
            </div>

            {/* Submit */}
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={createSubmitting}
                className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {createSubmitting ? 'Recording...' : 'Record Payment'}
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Entry Form (shown when editing) */}
      {editingEntry && (
        <div className="mt-6 rounded-lg border border-yellow-200 bg-yellow-50 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Edit Payment Entry
            </h2>
            <button
              type="button"
              onClick={cancelEditing}
              className="rounded p-1 text-gray-400 hover:text-gray-600"
              aria-label="Close edit form"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleEditSubmit} className="mt-4 space-y-4">
            {/* Amount */}
            <div>
              <label
                htmlFor="edit-amount"
                className="block text-sm font-medium text-gray-700"
              >
                Amount (MAD) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="edit-amount"
                value={editFormData.amount}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, amount: e.target.value })
                }
                min="0.01"
                step="0.01"
                placeholder="0.00"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
              />
            </div>

            {/* Payment Date */}
            <div>
              <label
                htmlFor="edit-paymentDate"
                className="block text-sm font-medium text-gray-700"
              >
                Payment Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                id="edit-paymentDate"
                value={editFormData.paymentDate}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, paymentDate: e.target.value })
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
              />
            </div>

            {/* Notes */}
            <div>
              <label
                htmlFor="edit-notes"
                className="block text-sm font-medium text-gray-700"
              >
                Notes
              </label>
              <textarea
                id="edit-notes"
                value={editFormData.notes}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, notes: e.target.value })
                }
                rows={2}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Optional notes..."
              />
            </div>

            {/* Submit */}
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={editSubmitting}
                className="inline-flex items-center rounded-md bg-yellow-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {editSubmitting ? 'Updating...' : 'Update Payment'}
              </button>
              <button
                type="button"
                onClick={cancelEditing}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Recent Entries Table */}
      <div className="mt-6">
        <h2 className="text-lg font-semibold text-gray-900">Recent Payments</h2>
        <RecentEntriesTable
          startDate={startDate}
          endDate={endDate}
          onEdit={startEditing}
          refreshTrigger={summary}
        />
      </div>
    </div>
  );
}

// --- Recent Entries Table Component ---

interface RecentEntriesTableProps {
  startDate: string;
  endDate: string;
  onEdit: (entry: FinancialEntry) => void;
  refreshTrigger: FinancialSummary | null;
}

function RecentEntriesTable({ startDate, endDate, onEdit, refreshTrigger }: RecentEntriesTableProps) {
  const [entries, setEntries] = useState<FinancialEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch entries when summary refreshes (summary is re-fetched after create/edit)
  useEffect(() => {
    async function fetchEntries() {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/financial?startDate=${startDate}&endDate=${endDate}`
        );
        if (response.ok) {
          const data = await response.json();
          // The summary endpoint returns summary data; we'll show summary-derived info
          // For a detailed entries list, we use the entries from the response if available
          if (data.data?.entries) {
            setEntries(data.data.entries);
          } else {
            // If the summary API doesn't return entries, we set empty
            setEntries([]);
          }
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    }
    fetchEntries();
  }, [startDate, endDate, refreshTrigger]);

  if (loading) {
    return <LoadingSpinner label="Loading recent payments..." size="sm" />;
  }

  if (entries.length === 0) {
    return (
      <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 px-6 py-8 text-center">
        <p className="text-sm text-gray-600">
          No payment entries found for the selected date range. Use the &quot;Record Payment&quot; button to add one.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
              Payment Date
            </th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
              Amount (MAD)
            </th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
              Notes
            </th>
            <th scope="col" className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {entries.map((entry) => (
            <tr key={entry.id} className="hover:bg-gray-50">
              <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                {entry.paymentDate}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                {formatCentimesToMAD(entry.amount)} MAD
              </td>
              <td className="px-4 py-3 text-sm text-gray-600">
                {entry.notes || '—'}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right">
                <button
                  type="button"
                  onClick={() => onEdit(entry)}
                  className="text-sm font-medium text-blue-600 hover:text-blue-800"
                >
                  Edit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useToast } from '@/components/NotificationToast';

// --- Types ---

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
}

interface Reminder {
  id: string;
  patientId: string;
  patientName: string;
  targetDate: string;
  reminderType: 'follow_up' | 'check_up' | 'custom';
  customMessage?: string;
  status: 'pending' | 'sent' | 'dismissed';
  createdAt: string;
}

type ReminderType = 'follow_up' | 'check_up' | 'custom';
type IntervalOption = '15' | '30' | 'custom';

// --- Main Component ---

/**
 * Reminder management page.
 * - Create reminders: select patient, interval (15/30/custom days), type (follow_up/check_up/custom + message)
 * - Display reminders with status, target date, patient name, type
 * - Dismiss button updates status to 'dismissed'
 * - Accessible to Admin, Doctor, and Medical_Assistant
 *
 * Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6
 */
export default function RemindersPage() {
  const { showToast } = useToast();

  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);

  // Create form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [intervalOption, setIntervalOption] = useState<IntervalOption>('15');
  const [customDays, setCustomDays] = useState('');
  const [reminderType, setReminderType] = useState<ReminderType>('follow_up');
  const [customMessage, setCustomMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Fetch reminders
  const fetchReminders = useCallback(async () => {
    try {
      const response = await fetch('/api/reminders');
      if (!response.ok) {
        showToast('error', 'Failed to load reminders');
        return;
      }
      const data = await response.json();
      setReminders(data.data || []);
    } catch {
      showToast('error', 'Failed to load reminders');
    }
  }, [showToast]);

  // Fetch patients for the select dropdown
  const fetchPatients = useCallback(async () => {
    try {
      const response = await fetch('/api/patients');
      if (!response.ok) return;
      const data = await response.json();
      setPatients(data.data || []);
    } catch {
      // Patients fetch failure is non-critical for display
    }
  }, []);

  // Initial data load
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      await Promise.all([fetchReminders(), fetchPatients()]);
      setLoading(false);
    }
    loadData();
  }, [fetchReminders, fetchPatients]);

  // Reset form
  const resetForm = () => {
    setSelectedPatientId('');
    setIntervalOption('15');
    setCustomDays('');
    setReminderType('follow_up');
    setCustomMessage('');
  };

  // Create reminder
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedPatientId) {
      showToast('error', 'Please select a patient');
      return;
    }

    const intervalDays =
      intervalOption === 'custom' ? parseInt(customDays, 10) : parseInt(intervalOption, 10);

    if (isNaN(intervalDays) || intervalDays <= 0) {
      showToast('error', 'Please enter a valid number of days');
      return;
    }

    if (reminderType === 'custom' && !customMessage.trim()) {
      showToast('error', 'Please enter a custom message');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: selectedPatientId,
          intervalDays,
          reminderType,
          customMessage: reminderType === 'custom' ? customMessage.trim() : undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        showToast('error', errorData.error?.message || 'Failed to create reminder');
        return;
      }

      showToast('success', 'Reminder created successfully');
      resetForm();
      setShowCreateForm(false);
      await fetchReminders();
    } catch {
      showToast('error', 'Failed to create reminder');
    } finally {
      setSubmitting(false);
    }
  };

  // Dismiss reminder
  const handleDismiss = async (reminderId: string) => {
    try {
      const response = await fetch(`/api/reminders/${reminderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'dismissed' }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        showToast('error', errorData.error?.message || 'Failed to dismiss reminder');
        return;
      }

      showToast('success', 'Reminder dismissed');
      await fetchReminders();
    } catch {
      showToast('error', 'Failed to dismiss reminder');
    }
  };

  // Status badge styling
  const getStatusBadge = (status: Reminder['status']) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'sent':
        return 'bg-blue-100 text-blue-800';
      case 'dismissed':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Reminder type display label
  const getTypeLabel = (type: ReminderType) => {
    switch (type) {
      case 'follow_up':
        return 'Follow-up';
      case 'check_up':
        return 'Check-up';
      case 'custom':
        return 'Custom';
      default:
        return type;
    }
  };

  if (loading) {
    return <LoadingSpinner label="Loading reminders..." />;
  }

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Reminders</h1>
          <p className="mt-1 text-sm text-gray-600">
            Schedule and manage patient follow-up reminders.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          {showCreateForm ? 'Cancel' : '+ New Reminder'}
        </button>
      </div>

      {/* Create reminder form */}
      {showCreateForm && (
        <form
          onSubmit={handleCreateSubmit}
          className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-4"
        >
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Create New Reminder</h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Patient select */}
            <div>
              <label htmlFor="reminder-patient" className="block text-sm font-medium text-gray-700">
                Patient <span className="text-red-500">*</span>
              </label>
              <select
                id="reminder-patient"
                value={selectedPatientId}
                onChange={(e) => setSelectedPatientId(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
              >
                <option value="">Select a patient</option>
                {patients.map((patient) => (
                  <option key={patient.id} value={patient.id}>
                    {patient.firstName} {patient.lastName}
                  </option>
                ))}
              </select>
            </div>

            {/* Interval selection */}
            <div>
              <fieldset>
                <legend className="block text-sm font-medium text-gray-700">
                  Interval <span className="text-red-500">*</span>
                </legend>
                <div className="mt-1 flex items-center gap-4">
                  <label className="inline-flex items-center text-sm text-gray-700">
                    <input
                      type="radio"
                      name="interval"
                      value="15"
                      checked={intervalOption === '15'}
                      onChange={() => setIntervalOption('15')}
                      className="mr-1.5 text-blue-600 focus:ring-blue-500"
                    />
                    15 days
                  </label>
                  <label className="inline-flex items-center text-sm text-gray-700">
                    <input
                      type="radio"
                      name="interval"
                      value="30"
                      checked={intervalOption === '30'}
                      onChange={() => setIntervalOption('30')}
                      className="mr-1.5 text-blue-600 focus:ring-blue-500"
                    />
                    30 days
                  </label>
                  <label className="inline-flex items-center text-sm text-gray-700">
                    <input
                      type="radio"
                      name="interval"
                      value="custom"
                      checked={intervalOption === 'custom'}
                      onChange={() => setIntervalOption('custom')}
                      className="mr-1.5 text-blue-600 focus:ring-blue-500"
                    />
                    Custom
                  </label>
                </div>
                {intervalOption === 'custom' && (
                  <div className="mt-2">
                    <input
                      type="number"
                      min="1"
                      value={customDays}
                      onChange={(e) => setCustomDays(e.target.value)}
                      placeholder="Number of days"
                      className="block w-32 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      aria-label="Custom number of days"
                      required
                    />
                  </div>
                )}
              </fieldset>
            </div>

            {/* Reminder type selection */}
            <div>
              <fieldset>
                <legend className="block text-sm font-medium text-gray-700">
                  Type <span className="text-red-500">*</span>
                </legend>
                <div className="mt-1 flex items-center gap-4">
                  <label className="inline-flex items-center text-sm text-gray-700">
                    <input
                      type="radio"
                      name="reminderType"
                      value="follow_up"
                      checked={reminderType === 'follow_up'}
                      onChange={() => setReminderType('follow_up')}
                      className="mr-1.5 text-blue-600 focus:ring-blue-500"
                    />
                    Follow-up
                  </label>
                  <label className="inline-flex items-center text-sm text-gray-700">
                    <input
                      type="radio"
                      name="reminderType"
                      value="check_up"
                      checked={reminderType === 'check_up'}
                      onChange={() => setReminderType('check_up')}
                      className="mr-1.5 text-blue-600 focus:ring-blue-500"
                    />
                    Check-up
                  </label>
                  <label className="inline-flex items-center text-sm text-gray-700">
                    <input
                      type="radio"
                      name="reminderType"
                      value="custom"
                      checked={reminderType === 'custom'}
                      onChange={() => setReminderType('custom')}
                      className="mr-1.5 text-blue-600 focus:ring-blue-500"
                    />
                    Custom
                  </label>
                </div>
              </fieldset>
            </div>

            {/* Custom message textarea (shown when type is custom) */}
            {reminderType === 'custom' && (
              <div className="sm:col-span-2">
                <label htmlFor="reminder-message" className="block text-sm font-medium text-gray-700">
                  Custom Message <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="reminder-message"
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  rows={3}
                  placeholder="Enter a custom reminder message for the patient..."
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>
            )}
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Creating...' : 'Create Reminder'}
            </button>
          </div>
        </form>
      )}

      {/* Reminders table */}
      <div className="mt-6 overflow-x-auto rounded-md border border-gray-200">
        {reminders.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-gray-600">No reminders scheduled yet.</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  Patient
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  Type
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  Target Date
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  Status
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {reminders.map((reminder) => (
                <tr key={reminder.id}>
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                    {reminder.patientName}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                    {getTypeLabel(reminder.reminderType)}
                    {reminder.reminderType === 'custom' && reminder.customMessage && (
                      <span
                        className="ml-1 text-xs text-gray-600"
                        title={reminder.customMessage}
                      >
                        ({reminder.customMessage.length > 30
                          ? reminder.customMessage.slice(0, 30) + '...'
                          : reminder.customMessage})
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                    {new Date(reminder.targetDate).toLocaleDateString()}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getStatusBadge(reminder.status)}`}
                    >
                      {reminder.status.charAt(0).toUpperCase() + reminder.status.slice(1)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    {reminder.status !== 'dismissed' && (
                      <button
                        type="button"
                        onClick={() => handleDismiss(reminder.id)}
                        className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        aria-label={`Dismiss reminder for ${reminder.patientName}`}
                      >
                        Dismiss
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Summary */}
      <div className="mt-3 text-xs text-gray-600">
        {reminders.length > 0 && (
          <span>
            {reminders.filter((r) => r.status === 'pending').length} pending,{' '}
            {reminders.filter((r) => r.status === 'sent').length} sent,{' '}
            {reminders.filter((r) => r.status === 'dismissed').length} dismissed
          </span>
        )}
      </div>
    </div>
  );
}

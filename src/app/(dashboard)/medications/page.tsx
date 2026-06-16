'use client';

import { useState, useEffect, useCallback } from 'react';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useToast } from '@/components/NotificationToast';
import type { Role } from '@/lib/auth/permissions';

// --- Types ---

interface Medication {
  id: string;
  name: string;
  dosageForm: string;
  defaultInstructions: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface MedicationFormData {
  name: string;
  dosageForm: string;
  defaultInstructions: string;
}

const INITIAL_FORM_DATA: MedicationFormData = {
  name: '',
  dosageForm: '',
  defaultInstructions: '',
};

// --- Main Component ---

/**
 * Medication catalog management page.
 * - Admin: full CRUD (add, edit, deactivate medications)
 * - Doctor: view active medications list (read-only)
 * - Medical_Assistant: no access (gated by AppShell RoleGate)
 *
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5
 */
export default function MedicationsPage() {
  const { showToast } = useToast();

  const [medications, setMedications] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<Role | null>(null);
  const [showAll, setShowAll] = useState(false);

  // Add form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [addFormData, setAddFormData] = useState<MedicationFormData>(INITIAL_FORM_DATA);
  const [addSubmitting, setAddSubmitting] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<MedicationFormData>(INITIAL_FORM_DATA);
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Fetch user session to determine role
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

  // Fetch medications from the API
  const fetchMedications = useCallback(async () => {
    try {
      const response = await fetch('/api/medications');
      if (!response.ok) {
        showToast('error', 'Failed to load medications');
        return;
      }
      const data = await response.json();
      setMedications(data.data || []);
    } catch {
      showToast('error', 'Failed to load medications');
    }
  }, [showToast]);

  // Initial data load
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const role = await fetchSession();
      setUserRole(role);
      await fetchMedications();
      setLoading(false);
    }
    loadData();
  }, [fetchSession, fetchMedications]);

  const isAdmin = userRole === 'Admin';

  // Filter medications based on toggle
  const displayedMedications = showAll
    ? medications
    : medications.filter((m) => m.isActive);

  // --- Add Medication ---

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!addFormData.name.trim() || !addFormData.dosageForm.trim()) {
      showToast('error', 'Name and dosage form are required');
      return;
    }

    setAddSubmitting(true);
    try {
      const response = await fetch('/api/medications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: addFormData.name.trim(),
          dosageForm: addFormData.dosageForm.trim(),
          defaultInstructions: addFormData.defaultInstructions.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        showToast('error', errorData.error?.message || 'Failed to add medication');
        return;
      }

      showToast('success', 'Medication added successfully');
      setAddFormData(INITIAL_FORM_DATA);
      setShowAddForm(false);
      await fetchMedications();
    } catch {
      showToast('error', 'Failed to add medication');
    } finally {
      setAddSubmitting(false);
    }
  };

  // --- Edit Medication ---

  const startEditing = (medication: Medication) => {
    setEditingId(medication.id);
    setEditFormData({
      name: medication.name,
      dosageForm: medication.dosageForm,
      defaultInstructions: medication.defaultInstructions || '',
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditFormData(INITIAL_FORM_DATA);
  };

  const handleEditSubmit = async (medicationId: string) => {
    if (!editFormData.name.trim() || !editFormData.dosageForm.trim()) {
      showToast('error', 'Name and dosage form are required');
      return;
    }

    setEditSubmitting(true);
    try {
      const response = await fetch(`/api/medications/${medicationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editFormData.name.trim(),
          dosageForm: editFormData.dosageForm.trim(),
          defaultInstructions: editFormData.defaultInstructions.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        showToast('error', errorData.error?.message || 'Failed to update medication');
        return;
      }

      showToast('success', 'Medication updated successfully');
      setEditingId(null);
      setEditFormData(INITIAL_FORM_DATA);
      await fetchMedications();
    } catch {
      showToast('error', 'Failed to update medication');
    } finally {
      setEditSubmitting(false);
    }
  };

  // --- Deactivate Medication ---

  const handleDeactivate = async (medicationId: string, medicationName: string) => {
    const confirmed = window.confirm(
      `Are you sure you want to deactivate "${medicationName}"? It will no longer be available for new prescriptions.`
    );
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/medications/${medicationId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        showToast('error', errorData.error?.message || 'Failed to deactivate medication');
        return;
      }

      showToast('success', 'Medication deactivated successfully');
      await fetchMedications();
    } catch {
      showToast('error', 'Failed to deactivate medication');
    }
  };

  // --- Render ---

  if (loading) {
    return <LoadingSpinner label="Loading medications..." />;
  }

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Medication Catalog
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            {isAdmin
              ? 'Manage your clinic\'s medication catalog for prescription selection.'
              : 'View available medications for prescription selection.'}
          </p>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {showAddForm ? 'Cancel' : '+ Add Medication'}
          </button>
        )}
      </div>

      {/* Add medication form */}
      {isAdmin && showAddForm && (
        <form
          onSubmit={handleAddSubmit}
          className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-4"
        >
          <h2 className="text-sm font-semibold text-gray-900 mb-3">
            Add New Medication
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="add-name" className="block text-sm font-medium text-gray-700">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                id="add-name"
                type="text"
                value={addFormData.name}
                onChange={(e) => setAddFormData({ ...addFormData, name: e.target.value })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="e.g. Amoxicillin"
                required
              />
            </div>
            <div>
              <label htmlFor="add-dosageForm" className="block text-sm font-medium text-gray-700">
                Dosage Form <span className="text-red-500">*</span>
              </label>
              <input
                id="add-dosageForm"
                type="text"
                value={addFormData.dosageForm}
                onChange={(e) => setAddFormData({ ...addFormData, dosageForm: e.target.value })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="e.g. tablet, syrup, injection"
                required
              />
            </div>
            <div>
              <label htmlFor="add-instructions" className="block text-sm font-medium text-gray-700">
                Default Instructions
              </label>
              <input
                id="add-instructions"
                type="text"
                value={addFormData.defaultInstructions}
                onChange={(e) => setAddFormData({ ...addFormData, defaultInstructions: e.target.value })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="e.g. Take with food"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={addSubmitting}
              className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {addSubmitting ? 'Adding...' : 'Add Medication'}
            </button>
          </div>
        </form>
      )}

      {/* Filter toggle */}
      {isAdmin && (
        <div className="mt-4 flex items-center gap-3">
          <label htmlFor="filter-toggle" className="text-sm font-medium text-gray-700">
            Filter:
          </label>
          <button
            id="filter-toggle"
            type="button"
            onClick={() => setShowAll(!showAll)}
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              showAll
                ? 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                : 'bg-green-100 text-green-800 hover:bg-green-200'
            }`}
            aria-pressed={showAll}
          >
            {showAll ? 'Showing All' : 'Active Only'}
          </button>
        </div>
      )}

      {/* Medications table */}
      <div className="mt-4 overflow-x-auto rounded-md border border-gray-200">
        {displayedMedications.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-gray-600">
              {medications.length === 0
                ? 'No medications in the catalog yet.'
                : 'No medications match the current filter.'}
            </p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  Name
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  Dosage Form
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  Default Instructions
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  Status
                </th>
                {isAdmin && (
                  <th
                    scope="col"
                    className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500"
                  >
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {displayedMedications.map((medication) => (
                <tr key={medication.id}>
                  {editingId === medication.id ? (
                    // Inline edit mode
                    <>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={editFormData.name}
                          onChange={(e) =>
                            setEditFormData({ ...editFormData, name: e.target.value })
                          }
                          className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          aria-label="Medication name"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={editFormData.dosageForm}
                          onChange={(e) =>
                            setEditFormData({ ...editFormData, dosageForm: e.target.value })
                          }
                          className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          aria-label="Dosage form"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={editFormData.defaultInstructions}
                          onChange={(e) =>
                            setEditFormData({
                              ...editFormData,
                              defaultInstructions: e.target.value,
                            })
                          }
                          className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          aria-label="Default instructions"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            medication.isActive
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {medication.isActive ? 'Active' : 'Deactivated'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleEditSubmit(medication.id)}
                            disabled={editSubmitting}
                            className="rounded-md bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
                          >
                            {editSubmitting ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditing}
                            className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500"
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    // Display mode
                    <>
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                        {medication.name}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                        {medication.dosageForm}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {medication.defaultInstructions || '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            medication.isActive
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {medication.isActive ? 'Active' : 'Deactivated'}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => startEditing(medication)}
                              className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              Edit
                            </button>
                            {medication.isActive && (
                              <button
                                type="button"
                                onClick={() => handleDeactivate(medication.id, medication.name)}
                                className="rounded-md border border-red-300 bg-white px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500"
                              >
                                Deactivate
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Summary footer */}
      <div className="mt-3 text-xs text-gray-600">
        {isAdmin ? (
          <span>
            Showing {displayedMedications.length} of {medications.length} medication{medications.length !== 1 ? 's' : ''}{' '}
            {!showAll && medications.length !== displayedMedications.length && (
              <span>({medications.length - displayedMedications.length} deactivated hidden)</span>
            )}
          </span>
        ) : (
          <span>
            {displayedMedications.length} active medication{displayedMedications.length !== 1 ? 's' : ''} available
          </span>
        )}
      </div>
    </div>
  );
}

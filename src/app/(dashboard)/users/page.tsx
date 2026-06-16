'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useToast } from '@/components/NotificationToast';
import type { Role } from '@/lib/auth/permissions';

// ----------------------------
// Types
// ----------------------------

interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
}

// ----------------------------
// Main Component
// ----------------------------

/**
 * User management list page (Admin only).
 * Displays all users for the current tenant with role badges and status.
 * Supports deactivating user accounts.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */
export default function UsersPage() {
  const { showToast } = useToast();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<Role | null>(null);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);

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

  // Fetch users list
  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch('/api/users');
      if (!response.ok) {
        if (response.status === 403) {
          showToast('error', 'Access denied. Admin privileges required.');
          return;
        }
        showToast('error', 'Failed to load users');
        return;
      }
      const data = await response.json();
      setUsers(data.data || []);
    } catch {
      showToast('error', 'Failed to load users');
    }
  }, [showToast]);

  // Initial data load
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const role = await fetchSession();
      setUserRole(role);
      await fetchUsers();
      setLoading(false);
    }
    loadData();
  }, [fetchSession, fetchUsers]);

  // Deactivate a user account
  const handleDeactivate = useCallback(
    async (userId: string, userName: string) => {
      const confirmed = window.confirm(
        `Are you sure you want to deactivate ${userName}'s account? They will no longer be able to log in.`
      );
      if (!confirmed) return;

      setDeactivatingId(userId);
      try {
        const response = await fetch(`/api/users/${userId}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          const data = await response.json();
          showToast('error', data.error?.message || 'Failed to deactivate user');
          return;
        }

        showToast('success', `${userName}'s account has been deactivated`);
        // Refresh the user list
        await fetchUsers();
      } catch {
        showToast('error', 'An unexpected error occurred');
      } finally {
        setDeactivatingId(null);
      }
    },
    [fetchUsers, showToast]
  );

  // Access denied for non-admin
  if (!loading && userRole && userRole !== 'Admin') {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-6 py-12 text-center">
        <p className="text-sm font-medium text-red-800">Access Denied</p>
        <p className="mt-1 text-xs text-red-600">
          Only administrators can manage user accounts.
        </p>
      </div>
    );
  }

  if (loading) {
    return <LoadingSpinner label="Loading users..." />;
  }

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Users
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage staff accounts and role assignments.
          </p>
        </div>
        <Link
          href="/users/new"
          className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          + New User
        </Link>
      </div>

      {/* User list */}
      <div className="mt-6">
        {users.length === 0 ? (
          <div className="rounded-md border border-gray-200 bg-gray-50 px-6 py-12 text-center">
            <p className="text-sm text-gray-600">No users found.</p>
            <p className="mt-1 text-xs text-gray-600">
              Create a new user to get started.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                  >
                    Name
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                  >
                    Email
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                  >
                    Role
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                  >
                    Status
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500"
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                      {user.name}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                      {user.email}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <RoleBadge role={user.role} />
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <StatusBadge isActive={user.isActive} />
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                      {user.isActive && (
                        <button
                          type="button"
                          onClick={() => handleDeactivate(user.id, user.name)}
                          disabled={deactivatingId === user.id}
                          className="text-red-600 hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label={`Deactivate ${user.name}`}
                        >
                          {deactivatingId === user.id
                            ? 'Deactivating...'
                            : 'Deactivate'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ----------------------------
// Helper Components
// ----------------------------

/**
 * Badge displaying the user role with distinct colors.
 */
function RoleBadge({ role }: { role: Role }) {
  const styles: Record<Role, string> = {
    Admin: 'bg-purple-100 text-purple-800',
    Doctor: 'bg-blue-100 text-blue-800',
    Medical_Assistant: 'bg-green-100 text-green-800',
  };

  const labels: Record<Role, string> = {
    Admin: 'Admin',
    Doctor: 'Doctor',
    Medical_Assistant: 'Medical Assistant',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[role]}`}
    >
      {labels[role]}
    </span>
  );
}

/**
 * Badge displaying active/inactive status.
 */
function StatusBadge({ isActive }: { isActive: boolean }) {
  if (isActive) {
    return (
      <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
        Active
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
      Inactive
    </span>
  );
}

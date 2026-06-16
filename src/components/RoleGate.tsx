'use client';

import { hasPermission, type Feature, type Role } from '@/lib/auth/permissions';

interface RoleGateProps {
  /** The feature to check permission for */
  feature: Feature;
  /** The current user's role */
  role: Role;
  /** Content to render if the user has permission */
  children: React.ReactNode;
}

/**
 * Conditionally renders children based on whether the user's role
 * has permission for the specified feature.
 *
 * Usage:
 * ```tsx
 * <RoleGate feature="financial" role={user.role}>
 *   <FinancialLink />
 * </RoleGate>
 * ```
 */
export function RoleGate({ feature, role, children }: RoleGateProps) {
  if (!hasPermission(role, feature)) {
    return null;
  }

  return <>{children}</>;
}

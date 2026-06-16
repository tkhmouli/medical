import { AuthorizationError } from '@/lib/errors';

/**
 * Platform features that can be gated by role permissions.
 */
export type Feature =
  | 'patient_management'
  | 'appointments'
  | 'prescriptions'
  | 'medications'
  | 'reminders'
  | 'financial'
  | 'user_management';

/**
 * User roles supported by the platform.
 */
export type Role = 'Admin' | 'Doctor' | 'Medical_Assistant';

/**
 * All features defined in the platform.
 */
export const ALL_FEATURES: Feature[] = [
  'patient_management',
  'appointments',
  'prescriptions',
  'medications',
  'reminders',
  'financial',
  'user_management',
];

/**
 * Permission matrix mapping each role to its allowed features.
 *
 * - Admin: all features
 * - Doctor: all except user_management and medications (can read catalog for prescription selection, but not manage it)
 * - Medical_Assistant: patient_management, appointments, reminders only
 */
export const PERMISSION_MATRIX: Record<Role, Set<Feature>> = {
  Admin: new Set<Feature>([
    'patient_management',
    'appointments',
    'prescriptions',
    'medications',
    'reminders',
    'financial',
    'user_management',
  ]),
  Doctor: new Set<Feature>([
    'patient_management',
    'appointments',
    'prescriptions',
    'reminders',
    'financial',
  ]),
  Medical_Assistant: new Set<Feature>([
    'patient_management',
    'appointments',
    'reminders',
  ]),
};

/**
 * Checks whether a given role has permission to access a feature.
 * Returns false for unknown roles.
 */
export function hasPermission(role: Role, feature: Feature): boolean {
  return PERMISSION_MATRIX[role]?.has(feature) ?? false;
}

/**
 * Asserts that a role has permission to access a feature.
 * Throws AuthorizationError if the role lacks the required permission.
 */
export function requirePermission(role: Role, feature: Feature): void {
  if (!hasPermission(role, feature)) {
    throw new AuthorizationError();
  }
}

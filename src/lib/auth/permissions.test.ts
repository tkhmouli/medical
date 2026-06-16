import { describe, it, expect } from 'vitest';
import {
  hasPermission,
  requirePermission,
  PERMISSION_MATRIX,
  ALL_FEATURES,
  type Role,
  type Feature,
} from './permissions';
import { AuthorizationError } from '@/lib/errors';

describe('PERMISSION_MATRIX', () => {
  it('Admin has access to all features', () => {
    for (const feature of ALL_FEATURES) {
      expect(PERMISSION_MATRIX.Admin.has(feature)).toBe(true);
    }
  });

  it('Doctor has access to patient_management, appointments, prescriptions, reminders, financial', () => {
    const doctorAllowed: Feature[] = [
      'patient_management',
      'appointments',
      'prescriptions',
      'reminders',
      'financial',
    ];
    for (const feature of doctorAllowed) {
      expect(PERMISSION_MATRIX.Doctor.has(feature)).toBe(true);
    }
  });

  it('Doctor does NOT have access to user_management or medications', () => {
    expect(PERMISSION_MATRIX.Doctor.has('user_management')).toBe(false);
    expect(PERMISSION_MATRIX.Doctor.has('medications')).toBe(false);
  });

  it('Medical_Assistant has access to patient_management, appointments, reminders', () => {
    const maAllowed: Feature[] = [
      'patient_management',
      'appointments',
      'reminders',
    ];
    for (const feature of maAllowed) {
      expect(PERMISSION_MATRIX.Medical_Assistant.has(feature)).toBe(true);
    }
  });

  it('Medical_Assistant does NOT have access to prescriptions, medications, financial, user_management', () => {
    const maRestricted: Feature[] = [
      'prescriptions',
      'medications',
      'financial',
      'user_management',
    ];
    for (const feature of maRestricted) {
      expect(PERMISSION_MATRIX.Medical_Assistant.has(feature)).toBe(false);
    }
  });
});

describe('hasPermission', () => {
  const roles: Role[] = ['Admin', 'Doctor', 'Medical_Assistant'];

  it('returns true for Admin on every feature', () => {
    for (const feature of ALL_FEATURES) {
      expect(hasPermission('Admin', feature)).toBe(true);
    }
  });

  it('returns true for Doctor on allowed features', () => {
    expect(hasPermission('Doctor', 'patient_management')).toBe(true);
    expect(hasPermission('Doctor', 'appointments')).toBe(true);
    expect(hasPermission('Doctor', 'prescriptions')).toBe(true);
    expect(hasPermission('Doctor', 'reminders')).toBe(true);
    expect(hasPermission('Doctor', 'financial')).toBe(true);
  });

  it('returns false for Doctor on restricted features', () => {
    expect(hasPermission('Doctor', 'user_management')).toBe(false);
    expect(hasPermission('Doctor', 'medications')).toBe(false);
  });

  it('returns true for Medical_Assistant on allowed features', () => {
    expect(hasPermission('Medical_Assistant', 'patient_management')).toBe(true);
    expect(hasPermission('Medical_Assistant', 'appointments')).toBe(true);
    expect(hasPermission('Medical_Assistant', 'reminders')).toBe(true);
  });

  it('returns false for Medical_Assistant on restricted features', () => {
    expect(hasPermission('Medical_Assistant', 'prescriptions')).toBe(false);
    expect(hasPermission('Medical_Assistant', 'medications')).toBe(false);
    expect(hasPermission('Medical_Assistant', 'financial')).toBe(false);
    expect(hasPermission('Medical_Assistant', 'user_management')).toBe(false);
  });

  it('returns consistent results with the PERMISSION_MATRIX', () => {
    for (const role of roles) {
      for (const feature of ALL_FEATURES) {
        const expected = PERMISSION_MATRIX[role].has(feature);
        expect(hasPermission(role, feature)).toBe(expected);
      }
    }
  });
});

describe('requirePermission', () => {
  it('does not throw when role has permission', () => {
    expect(() => requirePermission('Admin', 'user_management')).not.toThrow();
    expect(() => requirePermission('Doctor', 'prescriptions')).not.toThrow();
    expect(() => requirePermission('Medical_Assistant', 'appointments')).not.toThrow();
  });

  it('throws AuthorizationError when role lacks permission', () => {
    expect(() => requirePermission('Doctor', 'user_management')).toThrow(AuthorizationError);
    expect(() => requirePermission('Doctor', 'medications')).toThrow(AuthorizationError);
    expect(() => requirePermission('Medical_Assistant', 'prescriptions')).toThrow(AuthorizationError);
    expect(() => requirePermission('Medical_Assistant', 'financial')).toThrow(AuthorizationError);
  });

  it('throws AuthorizationError with "Access denied" message', () => {
    try {
      requirePermission('Medical_Assistant', 'user_management');
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(AuthorizationError);
      expect((error as AuthorizationError).message).toBe('Access denied');
      expect((error as AuthorizationError).statusCode).toBe(403);
    }
  });
});

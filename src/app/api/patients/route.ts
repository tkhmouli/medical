import { NextResponse } from 'next/server';
import { withAuthAndPermission, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { successResponse, handleApiError } from '@/lib/api-response';
import * as PatientService from '@/lib/services/patient-service';
import type { PatientSearchCriteria } from '@/lib/services/patient-service';

/**
 * GET /api/patients — List/search patients for the tenant
 * Accessible to: Admin, Doctor, Medical_Assistant
 *
 * Query params (all optional):
 * - firstName: partial match (case-insensitive)
 * - lastName: partial match (case-insensitive)
 * - phoneNumber: partial match (case-insensitive)
 * - dateOfBirth: exact match (YYYY-MM-DD)
 *
 * If no query params are provided, returns all patients for the tenant.
 */
export const GET = withAuthAndPermission('patient_management', async (request: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(request.url);

    const criteria: PatientSearchCriteria = {};

    const firstName = searchParams.get('firstName');
    const lastName = searchParams.get('lastName');
    const phoneNumber = searchParams.get('phoneNumber');
    const dateOfBirth = searchParams.get('dateOfBirth');

    if (firstName) criteria.firstName = firstName;
    if (lastName) criteria.lastName = lastName;
    if (phoneNumber) criteria.phoneNumber = phoneNumber;
    if (dateOfBirth) criteria.dateOfBirth = dateOfBirth;

    const patients = await PatientService.search(request.user.tenantId, criteria);
    return NextResponse.json(successResponse(patients));
  } catch (error) {
    const { body, status } = handleApiError(error);
    return NextResponse.json(body, { status });
  }
});

/**
 * POST /api/patients — Create a new patient within the tenant
 * Accessible to: Admin, Doctor, Medical_Assistant
 */
export const POST = withAuthAndPermission('patient_management', async (request: AuthenticatedRequest) => {
  try {
    const body = await request.json();
    const patient = await PatientService.create(request.user.tenantId, body);
    return NextResponse.json(successResponse(patient), { status: 201 });
  } catch (error) {
    const { body, status } = handleApiError(error);
    return NextResponse.json(body, { status });
  }
});

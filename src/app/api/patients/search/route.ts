import { NextResponse } from 'next/server';
import { withAuthAndPermission, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { successResponse, handleApiError } from '@/lib/api-response';
import { ValidationError } from '@/lib/errors';
import * as PatientService from '@/lib/services/patient-service';

/**
 * GET /api/patients/search — Typeahead patient search (OR-based matching)
 * Accessible to: Admin, Doctor, Medical_Assistant (patient_management permission)
 *
 * Query params:
 * - q (required): Search query, minimum 2 characters
 * - limit (optional): Max results to return (default 20, max 50)
 *
 * Searches firstName, lastName, or phoneNumber using case-insensitive partial matching.
 * Returns minimal patient data for dropdown display.
 *
 * Requirements: 2.2, 4.2
 */
export const GET = withAuthAndPermission('patient_management', async (request: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(request.url);

    const q = searchParams.get('q');

    if (!q || q.length < 2) {
      throw new ValidationError('Search query must be at least 2 characters', {
        q: 'Search query must be at least 2 characters',
      });
    }

    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Math.min(Math.max(1, parseInt(limitParam, 10) || 20), 50) : 20;

    const results = await PatientService.quickSearch(request.user.tenantId, q, limit);
    return NextResponse.json(successResponse(results));
  } catch (error) {
    const { body, status } = handleApiError(error);
    return NextResponse.json(body, { status });
  }
});

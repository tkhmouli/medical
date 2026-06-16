import { NextResponse } from 'next/server';
import { withAuthAndPermission, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { successResponse, handleApiError } from '@/lib/api-response';
import * as FinancialService from '@/lib/services/financial-service';
import { ValidationError } from '@/lib/errors';

/**
 * GET /api/financial — Get financial summary for a date range
 * Accessible to: Admin, Doctor only (Medical_Assistant blocked via 'financial' permission)
 *
 * Query params:
 * - startDate (required): ISO date string (YYYY-MM-DD)
 * - endDate (required): ISO date string (YYYY-MM-DD)
 *
 * Requirements: 15.3
 */
export const GET = withAuthAndPermission('financial', async (request: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!startDate || !endDate) {
      throw new ValidationError('startDate and endDate are required');
    }

    const summary = await FinancialService.getSummary(
      request.user.tenantId,
      startDate,
      endDate
    );
    return NextResponse.json(successResponse(summary));
  } catch (error) {
    const { body, status } = handleApiError(error);
    return NextResponse.json(body, { status });
  }
});

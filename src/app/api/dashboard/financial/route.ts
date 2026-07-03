import { NextResponse } from 'next/server';
import { withAuthAndPermission, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { successResponse, handleApiError } from '@/lib/api-response';
import { getDashboardFinancials } from '@/lib/services/dashboard-service';

/**
 * GET /api/dashboard/financial — Financial summary statistics
 * Accessible to: Doctor, Admin (gated by 'financial' permission)
 *
 * Returns YTD revenue, monthly revenue, weekly revenue, and YTD patients seen.
 */
export const GET = withAuthAndPermission('financial', async (request: AuthenticatedRequest) => {
  try {
    const { tenantId } = request.user;
    const financials = await getDashboardFinancials(tenantId);

    return NextResponse.json(successResponse(financials));
  } catch (error) {
    const { body, status } = handleApiError(error);
    return NextResponse.json(body, { status });
  }
});

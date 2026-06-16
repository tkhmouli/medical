import { NextResponse } from 'next/server';
import { withAuthAndPermission, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { successResponse, handleApiError } from '@/lib/api-response';
import * as FinancialService from '@/lib/services/financial-service';

/**
 * POST /api/financial/entries — Create a new financial entry
 * Accessible to: Admin, Doctor only (Medical_Assistant blocked via 'financial' permission)
 *
 * Requirements: 15.1
 */
export const POST = withAuthAndPermission('financial', async (request: AuthenticatedRequest) => {
  try {
    const body = await request.json();
    const entry = await FinancialService.createEntry(request.user.tenantId, body);
    return NextResponse.json(successResponse(entry), { status: 201 });
  } catch (error) {
    const { body, status } = handleApiError(error);
    return NextResponse.json(body, { status });
  }
});

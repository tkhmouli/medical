import { NextResponse } from 'next/server';
import { withAuthAndPermission, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { successResponse, handleApiError } from '@/lib/api-response';
import * as FinancialService from '@/lib/services/financial-service';
import { ValidationError } from '@/lib/errors';

/**
 * PATCH /api/financial/entries/[id] — Update a financial entry
 * Accessible to: Admin, Doctor only (Medical_Assistant blocked via 'financial' permission)
 *
 * Requirements: 15.5
 */
export const PATCH = withAuthAndPermission(
  'financial',
  async (request: AuthenticatedRequest, context?: { params: Record<string, string> }) => {
    try {
      const entryId = context?.params?.id;
      if (!entryId) {
        throw new ValidationError('Entry ID is required');
      }

      const body = await request.json();
      const entry = await FinancialService.updateEntry(
        request.user.tenantId,
        entryId,
        body
      );
      return NextResponse.json(successResponse(entry));
    } catch (error) {
      const { body, status } = handleApiError(error);
      return NextResponse.json(body, { status });
    }
  }
);

import { describe, it, expect } from 'vitest';
import { successResponse, errorResponse, handleApiError } from './api-response';
import {
  AppError,
  NotFoundError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  ConflictError,
} from './errors';

describe('successResponse', () => {
  it('wraps data in a success envelope', () => {
    const result = successResponse({ id: '123', name: 'Test' });
    expect(result).toEqual({
      success: true,
      data: { id: '123', name: 'Test' },
    });
  });

  it('works with null data', () => {
    const result = successResponse(null);
    expect(result).toEqual({ success: true, data: null });
  });

  it('works with array data', () => {
    const result = successResponse([1, 2, 3]);
    expect(result).toEqual({ success: true, data: [1, 2, 3] });
  });
});

describe('errorResponse', () => {
  it('creates error envelope from AppError with fields', () => {
    const error = new ValidationError('Bad input', { email: 'Invalid email' });
    const result = errorResponse(error);
    expect(result).toEqual({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Bad input',
        details: { email: 'Invalid email' },
      },
    });
  });

  it('omits details when no fields present', () => {
    const error = new NotFoundError('Patient');
    const result = errorResponse(error);
    expect(result).toEqual({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Patient not found',
      },
    });
    expect(result.error!.details).toBeUndefined();
  });
});

describe('handleApiError', () => {
  it('maps NotFoundError to 404', () => {
    const { body, status } = handleApiError(new NotFoundError('User'));
    expect(status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.error!.code).toBe('NOT_FOUND');
    expect(body.error!.message).toBe('User not found');
  });

  it('maps ValidationError to 400 with field details', () => {
    const fields = { name: 'Name is required' };
    const { body, status } = handleApiError(new ValidationError('Invalid', fields));
    expect(status).toBe(400);
    expect(body.error!.code).toBe('VALIDATION_ERROR');
    expect(body.error!.details).toEqual(fields);
  });

  it('maps AuthenticationError to 401', () => {
    const { body, status } = handleApiError(new AuthenticationError());
    expect(status).toBe(401);
    expect(body.error!.code).toBe('AUTHENTICATION_ERROR');
  });

  it('maps AuthorizationError to 403', () => {
    const { body, status } = handleApiError(new AuthorizationError());
    expect(status).toBe(403);
    expect(body.error!.code).toBe('AUTHORIZATION_ERROR');
  });

  it('maps ConflictError to 409', () => {
    const { body, status } = handleApiError(new ConflictError('Duplicate'));
    expect(status).toBe(409);
    expect(body.error!.code).toBe('CONFLICT');
  });

  it('maps generic AppError to its statusCode', () => {
    const { body, status } = handleApiError(new AppError('CUSTOM', 422, 'Custom'));
    expect(status).toBe(422);
    expect(body.error!.code).toBe('CUSTOM');
  });

  it('maps unknown errors to 500 without leaking details', () => {
    const { body, status } = handleApiError(new Error('secret internal error'));
    expect(status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error!.code).toBe('INTERNAL_ERROR');
    expect(body.error!.message).toBe('An unexpected error occurred');
  });

  it('maps non-Error values to 500', () => {
    const { body, status } = handleApiError('some string');
    expect(status).toBe(500);
    expect(body.error!.code).toBe('INTERNAL_ERROR');
  });
});

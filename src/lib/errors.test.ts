import { describe, it, expect } from 'vitest';
import {
  AppError,
  NotFoundError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  ConflictError,
} from './errors';

describe('AppError', () => {
  it('sets code, statusCode, message, and fields', () => {
    const error = new AppError('TEST_CODE', 418, 'test message', {
      field1: 'error1',
    });
    expect(error.code).toBe('TEST_CODE');
    expect(error.statusCode).toBe(418);
    expect(error.message).toBe('test message');
    expect(error.fields).toEqual({ field1: 'error1' });
    expect(error.name).toBe('AppError');
    expect(error).toBeInstanceOf(Error);
  });

  it('works without fields', () => {
    const error = new AppError('NO_FIELDS', 500, 'no fields');
    expect(error.fields).toBeUndefined();
  });
});

describe('NotFoundError', () => {
  it('has statusCode 404 and correct message', () => {
    const error = new NotFoundError('Patient');
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe('NOT_FOUND');
    expect(error.message).toBe('Patient not found');
    expect(error.name).toBe('NotFoundError');
    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(Error);
  });
});

describe('ValidationError', () => {
  it('has statusCode 400 and supports field-level errors', () => {
    const fields = { firstName: 'First name is required', lastName: 'Last name is required' };
    const error = new ValidationError('Missing required fields', fields);
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.message).toBe('Missing required fields');
    expect(error.fields).toEqual(fields);
    expect(error.name).toBe('ValidationError');
    expect(error).toBeInstanceOf(AppError);
  });

  it('works without field details', () => {
    const error = new ValidationError('Invalid input');
    expect(error.statusCode).toBe(400);
    expect(error.fields).toBeUndefined();
  });
});

describe('AuthenticationError', () => {
  it('has statusCode 401 and default message', () => {
    const error = new AuthenticationError();
    expect(error.statusCode).toBe(401);
    expect(error.code).toBe('AUTHENTICATION_ERROR');
    expect(error.message).toBe('Invalid email or password');
    expect(error.name).toBe('AuthenticationError');
    expect(error).toBeInstanceOf(AppError);
  });

  it('accepts a custom message', () => {
    const error = new AuthenticationError('Session expired');
    expect(error.message).toBe('Session expired');
  });
});

describe('AuthorizationError', () => {
  it('has statusCode 403 and default message', () => {
    const error = new AuthorizationError();
    expect(error.statusCode).toBe(403);
    expect(error.code).toBe('AUTHORIZATION_ERROR');
    expect(error.message).toBe('Access denied');
    expect(error.name).toBe('AuthorizationError');
    expect(error).toBeInstanceOf(AppError);
  });

  it('accepts a custom message', () => {
    const error = new AuthorizationError('Insufficient permissions');
    expect(error.message).toBe('Insufficient permissions');
  });
});

describe('ConflictError', () => {
  it('has statusCode 409 and given message', () => {
    const error = new ConflictError('Email already in use');
    expect(error.statusCode).toBe(409);
    expect(error.code).toBe('CONFLICT');
    expect(error.message).toBe('Email already in use');
    expect(error.name).toBe('ConflictError');
    expect(error).toBeInstanceOf(AppError);
  });
});

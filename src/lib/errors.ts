/**
 * Base application error class.
 * All domain-specific errors extend from this class.
 */
export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly fields?: Record<string, string>;

  constructor(
    code: string,
    statusCode: number,
    message: string,
    fields?: Record<string, string>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.fields = fields;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when a requested resource cannot be found.
 * Maps to HTTP 404.
 */
export class NotFoundError extends AppError {
  constructor(resource: string) {
    super('NOT_FOUND', 404, `${resource} not found`);
  }
}

/**
 * Thrown when input validation fails.
 * Maps to HTTP 400. Includes optional field-level error details.
 */
export class ValidationError extends AppError {
  constructor(message: string, fields?: Record<string, string>) {
    super('VALIDATION_ERROR', 400, message, fields);
  }
}

/**
 * Thrown when authentication fails (invalid credentials or expired session).
 * Maps to HTTP 401.
 */
export class AuthenticationError extends AppError {
  constructor(message: string = 'Invalid email or password') {
    super('AUTHENTICATION_ERROR', 401, message);
  }
}

/**
 * Thrown when the user lacks the required role/permissions.
 * Maps to HTTP 403.
 */
export class AuthorizationError extends AppError {
  constructor(message: string = 'Access denied') {
    super('AUTHORIZATION_ERROR', 403, message);
  }
}

/**
 * Thrown when an operation would create a conflict (e.g., duplicate email).
 * Maps to HTTP 409.
 */
export class ConflictError extends AppError {
  constructor(message: string) {
    super('CONFLICT', 409, message);
  }
}

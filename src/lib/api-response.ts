import { AppError } from './errors';

/**
 * Standard API response envelope.
 * All API routes return this format for consistency.
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, string>;
  };
}

/**
 * Creates a successful API response.
 */
export function successResponse<T>(data: T): ApiResponse<T> {
  return {
    success: true,
    data,
  };
}

/**
 * Creates an error API response from an AppError instance.
 */
export function errorResponse(error: AppError): ApiResponse<never> {
  return {
    success: false,
    error: {
      code: error.code,
      message: error.message,
      ...(error.fields && { details: error.fields }),
    },
  };
}

/**
 * Maps any error (domain or unexpected) to a structured API response
 * with the appropriate HTTP status code.
 *
 * Returns an object with the response body and status code,
 * suitable for use in Next.js route handlers.
 */
export function handleApiError(error: unknown): {
  body: ApiResponse<never>;
  status: number;
} {
  if (error instanceof AppError) {
    return {
      body: errorResponse(error),
      status: error.statusCode,
    };
  }

  // Unexpected errors — do not leak internal details
  return {
    body: {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    },
    status: 500,
  };
}

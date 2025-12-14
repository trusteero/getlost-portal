/**
 * Standardized API response utilities
 * Provides consistent error and success responses across all API routes
 */

import { NextResponse } from "next/server";
import { env } from "@/env";

/**
 * Standard error response format
 */
export interface ApiErrorResponse {
  error: string;
  code?: string;
  details?: string;
  hint?: string;
}

/**
 * Standard success response format
 */
export interface ApiSuccessResponse<T = unknown> {
  success?: boolean;
  data?: T;
  message?: string;
}

/**
 * Common error codes used across the application
 */
export const ERROR_CODES = {
  // Authentication & Authorization
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  SESSION_EXPIRED: "SESSION_EXPIRED",
  
  // Validation
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_INPUT: "INVALID_INPUT",
  MISSING_REQUIRED_FIELD: "MISSING_REQUIRED_FIELD",
  INVALID_FILE_TYPE: "INVALID_FILE_TYPE",
  FILE_TOO_LARGE: "FILE_TOO_LARGE",
  
  // Not Found
  NOT_FOUND: "NOT_FOUND",
  RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND",
  
  // Rate Limiting
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
  
  // Server Errors
  INTERNAL_ERROR: "INTERNAL_ERROR",
  DATABASE_ERROR: "DATABASE_ERROR",
  EXTERNAL_SERVICE_ERROR: "EXTERNAL_SERVICE_ERROR",
  
  // Business Logic
  CONFLICT: "CONFLICT",
  PAYMENT_ERROR: "PAYMENT_ERROR",
  CHECKOUT_ERROR: "CHECKOUT_ERROR",
  PURCHASE_ERROR: "PURCHASE_ERROR",
} as const;

/**
 * Create a standardized error response
 */
export function errorResponse(
  message: string,
  status: number = 500,
  options?: {
    code?: string;
    details?: string;
    hint?: string;
    error?: unknown;
  }
): NextResponse<ApiErrorResponse> {
  const isDevelopment = env.NODE_ENV === "development" || env.NODE_ENV === "test";
  
  const response: ApiErrorResponse = {
    error: message,
    ...(options?.code && { code: options.code }),
    ...(isDevelopment && options?.details && { details: options.details }),
    ...(isDevelopment && options?.hint && { hint: options.hint }),
  };

  // If error object provided, extract details in development
  if (isDevelopment && options?.error) {
    const err = options.error instanceof Error ? options.error : new Error(String(options.error));
    if (!response.details) {
      response.details = err.message;
    }
    if (err.stack && !response.hint) {
      response.hint = err.stack;
    }
  }

  return NextResponse.json(response, { status });
}

/**
 * Create a standardized success response
 */
export function successResponse<T>(
  data?: T,
  options?: {
    message?: string;
    status?: number;
  }
): NextResponse<ApiSuccessResponse<T>> {
  const response: ApiSuccessResponse<T> = {
    ...(data !== undefined && { data }),
    ...(options?.message && { message: options.message }),
    success: true,
  };

  return NextResponse.json(response, { status: options?.status || 200 });
}

/**
 * Common error response helpers for specific scenarios
 */
export const apiErrors = {
  /**
   * 401 Unauthorized - User is not authenticated
   */
  unauthorized: (message: string = "Unauthorized") =>
    errorResponse(message, 401, { code: ERROR_CODES.UNAUTHORIZED }),

  /**
   * 403 Forbidden - User is authenticated but lacks permission
   */
  forbidden: (message: string = "Forbidden") =>
    errorResponse(message, 403, { code: ERROR_CODES.FORBIDDEN }),

  /**
   * 404 Not Found - Resource doesn't exist
   */
  notFound: (resource: string = "Resource") =>
    errorResponse(`${resource} not found`, 404, { code: ERROR_CODES.NOT_FOUND }),

  /**
   * 400 Bad Request - Invalid input
   */
  badRequest: (message: string, code?: string) =>
    errorResponse(message, 400, { code: code || ERROR_CODES.INVALID_INPUT }),

  /**
   * 409 Conflict - Resource conflict (e.g., duplicate)
   */
  conflict: (message: string) =>
    errorResponse(message, 409, { code: ERROR_CODES.CONFLICT }),

  /**
   * 429 Too Many Requests - Rate limit exceeded
   */
  rateLimitExceeded: (message: string = "Too many requests. Please try again later.") =>
    errorResponse(message, 429, { code: ERROR_CODES.RATE_LIMIT_EXCEEDED }),

  /**
   * 500 Internal Server Error - Generic server error
   */
  internal: (message: string = "Internal server error", error?: unknown) =>
    errorResponse(message, 500, {
      code: ERROR_CODES.INTERNAL_ERROR,
      error,
    }),

  /**
   * 500 Database Error - Database operation failed
   */
  database: (message: string = "Database operation failed", error?: unknown) =>
    errorResponse(message, 500, {
      code: ERROR_CODES.DATABASE_ERROR,
      error,
    }),

  /**
   * 500 External Service Error - Third-party service failed
   */
  externalService: (service: string, error?: unknown) =>
    errorResponse(
      `${service} service error`,
      500,
      {
        code: ERROR_CODES.EXTERNAL_SERVICE_ERROR,
        error,
        hint: `Failed to communicate with ${service}`,
      }
    ),
};

/**
 * Validation error helper
 */
export function validationError(
  field: string,
  message: string,
  details?: string
): NextResponse<ApiErrorResponse> {
  return errorResponse(
    `Validation error: ${message}`,
    400,
    {
      code: ERROR_CODES.VALIDATION_ERROR,
      details: details || `Field: ${field}`,
    }
  );
}

/**
 * File validation error helper
 */
export function fileValidationError(
  message: string,
  code: string = ERROR_CODES.INVALID_FILE_TYPE
): NextResponse<ApiErrorResponse> {
  return errorResponse(message, 400, { code });
}


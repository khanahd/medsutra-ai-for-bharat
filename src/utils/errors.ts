/**
 * Custom Error Classes for MedSutra AI
 * Provides structured error handling across all modules
 */

export enum ErrorCode {
  // Input Validation Errors (400)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT = 'INVALID_FORMAT',

  // Authentication Errors (401)
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',

  // Authorization Errors (403)
  AUTHORIZATION_FAILED = 'AUTHORIZATION_FAILED',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',

  // Resource Errors (404)
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  PATIENT_NOT_FOUND = 'PATIENT_NOT_FOUND',
  DOCUMENT_NOT_FOUND = 'DOCUMENT_NOT_FOUND',

  // Processing Errors (500)
  PROCESSING_ERROR = 'PROCESSING_ERROR',
  LLM_TIMEOUT = 'LLM_TIMEOUT',
  LLM_ERROR = 'LLM_ERROR',
  NER_FAILURE = 'NER_FAILURE',
  SUMMARIZATION_ERROR = 'SUMMARIZATION_ERROR',
  ANALYSIS_ERROR = 'ANALYSIS_ERROR',

  // Data Access Errors (500)
  DATABASE_ERROR = 'DATABASE_ERROR',
  DATABASE_CONNECTION_ERROR = 'DATABASE_CONNECTION_ERROR',
  QUERY_ERROR = 'QUERY_ERROR',
  EMR_CONNECTION_ERROR = 'EMR_CONNECTION_ERROR',
  EMR_UNAVAILABLE = 'EMR_UNAVAILABLE',

  // Resource Constraint Errors (503)
  CAPACITY_EXCEEDED = 'CAPACITY_EXCEEDED',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // Compliance Errors (422)
  COMPLIANCE_ERROR = 'COMPLIANCE_ERROR',
  UNVERIFIABLE_STATEMENT = 'UNVERIFIABLE_STATEMENT',
  VALIDATION_FAILED = 'VALIDATION_FAILED',

  // System Errors (500)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  ENCRYPTION_ERROR = 'ENCRYPTION_ERROR',
  DECRYPTION_ERROR = 'DECRYPTION_ERROR'
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly timestamp: Date;
  public readonly details?: any;

  constructor(
    message: string,
    code: ErrorCode,
    statusCode: number = 500,
    isOperational: boolean = true,
    details?: any
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);

    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date();
    this.details = details;

    Error.captureStackTrace(this);
  }
}

// Input Validation Errors
export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, ErrorCode.VALIDATION_ERROR, 400, true, details);
  }
}

export class InvalidInputError extends AppError {
  constructor(message: string, details?: any) {
    super(message, ErrorCode.INVALID_INPUT, 400, true, details);
  }
}

export class MissingFieldError extends AppError {
  constructor(field: string) {
    super(`Missing required field: ${field}`, ErrorCode.MISSING_REQUIRED_FIELD, 400, true, { field });
  }
}

// Authentication Errors
export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed', details?: any) {
    super(message, ErrorCode.AUTHENTICATION_FAILED, 401, true, details);
  }
}

export class InvalidTokenError extends AppError {
  constructor(message: string = 'Invalid or expired token') {
    super(message, ErrorCode.INVALID_TOKEN, 401, true);
  }
}

export class AccountLockedError extends AppError {
  constructor(message: string, details?: any) {
    super(message, ErrorCode.ACCOUNT_LOCKED, 401, true, details);
  }
}

// Authorization Errors
export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions', details?: any) {
    super(message, ErrorCode.AUTHORIZATION_FAILED, 403, true, details);
  }
}

// Resource Errors
export class ResourceNotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    const message = id ? `${resource} with ID ${id} not found` : `${resource} not found`;
    super(message, ErrorCode.RESOURCE_NOT_FOUND, 404, true, { resource, id });
  }
}

export class PatientNotFoundError extends AppError {
  constructor(patientId: string) {
    super(`Patient with ID ${patientId} not found`, ErrorCode.PATIENT_NOT_FOUND, 404, true, { patientId });
  }
}

// Processing Errors
export class ProcessingError extends AppError {
  constructor(message: string, details?: any) {
    super(message, ErrorCode.PROCESSING_ERROR, 500, true, details);
  }
}

export class LLMTimeoutError extends AppError {
  constructor(message: string = 'LLM request timed out', details?: any) {
    super(message, ErrorCode.LLM_TIMEOUT, 500, true, details);
  }
}

export class LLMError extends AppError {
  constructor(message: string, details?: any) {
    super(message, ErrorCode.LLM_ERROR, 500, true, details);
  }
}

export class NERFailureError extends AppError {
  constructor(message: string = 'Named Entity Recognition failed', details?: any) {
    super(message, ErrorCode.NER_FAILURE, 500, true, details);
  }
}

// Data Access Errors
export class DatabaseError extends AppError {
  constructor(message: string, details?: any) {
    super(message, ErrorCode.DATABASE_ERROR, 500, true, details);
  }
}

export class EMRConnectionError extends AppError {
  constructor(message: string = 'Failed to connect to EMR system', details?: any) {
    super(message, ErrorCode.EMR_CONNECTION_ERROR, 500, true, details);
  }
}

export class EMRUnavailableError extends AppError {
  constructor(message: string = 'EMR system is currently unavailable') {
    super(message, ErrorCode.EMR_UNAVAILABLE, 503, true);
  }
}

// Resource Constraint Errors
export class CapacityExceededError extends AppError {
  constructor(message: string = 'System capacity exceeded', details?: any) {
    super(message, ErrorCode.CAPACITY_EXCEEDED, 503, true, details);
  }
}

export class TimeoutError extends AppError {
  constructor(message: string = 'Request timed out', details?: any) {
    super(message, ErrorCode.TIMEOUT_ERROR, 503, true, details);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Rate limit exceeded', details?: any) {
    super(message, ErrorCode.RATE_LIMIT_EXCEEDED, 429, true, details);
  }
}

// Compliance Errors
export class ComplianceError extends AppError {
  constructor(message: string, details?: any) {
    super(message, ErrorCode.COMPLIANCE_ERROR, 422, true, details);
  }
}

export class UnverifiableStatementError extends AppError {
  constructor(statement: string) {
    super(
      'Statement could not be verified against approved sources',
      ErrorCode.UNVERIFIABLE_STATEMENT,
      422,
      true,
      { statement }
    );
  }
}

// System Errors
export class InternalError extends AppError {
  constructor(message: string = 'Internal server error', details?: any) {
    super(message, ErrorCode.INTERNAL_ERROR, 500, false, details);
  }
}

export class ConfigurationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, ErrorCode.CONFIGURATION_ERROR, 500, false, details);
  }
}

/**
 * Check if error is operational (expected) or programming error
 */
export function isOperationalError(error: Error): boolean {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
}

/**
 * Get user-friendly error message
 */
export function getUserFriendlyMessage(error: Error): string {
  if (error instanceof AppError) {
    return error.message;
  }

  // Generic messages for unexpected errors
  return 'An unexpected error occurred. Please try again later.';
}

/**
 * Get HTTP status code from error
 */
export function getStatusCode(error: Error): number {
  if (error instanceof AppError) {
    return error.statusCode;
  }
  return 500;
}

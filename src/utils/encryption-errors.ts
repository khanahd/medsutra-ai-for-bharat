/**
 * Custom error classes for encryption operations
 */

export class EncryptionError extends Error {
  constructor(message: string, public readonly originalError?: Error) {
    super(message);
    this.name = 'EncryptionError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class DecryptionError extends Error {
  constructor(message: string, public readonly originalError?: Error) {
    super(message);
    this.name = 'DecryptionError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class KeyManagementError extends Error {
  constructor(message: string, public readonly originalError?: Error) {
    super(message);
    this.name = 'KeyManagementError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class TLSConfigurationError extends Error {
  constructor(message: string, public readonly originalError?: Error) {
    super(message);
    this.name = 'TLSConfigurationError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Handle encryption errors with proper logging and user-friendly messages
 */
export function handleEncryptionError(error: unknown): never {
  if (error instanceof EncryptionError) {
    throw error;
  }

  if (error instanceof Error) {
    throw new EncryptionError('Encryption operation failed', error);
  }

  throw new EncryptionError('Unknown encryption error occurred');
}

/**
 * Handle decryption errors with proper logging and user-friendly messages
 */
export function handleDecryptionError(error: unknown): never {
  if (error instanceof DecryptionError) {
    throw error;
  }

  if (error instanceof Error) {
    throw new DecryptionError('Decryption operation failed', error);
  }

  throw new DecryptionError('Unknown decryption error occurred');
}

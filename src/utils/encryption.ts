import crypto from 'crypto';
import { logger } from './logger';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 16 bytes for AES
const AUTH_TAG_LENGTH = 16; // 16 bytes for GCM auth tag
const KEY_LENGTH = 32; // 32 bytes for AES-256

export interface EncryptedData {
  ciphertext: string;
  algorithm: 'AES-256-GCM';
  keyId: string;
  iv: string;
  authTag: string;
}

/**
 * Get encryption key from environment or generate one
 */
function getEncryptionKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_KEY;
  
  if (!keyHex) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }

  const key = Buffer.from(keyHex, 'hex');
  
  if (key.length !== KEY_LENGTH) {
    throw new Error(`Encryption key must be ${KEY_LENGTH} bytes (${KEY_LENGTH * 2} hex characters)`);
  }

  return key;
}

/**
 * Get key ID from environment
 */
function getKeyId(): string {
  return process.env.KEY_ID || 'default_key';
}

/**
 * Encrypt data using AES-256-GCM
 * @param plaintext - Data to encrypt (string or Buffer)
 * @returns Encrypted data object
 */
export function encrypt(plaintext: string | Buffer): EncryptedData {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    const plaintextBuffer = typeof plaintext === 'string' 
      ? Buffer.from(plaintext, 'utf8') 
      : plaintext;
    
    const encrypted = Buffer.concat([
      cipher.update(plaintextBuffer),
      cipher.final()
    ]);
    
    const authTag = cipher.getAuthTag();
    
    return {
      ciphertext: encrypted.toString('base64'),
      algorithm: 'AES-256-GCM',
      keyId: getKeyId(),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64')
    };
  } catch (error) {
    logger.error('Encryption failed:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt data using AES-256-GCM
 * @param encryptedData - Encrypted data object
 * @returns Decrypted plaintext as Buffer
 */
export function decrypt(encryptedData: EncryptedData): Buffer {
  try {
    if (encryptedData.algorithm !== 'AES-256-GCM') {
      throw new Error(`Unsupported encryption algorithm: ${encryptedData.algorithm}`);
    }

    const key = getEncryptionKey();
    const iv = Buffer.from(encryptedData.iv, 'base64');
    const authTag = Buffer.from(encryptedData.authTag, 'base64');
    const ciphertext = Buffer.from(encryptedData.ciphertext, 'base64');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final()
    ]);
    
    return decrypted;
  } catch (error) {
    logger.error('Decryption failed:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Decrypt data and return as string
 * @param encryptedData - Encrypted data object
 * @returns Decrypted plaintext as string
 */
export function decryptToString(encryptedData: EncryptedData): string {
  const decrypted = decrypt(encryptedData);
  return decrypted.toString('utf8');
}

/**
 * Encrypt patient PHI data for database storage
 * @param phi - Patient health information object
 * @returns Encrypted buffer for database storage
 */
export function encryptPHI(phi: Record<string, any>): Buffer {
  const phiJson = JSON.stringify(phi);
  const encrypted = encrypt(phiJson);
  
  // Store the entire encrypted object as JSON in the database
  return Buffer.from(JSON.stringify(encrypted), 'utf8');
}

/**
 * Decrypt patient PHI data from database
 * @param encryptedBuffer - Encrypted buffer from database
 * @returns Decrypted PHI object
 */
export function decryptPHI(encryptedBuffer: Buffer): Record<string, any> {
  const encryptedJson = encryptedBuffer.toString('utf8');
  const encryptedData: EncryptedData = JSON.parse(encryptedJson);
  
  const decryptedJson = decryptToString(encryptedData);
  return JSON.parse(decryptedJson);
}

/**
 * Generate a new encryption key (for key rotation)
 * @returns Hex-encoded encryption key
 */
export function generateEncryptionKey(): string {
  const key = crypto.randomBytes(KEY_LENGTH);
  return key.toString('hex');
}

/**
 * Validate encryption key format
 * @param keyHex - Hex-encoded key
 * @returns True if valid
 */
export function validateEncryptionKey(keyHex: string): boolean {
  try {
    const key = Buffer.from(keyHex, 'hex');
    return key.length === KEY_LENGTH;
  } catch {
    return false;
  }
}

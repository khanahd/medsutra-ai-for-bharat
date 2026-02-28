import https from 'https';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

export interface TLSConfig {
  enabled: boolean;
  cert?: Buffer;
  key?: Buffer;
  ca?: Buffer;
  minVersion: string;
  ciphers: string;
}

/**
 * TLS 1.3 configuration for secure communications
 */
export function getTLSConfig(): TLSConfig {
  const tlsEnabled = process.env.TLS_ENABLED === 'true';

  if (!tlsEnabled) {
    logger.warn('TLS is disabled. This should only be used in development!');
    return {
      enabled: false,
      minVersion: 'TLSv1.3',
      ciphers: getTLS13Ciphers()
    };
  }

  const certPath = process.env.TLS_CERT_PATH;
  const keyPath = process.env.TLS_KEY_PATH;
  const caPath = process.env.TLS_CA_PATH;

  if (!certPath || !keyPath) {
    throw new Error('TLS_CERT_PATH and TLS_KEY_PATH must be set when TLS is enabled');
  }

  try {
    const cert = fs.readFileSync(path.resolve(certPath));
    const key = fs.readFileSync(path.resolve(keyPath));
    const ca = caPath ? fs.readFileSync(path.resolve(caPath)) : undefined;

    logger.info('TLS configuration loaded successfully');

    return {
      enabled: true,
      cert,
      key,
      ca,
      minVersion: 'TLSv1.3',
      ciphers: getTLS13Ciphers()
    };
  } catch (error) {
    logger.error('Failed to load TLS certificates:', error);
    throw new Error('TLS configuration failed');
  }
}

/**
 * Get TLS 1.3 cipher suites
 */
function getTLS13Ciphers(): string {
  return [
    'TLS_AES_256_GCM_SHA384',
    'TLS_CHACHA20_POLY1305_SHA256',
    'TLS_AES_128_GCM_SHA256'
  ].join(':');
}

/**
 * Create HTTPS server with TLS 1.3
 */
export function createSecureServer(app: any): https.Server | null {
  const tlsConfig = getTLSConfig();

  if (!tlsConfig.enabled) {
    return null;
  }

  const httpsOptions: https.ServerOptions = {
    cert: tlsConfig.cert,
    key: tlsConfig.key,
    ca: tlsConfig.ca,
    minVersion: tlsConfig.minVersion as any,
    ciphers: tlsConfig.ciphers,
    honorCipherOrder: true,
    requestCert: false,
    rejectUnauthorized: true
  };

  return https.createServer(httpsOptions, app);
}

/**
 * Validate TLS configuration
 */
export function validateTLSConfig(): boolean {
  try {
    const config = getTLSConfig();
    
    if (!config.enabled) {
      logger.warn('TLS validation skipped - TLS is disabled');
      return true;
    }

    if (!config.cert || !config.key) {
      logger.error('TLS validation failed - missing certificate or key');
      return false;
    }

    logger.info('TLS configuration validated successfully');
    return true;
  } catch (error) {
    logger.error('TLS validation failed:', error);
    return false;
  }
}

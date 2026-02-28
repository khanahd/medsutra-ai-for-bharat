#!/usr/bin/env ts-node

/**
 * Script to generate a new AES-256 encryption key
 * Usage: npm run generate-key
 */

import { generateEncryptionKey, validateEncryptionKey } from '../src/utils/encryption';

function main() {
  console.log('Generating new AES-256 encryption key...\n');
  
  const key = generateEncryptionKey();
  
  console.log('✓ Key generated successfully!\n');
  console.log('Add this to your .env file:');
  console.log('─'.repeat(80));
  console.log(`ENCRYPTION_KEY=${key}`);
  console.log(`KEY_ID=key_v${Date.now()}`);
  console.log('─'.repeat(80));
  console.log('\n⚠️  IMPORTANT SECURITY NOTES:');
  console.log('1. Never commit this key to version control');
  console.log('2. Store it securely (e.g., in a secrets manager)');
  console.log('3. Rotate keys regularly (recommended: every 90 days)');
  console.log('4. Keep backup of old keys for decrypting historical data');
  console.log('\nKey validation:', validateEncryptionKey(key) ? '✓ Valid' : '✗ Invalid');
}

main();

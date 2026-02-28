# Encryption and Security

## Overview

MedSutra AI implements enterprise-grade encryption to protect patient health information (PHI) in compliance with HIPAA and India DPDP Act requirements.

## Encryption at Rest

### AES-256-GCM

All patient PHI data is encrypted using AES-256-GCM (Galois/Counter Mode) which provides:

- **Confidentiality**: 256-bit AES encryption
- **Integrity**: Built-in authentication tag
- **Performance**: Hardware-accelerated on modern CPUs

### Key Management

- Keys are stored securely in environment variables (never in code)
- Support for key rotation without data loss
- Each encrypted record includes key ID for version tracking
- Old keys retained for decrypting historical data

### Generating Encryption Keys

```bash
# Generate a new encryption key
npm run generate-key

# Output will provide ENCRYPTION_KEY and KEY_ID for .env file
```

### Key Rotation

```typescript
import { keyManagementService } from './utils/key-management';

// Check if rotation is needed (default: 90 days)
if (keyManagementService.shouldRotateKey()) {
  const newKeyId = keyManagementService.rotateKey();
  console.log(`New key ID: ${newKeyId}`);
  // Update environment variables with new key
}
```

## Encryption in Transit

### TLS 1.3

All network communications use TLS 1.3 with strong cipher suites:

- `TLS_AES_256_GCM_SHA384`
- `TLS_CHACHA20_POLY1305_SHA256`
- `TLS_AES_128_GCM_SHA256`

### Certificate Setup

1. Generate or obtain TLS certificates:

```bash
# Self-signed for development (DO NOT use in production)
openssl req -x509 -newkey rsa:4096 -keyout server.key -out server.crt -days 365 -nodes

# Production: Use certificates from a trusted CA
```

2. Configure in `.env`:

```env
TLS_ENABLED=true
TLS_CERT_PATH=./certs/server.crt
TLS_KEY_PATH=./certs/server.key
TLS_CA_PATH=./certs/ca.crt  # Optional
```

## Usage Examples

### Encrypting Patient Data

```typescript
import { encryptPHI, decryptPHI } from './utils/encryption';

// Encrypt patient data before storing
const patientData = {
  name: 'John Doe',
  dateOfBirth: '1980-01-01',
  ssn: '123-45-6789'
};

const encrypted = encryptPHI(patientData);
// Store encrypted buffer in database

// Decrypt when needed
const decrypted = decryptPHI(encrypted);
console.log(decrypted.name); // 'John Doe'
```

### Generic Encryption

```typescript
import { encrypt, decrypt, decryptToString } from './utils/encryption';

// Encrypt string
const encrypted = encrypt('sensitive data');

// Decrypt to buffer
const decryptedBuffer = decrypt(encrypted);

// Decrypt to string
const decryptedString = decryptToString(encrypted);
```

## Security Best Practices

1. **Never commit encryption keys** to version control
2. **Rotate keys regularly** (recommended: every 90 days)
3. **Use TLS 1.3** in production environments
4. **Store keys securely** using a secrets manager (AWS Secrets Manager, Azure Key Vault, etc.)
5. **Monitor key usage** and audit encryption operations
6. **Test disaster recovery** procedures for key loss scenarios

## Compliance

### HIPAA Requirements

✓ Encryption at rest (AES-256)
✓ Encryption in transit (TLS 1.3)
✓ Access controls and audit logging
✓ Key management and rotation

### India DPDP Act Requirements

✓ Data encryption for sensitive personal data
✓ Secure data transmission
✓ Data breach prevention measures
✓ Audit trail for data access

## Troubleshooting

### Common Issues

**Error: "ENCRYPTION_KEY environment variable is not set"**
- Solution: Generate a key using `npm run generate-key` and add to `.env`

**Error: "Encryption key must be 32 bytes"**
- Solution: Ensure the key is exactly 64 hex characters (32 bytes)

**Error: "Failed to decrypt data"**
- Solution: Verify the correct key ID is being used for old data

**TLS Certificate Errors**
- Solution: Ensure certificate paths are correct and certificates are valid

## Performance Considerations

- AES-256-GCM is hardware-accelerated on modern CPUs
- Typical encryption overhead: < 1ms per operation
- Key caching reduces repeated key lookups
- Batch operations recommended for large datasets

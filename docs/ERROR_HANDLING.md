# Error Handling System - MedSutra AI

## Overview

The MedSutra AI system implements comprehensive error handling with graceful degradation, retry logic, user-friendly messages, and structured logging. This document describes the error handling architecture and usage patterns.

## Architecture

### Error Class Hierarchy

All errors extend from `AppError` base class with the following hierarchy:

```
AppError (base)
├── ValidationError - Input validation failures
├── AuthenticationError - Authentication failures
├── AuthorizationError - Permission denied
├── NotFoundError - Resource not found
├── ConflictError - Resource conflicts
├── ProcessingError - AI/LLM processing failures
├── DatabaseError - Database operation failures
├── ExternalServiceError - External service failures
├── ConfigurationError - Configuration issues
├── RateLimitError - Rate limit exceeded
├── TimeoutError - Operation timeout
├── EncryptionError - Encryption/decryption failures
├── ComplianceError - Compliance violations
└── InternalServerError - Unexpected errors
```

### Error Handler Service

The `ErrorHandler` service provides:
- Retry logic with exponential backoff
- Error severity classification
- Error alerting for critical issues
- Structured error logging
- Error statistics tracking

### Global Error Middleware

The global error middleware:
- Catches all unhandled errors
- Formats error responses consistently
- Logs errors with context
- Handles async errors
- Provides user-friendly messages

## Usage Patterns

### 1. Throwing Errors in Services

```typescript
import { ValidationError, ProcessingError } from '../utils/errors';

// Input validation
if (!patientId) {
  throw new ValidationError('Patient ID is required');
}

// Processing errors
try {
  const result = await llmService.generate(prompt);
} catch (error) {
  throw new ProcessingError(
    'Failed to generate clinical summary',
    { originalError: error }
  );
}
```

### 2. Using Retry Logic

```typescript
import { ErrorHandler } from '../services/error/ErrorHandler';

const errorHandler = ErrorHandler.getInstance();

// Retry with exponential backoff
const result = await errorHandler.retryWithBackoff(
  async () => {
    return await externalService.call();
  },
  {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    factor: 2
  }
);
```

### 3. Wrapping Route Handlers

```typescript
import { asyncHandler } from '../middleware/errorHandler';

// Automatically catches async errors
router.post('/api/summarize', asyncHandler(async (req, res) => {
  const result = await clinicalSummarizer.summarize(req.body);
  res.json(result);
}));
```

### 4. Input Validation

```typescript
import { validateRequired, validateEmail } from '../utils/validation';

// Validate required fields
validateRequired({ email, password }, ['email', 'password']);

// Validate email format
validateEmail(email);

// Custom validation
if (!isValidPatientId(patientId)) {
  throw new ValidationError('Invalid patient ID format');
}
```

## Error Response Format

All errors return a consistent JSON structure:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Patient ID is required",
    "statusCode": 400,
    "timestamp": "2024-01-15T10:30:00.000Z",
    "requestId": "req_abc123",
    "details": {
      "field": "patientId"
    }
  }
}
```

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| VALIDATION_ERROR | 400 | Invalid input data |
| AUTHENTICATION_ERROR | 401 | Authentication failed |
| AUTHORIZATION_ERROR | 403 | Permission denied |
| NOT_FOUND | 404 | Resource not found |
| CONFLICT | 409 | Resource conflict |
| PROCESSING_ERROR | 422 | AI/LLM processing failed |
| RATE_LIMIT_ERROR | 429 | Too many requests |
| INTERNAL_SERVER_ERROR | 500 | Unexpected error |
| DATABASE_ERROR | 500 | Database operation failed |
| EXTERNAL_SERVICE_ERROR | 502 | External service unavailable |
| TIMEOUT_ERROR | 504 | Operation timeout |

## Graceful Degradation

### Vision Analyzer Fallback

When the Vision Analyzer fails, the system gracefully falls back to text-only analysis:

```typescript
try {
  // Try multimodal analysis
  result = await visionAnalyzer.analyze(image, report);
} catch (error) {
  logger.warn('Vision analysis failed, falling back to text-only', { error });
  // Fallback to text-only radiology analysis
  result = await radiologyAnalyzer.analyzeText(report);
}
```

### LLM Service Fallback

When the primary LLM service fails, retry with exponential backoff:

```typescript
const result = await errorHandler.retryWithBackoff(
  async () => await llmService.generate(prompt),
  { maxRetries: 3, initialDelay: 1000 }
);
```

### EMR Integration Fallback

When EMR is unavailable, queue requests for later processing:

```typescript
try {
  await emrService.sync(patientData);
} catch (error) {
  if (error instanceof ExternalServiceError) {
    await emrService.queueForRetry(patientData);
    logger.info('EMR unavailable, queued for retry');
  }
}
```

## Retry Strategies

### Exponential Backoff

Default retry strategy for transient failures:

```typescript
{
  maxRetries: 3,
  initialDelay: 1000,  // 1 second
  maxDelay: 10000,     // 10 seconds
  factor: 2            // Double delay each retry
}
```

Retry delays: 1s → 2s → 4s

### Fixed Delay

For rate-limited services:

```typescript
{
  maxRetries: 5,
  initialDelay: 5000,  // 5 seconds
  maxDelay: 5000,      // 5 seconds
  factor: 1            // No increase
}
```

## Error Logging

### Structured Logging

All errors are logged with structured context:

```typescript
logger.error('Failed to process clinical document', {
  error: error.message,
  stack: error.stack,
  patientId: req.body.patientId,
  userId: req.user?.id,
  requestId: req.id,
  timestamp: new Date().toISOString()
});
```

### Log Levels

- **ERROR**: Unexpected errors requiring attention
- **WARN**: Handled errors with fallback (e.g., Vision Analyzer fallback)
- **INFO**: Normal error recovery (e.g., successful retry)

## Error Alerting

Critical errors trigger alerts:

```typescript
// Automatic alerting for critical errors
errorHandler.handleError(error, {
  context: 'clinical-summarization',
  severity: 'critical',
  userId: req.user?.id
});
```

Alert triggers:
- Multiple consecutive failures (>5)
- Database connection failures
- Encryption/decryption failures
- Compliance violations

## Error Management API

### Get Error Alerts (Admin Only)

```http
GET /api/errors/alerts
Authorization: Bearer <token>
```

Response:
```json
{
  "success": true,
  "data": {
    "alerts": [
      {
        "id": "alert_123",
        "message": "Database connection failed",
        "severity": "critical",
        "count": 3,
        "firstOccurrence": "2024-01-15T10:00:00.000Z",
        "lastOccurrence": "2024-01-15T10:05:00.000Z"
      }
    ]
  }
}
```

### Clear Error Alerts (Admin Only)

```http
DELETE /api/errors/alerts
Authorization: Bearer <token>
```

## Best Practices

### 1. Always Use Specific Error Types

```typescript
// ❌ Bad
throw new Error('Invalid input');

// ✅ Good
throw new ValidationError('Patient ID is required', {
  field: 'patientId'
});
```

### 2. Provide Context in Errors

```typescript
// ❌ Bad
throw new ProcessingError('Failed');

// ✅ Good
throw new ProcessingError('Failed to generate clinical summary', {
  patientId,
  documentType,
  originalError: error.message
});
```

### 3. Use Async Handler for Routes

```typescript
// ❌ Bad
router.post('/api/summarize', async (req, res) => {
  try {
    const result = await service.summarize(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ✅ Good
router.post('/api/summarize', asyncHandler(async (req, res) => {
  const result = await service.summarize(req.body);
  res.json(result);
}));
```

### 4. Validate Input Early

```typescript
// ✅ Good
router.post('/api/summarize', asyncHandler(async (req, res) => {
  // Validate first
  validateRequired(req.body, ['patientId', 'documents']);
  
  // Then process
  const result = await service.summarize(req.body);
  res.json(result);
}));
```

### 5. Log Errors with Context

```typescript
// ✅ Good
try {
  await service.process(data);
} catch (error) {
  logger.error('Processing failed', {
    error: error.message,
    data: sanitize(data),  // Remove PII
    userId: req.user?.id
  });
  throw error;
}
```

## Testing Error Handling

### Unit Tests

```typescript
describe('ClinicalSummarizer', () => {
  it('should throw ValidationError for missing patientId', async () => {
    await expect(
      summarizer.summarize({ documents: [] })
    ).rejects.toThrow(ValidationError);
  });

  it('should retry on transient LLM failures', async () => {
    // Mock LLM to fail twice then succeed
    llmMock.mockRejectedValueOnce(new Error('Timeout'))
             .mockRejectedValueOnce(new Error('Timeout'))
             .mockResolvedValueOnce({ summary: 'Success' });

    const result = await summarizer.summarize(validInput);
    expect(result).toBeDefined();
    expect(llmMock).toHaveBeenCalledTimes(3);
  });
});
```

### Integration Tests

```typescript
describe('POST /api/summarize', () => {
  it('should return 400 for invalid input', async () => {
    const response = await request(app)
      .post('/api/summarize')
      .send({ invalid: 'data' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 500 and fallback on Vision Analyzer failure', async () => {
    visionMock.mockRejectedValue(new Error('Service unavailable'));

    const response = await request(app)
      .post('/api/vision/analyze')
      .send(validInput);

    // Should still succeed with text-only fallback
    expect(response.status).toBe(200);
    expect(response.body.data.fallbackUsed).toBe(true);
  });
});
```

## Monitoring and Metrics

### Error Metrics

Track error rates and patterns:

```typescript
// Error statistics
const stats = errorHandler.getErrorStats();
// {
//   totalErrors: 150,
//   errorsByType: {
//     'PROCESSING_ERROR': 80,
//     'TIMEOUT_ERROR': 40,
//     'VALIDATION_ERROR': 30
//   },
//   errorsByContext: {
//     'clinical-summarization': 60,
//     'radiology-analysis': 50,
//     'llm-service': 40
//   }
// }
```

### Health Checks

Monitor error rates in health endpoint:

```http
GET /health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "errors": {
    "last24h": 45,
    "criticalAlerts": 0
  }
}
```

## Compliance Considerations

### HIPAA Compliance

- Never log PHI in error messages
- Sanitize patient data before logging
- Encrypt error logs containing sensitive context

### Audit Logging

All errors are automatically logged to the audit system:

```typescript
await auditService.logError({
  userId: req.user?.id,
  action: 'clinical_summarization_failed',
  error: error.message,
  timestamp: new Date()
});
```

## Related Documentation

- [Authentication & Authorization](./AUTH_AND_AUDIT.md)
- [Encryption](./ENCRYPTION.md)
- [LLM Service](./LLM_SERVICE.md)
- [Deployment Guide](./DEPLOYMENT_GUIDE.md)

---

**Last Updated**: January 2024  
**Version**: 1.0.0

# Workflow Engine & API Gateway Documentation

This document covers the Workflow Engine (Task 15) and API Gateway (Task 16) implementations.

---

## Task 15: Workflow Engine Module

### Purpose
Generate intelligent workflow suggestions and multilingual patient summaries to guide clinical decision-making.

### Key Features

#### 1. Workflow Suggestions
- **Oncology Referrals**: Automatic suggestions for high-risk cancer findings
- **Biopsy Recommendations**: Suggestions for suspicious lesions
- **Follow-up Imaging**: Reminders for medium-risk findings
- **Lab Test Suggestions**: Recommendations based on abnormal findings
- **Specialist Consultations**: Evaluation of referral needs

#### 2. Multilingual Patient Summaries
- **Supported Languages**: English, Hindi, Tamil, Telugu, Kannada, Malayalam
- **Medical Jargon Translation**: Converts complex medical terms to patient-friendly language
- **Cultural Sensitivity**: Appropriate terminology for Indian patient populations

#### 3. Clinician Action Tracking
- **Accept**: Clinician accepts AI suggestion as-is
- **Modify**: Clinician modifies the suggestion
- **Reject**: Clinician rejects the suggestion
- **Pending**: Awaiting clinician response

### API Endpoints

#### POST /api/workflow/suggestions
Generate workflow suggestions for a patient.

**Request:**
```json
{
  "patientId": "patient_123",
  "snapshot": {
    "patientId": "patient_123",
    "keyComplaints": ["chest pain"],
    "pastMedicalHistory": ["hypertension"],
    "currentMedications": [{"name": "Metformin", "dosage": "500mg"}],
    "abnormalFindings": ["elevated troponin"],
    "pendingActions": ["cardiology consult"],
    "summary": "Patient with chest pain..."
  },
  "radiologyAnalysis": {
    "cancerRiskFlag": "High",
    "suspiciousTerms": [{"term": "spiculated mass", "category": "MASS"}],
    "reasoning": "Highly suspicious for malignancy..."
  }
}
```

**Response:**
```json
{
  "success": true,
  "suggestions": [
    {
      "id": "sug_123",
      "patientId": "patient_123",
      "type": "ONCOLOGY_REFERRAL",
      "priority": "URGENT",
      "reasoning": "High-risk findings require urgent oncology evaluation...",
      "evidence": [
        "Cancer Risk Flag: High",
        "Suspicious Terms: spiculated mass"
      ],
      "guidelineReference": "NCCN Guidelines for Cancer Screening",
      "clinicianAction": "PENDING",
      "createdAt": "2024-01-15T10:00:00Z"
    }
  ],
  "count": 1
}
```

#### POST /api/workflow/suggestions/:id/respond
Respond to a workflow suggestion.

**Request:**
```json
{
  "action": "ACCEPT",
  "respondedBy": "dr_smith",
  "modificationNotes": "Scheduled for next week"
}
```

**Response:**
```json
{
  "success": true,
  "suggestion": {
    "id": "sug_123",
    "clinicianAction": "ACCEPT",
    "respondedAt": "2024-01-15T10:30:00Z",
    "respondedBy": "dr_smith",
    "modificationNotes": "Scheduled for next week"
  }
}
```

#### POST /api/workflow/patient-summary
Generate patient-friendly summary in specified language.

**Request:**
```json
{
  "patientId": "patient_123",
  "snapshot": { /* PatientSnapshot object */ },
  "language": "HINDI"
}
```

**Response:**
```json
{
  "success": true,
  "summary": {
    "patientId": "patient_123",
    "language": "HINDI",
    "summary": "आपको सीने में दर्द की शिकायत है...",
    "keyPoints": [
      "सीने में दर्द",
      "उच्च रक्तचाप का इतिहास"
    ],
    "nextSteps": [
      "हृदय रोग विशेषज्ञ से परामर्श",
      "ईसीजी परीक्षण"
    ],
    "generatedAt": "2024-01-15T10:00:00Z"
  }
}
```

#### POST /api/workflow/translate-jargon
Translate medical jargon to patient-friendly language.

**Request:**
```json
{
  "medicalText": "Patient presents with acute myocardial infarction",
  "language": "ENGLISH"
}
```

**Response:**
```json
{
  "success": true,
  "original": "Patient presents with acute myocardial infarction",
  "translation": "Patient is having a heart attack",
  "language": "ENGLISH"
}
```

#### POST /api/workflow/evaluate-referral
Evaluate if specialist referral is needed.

**Request:**
```json
{
  "findings": [
    "Spiculated mass in right upper lobe",
    "Enlarged mediastinal lymph nodes"
  ],
  "specialty": "Oncology"
}
```

**Response:**
```json
{
  "success": true,
  "referralNeeded": true,
  "referral": {
    "specialty": "Oncology",
    "urgency": "URGENT",
    "reason": "Suspicious findings highly suggestive of malignancy",
    "supportingFindings": [
      "Spiculated mass in right upper lobe",
      "Enlarged mediastinal lymph nodes"
    ]
  }
}
```

#### GET /api/workflow/languages
Get supported languages.

**Response:**
```json
{
  "success": true,
  "languages": [
    {"code": "ENGLISH", "name": "English", "native": "English"},
    {"code": "HINDI", "name": "Hindi", "native": "हिन्दी"},
    {"code": "TAMIL", "name": "Tamil", "native": "தமிழ்"},
    {"code": "TELUGU", "name": "Telugu", "native": "తెలుగు"},
    {"code": "KANNADA", "name": "Kannada", "native": "ಕನ್ನಡ"},
    {"code": "MALAYALAM", "name": "Malayalam", "native": "മലയാളം"}
  ]
}
```

#### GET /api/workflow/statistics
Get workflow engine statistics.

**Response:**
```json
{
  "success": true,
  "statistics": {
    "totalSuggestions": 150,
    "byType": {
      "ONCOLOGY_REFERRAL": 45,
      "BIOPSY": 30,
      "FOLLOW_UP_IMAGING": 50,
      "LAB_TEST": 20,
      "SPECIALIST_CONSULT": 5
    },
    "byPriority": {
      "LOW": 20,
      "MEDIUM": 60,
      "HIGH": 50,
      "URGENT": 20
    },
    "byAction": {
      "ACCEPT": 80,
      "MODIFY": 30,
      "REJECT": 10,
      "PENDING": 30
    },
    "acceptanceRate": 73.33
  }
}
```

### Workflow Suggestion Types

| Type | Description | Priority | Trigger |
|------|-------------|----------|---------|
| ONCOLOGY_REFERRAL | Urgent oncology consultation | URGENT | High cancer risk |
| BIOPSY | Tissue biopsy recommendation | HIGH/URGENT | Suspicious lesions |
| FOLLOW_UP_IMAGING | Follow-up imaging reminder | MEDIUM | Medium risk findings |
| LAB_TEST | Additional lab tests | MEDIUM | Abnormal findings |
| SPECIALIST_CONSULT | Specialist consultation | VARIES | Complex findings |

### Supported Languages

| Language | Code | Native Name | Status |
|----------|------|-------------|--------|
| English | ENGLISH | English | ✅ Supported |
| Hindi | HINDI | हिन्दी | ✅ Supported |
| Tamil | TAMIL | தமிழ் | ✅ Supported |
| Telugu | TELUGU | తెలుగు | ✅ Supported |
| Kannada | KANNADA | ಕನ್ನಡ | ✅ Supported |
| Malayalam | MALAYALAM | മലയാളം | ✅ Supported |

---

## Task 16: API Gateway Implementation

### Purpose
Central API gateway with routing, authentication, authorization, rate limiting, and load balancing.

### Key Features

#### 1. Request Management
- **Request ID Assignment**: Unique ID for each request
- **Request Logging**: Comprehensive logging of all requests
- **Response Time Tracking**: Monitor request duration

#### 2. Load Balancing & Queueing
- **Concurrent Request Limit**: Configurable max concurrent users (default: 100)
- **Automatic Queueing**: Requests queued when >80% capacity
- **Wait Time Estimation**: Provides estimated wait time for queued requests
- **Queue Processing**: Automatic processing when capacity available

#### 3. Rate Limiting
- **Per-User Limits**: Rate limits per user or IP address
- **Configurable Window**: Default 60 seconds
- **Configurable Max Requests**: Default 100 requests per window
- **Rate Limit Headers**: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset

#### 4. Authentication & Authorization (Placeholder)
- **JWT Authentication**: Token-based authentication (to be implemented in Task 4)
- **Role-Based Access Control**: User roles (clinician, radiologist, admin, quality_officer)
- **Audit Logging**: All requests logged for compliance (to be implemented in Task 5)

#### 5. CORS Support
- **Cross-Origin Requests**: Configurable CORS policy
- **Preflight Handling**: Automatic OPTIONS request handling

#### 6. Error Handling
- **Structured Errors**: Consistent error response format
- **Request ID in Errors**: Traceable error responses
- **404 Handling**: Custom not found handler

### API Gateway Endpoints

#### GET /api/gateway/health
Health check endpoint.

**Response:**
```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2024-01-15T10:00:00Z",
  "uptime": 3600,
  "environment": "production"
}
```

#### GET /api/gateway/status
Get gateway status and load information.

**Response:**
```json
{
  "success": true,
  "gateway": {
    "load": {
      "activeRequests": 45,
      "maxConcurrentRequests": 100,
      "queuedRequests": 0,
      "capacityUsed": 45,
      "isOverCapacity": false
    },
    "rateLimit": {
      "totalTracked": 150,
      "windowMs": 60000,
      "maxRequests": 100
    },
    "uptime": 3600,
    "memory": {
      "rss": 52428800,
      "heapTotal": 20971520,
      "heapUsed": 15728640,
      "external": 1048576
    },
    "timestamp": "2024-01-15T10:00:00Z"
  }
}
```

#### GET /api/gateway/metrics
Get detailed gateway metrics.

**Response:**
```json
{
  "success": true,
  "metrics": {
    "requests": {
      "active": 45,
      "queued": 0,
      "maxConcurrent": 100
    },
    "capacity": {
      "used": 45,
      "available": 55,
      "isOverCapacity": false
    },
    "system": {
      "uptime": 3600,
      "memory": {
        "used": 15,
        "total": 20,
        "unit": "MB"
      },
      "cpu": {
        "user": 1000000,
        "system": 500000
      }
    },
    "timestamp": "2024-01-15T10:00:00Z"
  }
}
```

#### GET /api/gateway/routes
List all available API routes.

**Response:**
```json
{
  "success": true,
  "routes": {
    "clinical": {
      "base": "/api/clinical",
      "endpoints": [
        "POST /summarize - Generate patient snapshot",
        "POST /extract-entities - Extract medical entities"
      ]
    },
    "radiology": {
      "base": "/api/radiology",
      "endpoints": [
        "POST /analyze - Analyze radiology report"
      ]
    }
    // ... other routes
  }
}
```

### Middleware Stack

The API Gateway applies middleware in the following order:

1. **Request ID Middleware**: Assigns unique ID to each request
2. **Request Logger**: Logs incoming requests
3. **Response Time Middleware**: Tracks request duration
4. **CORS Middleware**: Handles cross-origin requests
5. **Load Balancing Middleware**: Manages concurrent requests and queueing
6. **Rate Limiter**: Enforces rate limits
7. **Authentication**: Verifies user identity (optional in development)
8. **Audit Log**: Logs requests for compliance (optional in development)
9. **Route Handlers**: Process the actual request
10. **Error Handler**: Catches and formats errors
11. **Not Found Handler**: Handles 404 errors

### Configuration

Set in `.env`:

```bash
# Performance Configuration
MAX_CONCURRENT_USERS=100
REQUEST_TIMEOUT_MS=30000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# Authentication (set to false to disable in development)
AUTH_ENABLED=false

# CORS Configuration
CORS_ORIGIN=*
```

### Load Balancing Behavior

#### Normal Load (<80% capacity)
- Requests processed immediately
- No queueing

#### High Load (80-100% capacity)
- Warning logged
- Requests still processed immediately
- System monitors for overload

#### Over Capacity (>100%)
- Requests automatically queued
- 503 response with queue information:
  ```json
  {
    "error": "Service temporarily unavailable",
    "message": "Server is at capacity. Your request has been queued.",
    "estimatedWaitTime": 4000,
    "queuePosition": 5
  }
  ```
- Requests processed as capacity becomes available

### Rate Limiting Behavior

#### Within Limits
- Request processed normally
- Headers included:
  - `X-RateLimit-Limit: 100`
  - `X-RateLimit-Remaining: 75`
  - `X-RateLimit-Reset: 2024-01-15T10:01:00Z`

#### Rate Limit Exceeded
- 429 response:
  ```json
  {
    "error": "Too many requests",
    "message": "Rate limit exceeded. Please try again in 45 seconds.",
    "retryAfter": 45
  }
  ```
- Headers included:
  - `Retry-After: 45`

### Error Response Format

All errors follow a consistent format:

```json
{
  "error": "Error type",
  "message": "Human-readable error message",
  "requestId": "req_1234567890_abc123"
}
```

### Security Features

1. **Request ID Tracking**: Every request has unique ID for tracing
2. **Rate Limiting**: Prevents abuse and DoS attacks
3. **Load Balancing**: Prevents server overload
4. **CORS Protection**: Configurable cross-origin policy
5. **Authentication**: JWT-based (to be implemented in Task 4)
6. **Audit Logging**: Comprehensive request logging (to be implemented in Task 5)

### Performance Optimization

1. **Connection Pooling**: Database connections reused
2. **Request Queueing**: Graceful handling of high load
3. **Response Time Monitoring**: Track slow requests
4. **Memory Monitoring**: Track memory usage
5. **CPU Monitoring**: Track CPU usage

---

## Integration Example

```typescript
import axios from 'axios';

// Generate workflow suggestions
const suggestions = await axios.post('/api/workflow/suggestions', {
  patientId: 'patient_123',
  snapshot: patientSnapshot,
  radiologyAnalysis: radiologyAnalysis
});

// Respond to suggestion
await axios.post(`/api/workflow/suggestions/${suggestions.data.suggestions[0].id}/respond`, {
  action: 'ACCEPT',
  respondedBy: 'dr_smith'
});

// Generate patient summary in Hindi
const summary = await axios.post('/api/workflow/patient-summary', {
  patientId: 'patient_123',
  snapshot: patientSnapshot,
  language: 'HINDI'
});

// Check gateway status
const status = await axios.get('/api/gateway/status');
console.log(`Capacity used: ${status.data.gateway.load.capacityUsed}%`);
```

---

## Monitoring & Observability

### Key Metrics to Monitor

1. **Request Metrics**:
   - Active requests
   - Queued requests
   - Request duration
   - Error rate

2. **Capacity Metrics**:
   - Capacity utilization
   - Queue length
   - Wait times

3. **Rate Limit Metrics**:
   - Rate limit hits
   - Blocked requests
   - Top users by request count

4. **System Metrics**:
   - Memory usage
   - CPU usage
   - Uptime

### Logging

All requests are logged with:
- Request ID
- User ID (if authenticated)
- Method and path
- IP address
- User agent
- Response status
- Duration

---

## Future Enhancements

1. **Workflow Engine**:
   - Machine learning for suggestion prioritization
   - Historical outcome tracking
   - Personalized suggestions based on clinician preferences
   - Integration with clinical guidelines database

2. **API Gateway**:
   - Distributed rate limiting (Redis)
   - Advanced load balancing algorithms
   - Circuit breaker pattern
   - Request caching
   - API versioning
   - GraphQL support
   - WebSocket support for real-time updates

3. **Authentication** (Task 4):
   - JWT implementation
   - OAuth2 support
   - Multi-factor authentication
   - Session management

4. **Audit Logging** (Task 5):
   - Comprehensive audit trail
   - 7-year retention
   - Compliance reporting
   - Anomaly detection

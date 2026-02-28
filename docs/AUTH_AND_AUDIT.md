# Authentication, Authorization, and Audit System

This document describes the authentication, authorization, and audit logging system implemented in MedSutra AI.

## Table of Contents

1. [Authentication System](#authentication-system)
2. [Authorization System (RBAC)](#authorization-system-rbac)
3. [Audit Logging System](#audit-logging-system)
4. [API Endpoints](#api-endpoints)
5. [Security Best Practices](#security-best-practices)

---

## Authentication System

### Overview

MedSutra AI uses JWT (JSON Web Token) based authentication with refresh tokens for secure session management.

### Features

- **JWT Access Tokens**: Short-lived tokens (default 15 minutes) for API authentication
- **Refresh Tokens**: Long-lived tokens (default 7 days) for obtaining new access tokens
- **Account Lockout**: Automatic lockout after 5 failed login attempts (30 minutes)
- **Session Management**: Track active sessions with IP address and user agent
- **Password Security**: Bcrypt hashing with salt rounds

### User Roles

The system supports four user roles:

1. **clinician**: Medical doctors who use the AI assistant
2. **radiologist**: Specialists who review radiology reports
3. **admin**: System administrators with full access
4. **quality_officer**: Quality assurance personnel who review AI performance

### Database Schema

#### Users Table

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  failed_login_attempts INT DEFAULT 0,
  locked_until TIMESTAMP NULL,
  last_login TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB NULL
);
```

#### Sessions Table

```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  refresh_token VARCHAR(500) NOT NULL,
  ip_address VARCHAR(100) NULL,
  user_agent TEXT NULL,
  expires_at TIMESTAMP NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Authentication Flow

1. **Registration** (Admin only)
   - POST /api/auth/register
   - Creates new user with hashed password

2. **Login**
   - POST /api/auth/login
   - Validates credentials
   - Returns access token and refresh token
   - Creates session record

3. **API Requests**
   - Include access token in Authorization header: `Bearer <token>`
   - Middleware verifies token and attaches user info to request

4. **Token Refresh**
   - POST /api/auth/refresh
   - Validates refresh token
   - Returns new access token and refresh token
   - Invalidates old session

5. **Logout**
   - POST /api/auth/logout
   - Invalidates session

### Environment Variables

```env
JWT_SECRET=your_jwt_secret_here_change_in_production
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
AUTH_ENABLED=true
SKIP_AUTH=false  # Set to true in development to bypass auth
```

---

## Authorization System (RBAC)

### Overview

Role-Based Access Control (RBAC) restricts access to resources based on user roles.

### Middleware Usage

```typescript
import { authenticate, authorize } from './middleware/auth';

// Require authentication
router.get('/protected', authenticate(), (req, res) => {
  // User is authenticated
});

// Require specific roles
router.get('/admin-only', 
  authenticate(), 
  authorize(['admin']), 
  (req, res) => {
    // Only admins can access
  }
);

// Multiple roles allowed
router.get('/quality-review', 
  authenticate(), 
  authorize(['admin', 'quality_officer']), 
  (req, res) => {
    // Admins and quality officers can access
  }
);
```

### Role Permissions

| Endpoint | Clinician | Radiologist | Admin | Quality Officer |
|----------|-----------|-------------|-------|-----------------|
| Clinical Summarization | ✓ | ✓ | ✓ | ✓ |
| Radiology Analysis | ✓ | ✓ | ✓ | ✓ |
| Documentation | ✓ | ✓ | ✓ | ✓ |
| Workflow Suggestions | ✓ | ✓ | ✓ | ✓ |
| Audit Logs | ✗ | ✗ | ✓ | ✓ |
| Quality Reports | ✗ | ✗ | ✓ | ✓ |
| User Management | ✗ | ✗ | ✓ | ✗ |
| Patient Deletion | ✗ | ✗ | ✓ | ✗ |
| Data Anonymization | ✗ | ✗ | ✓ | ✗ |

---

## Audit Logging System

### Overview

Comprehensive audit logging tracks all system operations for compliance and quality monitoring.

### Features

- **Automatic Logging**: All API requests are logged automatically
- **Event Types**: AI_SUGGESTION, CLINICIAN_DECISION, DOCUMENT_APPROVAL, DATA_ACCESS
- **Batch Processing**: Logs are queued and written in batches for performance
- **7-Year Retention**: Audit logs are retained for 7 years (HIPAA compliance)
- **Patient Access Tracking**: All patient data access is logged with user, timestamp, and IP

### Audit Event Types

1. **AI_SUGGESTION**: When AI generates a suggestion
2. **CLINICIAN_DECISION**: When clinician accepts/modifies/rejects AI suggestion
3. **DOCUMENT_APPROVAL**: When clinician approves a document
4. **DATA_ACCESS**: When patient data is accessed

### Database Schema

#### Audit Records Table

```sql
CREATE TABLE audit_records (
  id UUID PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL,
  user_id UUID NOT NULL,
  patient_id UUID NULL,
  ai_suggestion TEXT NULL,
  clinician_response VARCHAR(20) NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB NULL,
  CHECK (timestamp > NOW() - INTERVAL '7 years')
);
```

#### Access Logs Table

```sql
CREATE TABLE access_logs (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id UUID NULL,
  ip_address VARCHAR(100) NULL,
  user_agent TEXT NULL,
  success BOOLEAN NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB NULL
);
```

### Usage Examples

#### Log AI Suggestion

```typescript
import { AuditService } from './services/audit';

const auditService = new AuditService();

await auditService.logAISuggestion(
  userId,
  patientId,
  'Recommend oncology referral for suspicious lung nodule',
  { confidence: 0.85, source: 'RadiologyAnalyzer' }
);
```

#### Log Clinician Decision

```typescript
await auditService.logClinicianDecision(
  userId,
  patientId,
  'ACCEPTED',  // or 'MODIFIED' or 'REJECTED'
  'Recommend oncology referral for suspicious lung nodule',
  { notes: 'Agreed with AI assessment' }
);
```

#### Log Patient Access

```typescript
await auditService.logPatientAccess(
  userId,
  patientId,
  'VIEW_SUMMARY',
  req.ip,
  req.get('user-agent'),
  true,  // success
  { action: 'viewed patient summary' }
);
```

### Querying Audit Logs

```typescript
// Query audit logs
const result = await auditService.queryAuditLogs({
  userId: 'user-123',
  eventType: 'CLINICIAN_DECISION',
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-12-31'),
  limit: 50,
  offset: 0
});

// Get statistics
const stats = await auditService.getAuditStatistics(
  new Date('2024-01-01'),
  new Date('2024-12-31')
);
```

---

## API Endpoints

### Authentication Endpoints

#### POST /api/auth/register
Register a new user (admin only in production)

**Request:**
```json
{
  "email": "doctor@hospital.com",
  "password": "SecurePassword123!",
  "name": "Dr. John Smith",
  "role": "clinician"
}
```

**Response:**
```json
{
  "message": "User registered successfully",
  "user": {
    "id": "uuid",
    "email": "doctor@hospital.com",
    "name": "Dr. John Smith",
    "role": "clinician"
  }
}
```

#### POST /api/auth/login
User authentication

**Request:**
```json
{
  "email": "doctor@hospital.com",
  "password": "SecurePassword123!"
}
```

**Response:**
```json
{
  "message": "Login successful",
  "user": {
    "id": "uuid",
    "email": "doctor@hospital.com",
    "name": "Dr. John Smith",
    "role": "clinician"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "uuid-refresh-token",
  "expiresIn": 900000
}
```

#### POST /api/auth/logout
User logout

**Request:**
```json
{
  "refreshToken": "uuid-refresh-token"
}
```

**Response:**
```json
{
  "message": "Logout successful"
}
```

#### POST /api/auth/refresh
Refresh access token

**Request:**
```json
{
  "refreshToken": "uuid-refresh-token"
}
```

**Response:**
```json
{
  "message": "Token refreshed successfully",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "new-uuid-refresh-token",
  "expiresIn": 900000
}
```

#### GET /api/auth/me
Get current user info

**Headers:**
```
Authorization: Bearer <access-token>
```

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "doctor@hospital.com",
    "name": "Dr. John Smith",
    "role": "clinician",
    "isActive": true,
    "lastLogin": "2024-01-15T10:30:00Z"
  }
}
```

#### POST /api/auth/change-password
Change user password

**Headers:**
```
Authorization: Bearer <access-token>
```

**Request:**
```json
{
  "oldPassword": "OldPassword123!",
  "newPassword": "NewPassword456!"
}
```

**Response:**
```json
{
  "message": "Password changed successfully"
}
```

### Audit Endpoints

#### GET /api/audit/logs
Query audit logs (admin and quality_officer only)

**Headers:**
```
Authorization: Bearer <access-token>
```

**Query Parameters:**
- `userId` (optional): Filter by user ID
- `patientId` (optional): Filter by patient ID
- `eventType` (optional): Filter by event type
- `startDate` (optional): Start date (ISO 8601)
- `endDate` (optional): End date (ISO 8601)
- `limit` (optional): Number of results (default 50)
- `offset` (optional): Pagination offset (default 0)

**Response:**
```json
{
  "logs": [
    {
      "id": "uuid",
      "eventType": "CLINICIAN_DECISION",
      "userId": "uuid",
      "patientId": "uuid",
      "aiSuggestion": "Recommend oncology referral",
      "clinicianResponse": "ACCEPTED",
      "timestamp": "2024-01-15T10:30:00Z",
      "metadata": {}
    }
  ],
  "total": 150,
  "limit": 50,
  "offset": 0
}
```

#### GET /api/audit/statistics
Get audit statistics (admin and quality_officer only)

**Headers:**
```
Authorization: Bearer <access-token>
```

**Query Parameters:**
- `startDate` (optional): Start date (ISO 8601)
- `endDate` (optional): End date (ISO 8601)

**Response:**
```json
{
  "totalEvents": 1500,
  "eventsByType": {
    "AI_SUGGESTION": 600,
    "CLINICIAN_DECISION": 600,
    "DOCUMENT_APPROVAL": 200,
    "DATA_ACCESS": 100
  },
  "clinicianResponses": {
    "ACCEPTED": 450,
    "MODIFIED": 100,
    "REJECTED": 50
  }
}
```

### Quality Monitoring Endpoints

#### GET /api/quality/reports
Get quality reports (quality_officer and admin only)

**Headers:**
```
Authorization: Bearer <access-token>
```

**Query Parameters:**
- `year` (optional): Year for monthly report
- `month` (optional): Month for monthly report (1-12)
- `startDate` (optional): Start date for custom range
- `endDate` (optional): End date for custom range

**Response:**
```json
{
  "period": {
    "startDate": "2024-01-01T00:00:00Z",
    "endDate": "2024-01-31T23:59:59Z"
  },
  "aiSuggestions": {
    "total": 600,
    "accepted": 450,
    "modified": 100,
    "rejected": 50,
    "acceptanceRate": 75.0,
    "modificationRate": 16.67,
    "rejectionRate": 8.33
  },
  "timeSavings": {
    "byDocumentType": {
      "opd_note": { "count": 100, "avgTimeSaved": 10 },
      "discharge_summary": { "count": 50, "avgTimeSaved": 20 }
    },
    "totalTimeSaved": 2000
  },
  "flaggedCases": {
    "total": 50,
    "cases": []
  },
  "userActivity": {
    "totalUsers": 25,
    "activeUsers": 20,
    "byRole": {}
  }
}
```

### Patient Data Endpoints

#### POST /api/data/anonymize
Anonymize patient data for research (admin only)

**Headers:**
```
Authorization: Bearer <access-token>
```

**Request:**
```json
{
  "patientId": "uuid"
}
```

**Response:**
```json
{
  "message": "Patient data anonymized successfully",
  "anonymizedData": {
    "id": "uuid",
    "age": 45,
    "gender": "M",
    "name": "[REDACTED]",
    "email": "[REDACTED]",
    "phone": "[REDACTED]",
    "address": "[REDACTED]",
    "medicalHistory": "...",
    "diagnoses": "...",
    "medications": "..."
  }
}
```

#### DELETE /api/patients/:id
Delete patient data (DPDP compliance) (admin only)

**Headers:**
```
Authorization: Bearer <access-token>
```

**Request:**
```json
{
  "reason": "Patient requested data deletion under DPDP Act"
}
```

**Response:**
```json
{
  "message": "Patient data deleted successfully",
  "patientId": "uuid",
  "deletedAt": "2024-01-15T10:30:00Z"
}
```

#### GET /api/patients/:id/summary
Get patient summary (authenticated users)

**Headers:**
```
Authorization: Bearer <access-token>
```

**Response:**
```json
{
  "patient": {
    "id": "uuid",
    "metadata": {}
  },
  "snapshot": {
    "id": "uuid",
    "patientId": "uuid",
    "summary": "...",
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

---

## Security Best Practices

### 1. JWT Secret Management

- Use a strong, random JWT secret (minimum 32 characters)
- Store in environment variables, never in code
- Rotate secrets periodically
- Use different secrets for different environments

### 2. Password Security

- Minimum password length: 8 characters
- Require mix of uppercase, lowercase, numbers, and special characters
- Use bcrypt with salt rounds (default: 10)
- Never log or display passwords

### 3. Session Management

- Short-lived access tokens (15 minutes)
- Longer refresh tokens (7 days)
- Invalidate sessions on logout
- Track active sessions per user
- Implement session timeout

### 4. Account Lockout

- Lock account after 5 failed attempts
- Lockout duration: 30 minutes
- Log all failed login attempts
- Notify admins of suspicious activity

### 5. Audit Logging

- Log all authentication events
- Log all patient data access
- Log all AI suggestions and clinician responses
- Retain logs for 7 years (HIPAA compliance)
- Protect logs from tampering

### 6. HTTPS/TLS

- Always use HTTPS in production
- Use TLS 1.3 for data in transit
- Validate SSL certificates
- Implement certificate pinning

### 7. Rate Limiting

- Limit login attempts per IP
- Limit API requests per user
- Implement exponential backoff
- Monitor for abuse patterns

### 8. Input Validation

- Validate all user inputs
- Sanitize data before storage
- Use parameterized queries
- Prevent SQL injection

### 9. CORS Configuration

- Restrict CORS origins in production
- Use specific domains, not wildcards
- Validate Origin header
- Implement CSRF protection

### 10. Monitoring and Alerts

- Monitor failed login attempts
- Alert on suspicious patterns
- Track API usage anomalies
- Review audit logs regularly

---

## Compliance

### HIPAA Compliance

- ✓ Audit logging (7-year retention)
- ✓ Access controls (RBAC)
- ✓ Data encryption (AES-256 at rest, TLS 1.3 in transit)
- ✓ Patient data access tracking
- ✓ Secure authentication

### DPDP Act Compliance (India)

- ✓ Patient data deletion on request
- ✓ Data anonymization for research
- ✓ Consent tracking (via metadata)
- ✓ Access logs for data processing
- ✓ Secure data storage

---

## Development Mode

For development, you can disable authentication:

```env
AUTH_ENABLED=false
SKIP_AUTH=true
```

This allows requests without tokens. **Never use in production!**

---

## Troubleshooting

### Common Issues

1. **"Invalid or expired token"**
   - Token may have expired (15 minutes)
   - Use refresh token to get new access token
   - Check JWT_SECRET matches between environments

2. **"Account locked"**
   - Too many failed login attempts
   - Wait 30 minutes or contact admin
   - Check failed_login_attempts in database

3. **"Insufficient permissions"**
   - User role doesn't have access
   - Check role-based permissions
   - Contact admin to update role

4. **"User not found"**
   - User may have been deactivated
   - Check is_active flag in database
   - Contact admin to reactivate

---

## Migration Guide

### Running Migrations

```bash
# Run all migrations
npm run migrate

# Revert last migration
npm run migrate:revert
```

### Initial Setup

1. Run migrations to create tables
2. Create admin user via registration endpoint
3. Admin can create other users
4. Configure JWT secret and encryption keys
5. Enable authentication in production

---

## Testing

### Manual Testing

```bash
# Register user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!","name":"Test User","role":"clinician"}'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!"}'

# Access protected endpoint
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer <access-token>"
```

### Automated Testing

Unit tests and integration tests should be added for:
- Authentication flow
- Authorization checks
- Audit logging
- Session management
- Password security
- Account lockout

---

## Support

For issues or questions, contact the MedSutra AI development team.

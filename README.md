# MedSutra AI - Clinical AI Assistant

MedSutra AI is a clinical AI assistant system designed for Indian hospitals to enhance clinical workflows through intelligent automation while maintaining clinician control over all clinical decisions.

## Features

- **Clinical Document Summarization**: Generate one-page patient snapshots from multiple clinical documents
- **Radiology Cancer Detection**: Text-based and multimodal analysis of radiology reports
- **Automated Documentation**: Draft clinical documents with clinician review workflow
- **Workflow Intelligence**: Suggest next clinical steps based on patient data
- **Multilingual Support**: English, Hindi, and regional languages
- **Responsible AI**: Hallucination prevention, explainability, assistive-only operation
- **Authentication & Authorization**: JWT-based auth with role-based access control (RBAC)
- **Comprehensive Audit Logging**: Track all AI suggestions, clinician decisions, and data access
- **Quality Monitoring**: Monthly reports on AI performance and time savings
- **HIPAA & DPDP Compliance**: 7-year audit retention, data encryption, patient data deletion

## Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Docker (optional)

## Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Edit .env with your configuration
```

## Development

```bash
# Run in development mode
npm run dev

# Build for production
npm run build

# Run production build
npm start
```

## Docker Deployment

```bash
# Build and start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Deployment Modes

- **On-Prem**: All components run within hospital infrastructure
- **Hybrid Cloud**: Edge inference + cloud processing
- **Offline**: Core functionality without internet

## Security & Compliance

- HIPAA compliant
- India DPDP Act compliant
- AES-256 encryption at rest
- TLS 1.3 encryption in transit
- Role-based access control

## License

Proprietary - All rights reserved


## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user (admin only)
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/me` - Get current user info
- `POST /api/auth/change-password` - Change password

### Clinical Services
- `POST /api/clinical/summarize` - Generate patient snapshot
- `POST /api/radiology/analyze` - Analyze radiology report
- `POST /api/vision/analyze` - Analyze medical image (optional)
- `POST /api/documents/draft` - Generate document draft
- `PUT /api/documents/:id/edit` - Edit document draft
- `POST /api/documents/:id/approve` - Approve document
- `GET /api/workflow/suggestions` - Get workflow suggestions
- `POST /api/workflow/suggestions/:id/respond` - Respond to suggestion

### Patient Data
- `GET /api/patients/:id/summary` - Get patient summary
- `POST /api/data/anonymize` - Anonymize patient data (admin only)
- `DELETE /api/patients/:id` - Delete patient data (admin only)

### Audit & Quality
- `GET /api/audit/logs` - Query audit logs (admin/quality_officer)
- `GET /api/audit/statistics` - Get audit statistics (admin/quality_officer)
- `GET /api/quality/reports` - Get quality reports (admin/quality_officer)
- `GET /api/quality/flagged-cases` - Get flagged cases for review

### AI Services
- `POST /api/llm/generate` - Generate text with LLM
- `POST /api/llm/embed` - Generate embeddings
- `POST /api/rag/query` - Query RAG system
- `POST /api/explainability/explain` - Get AI explanation
- `POST /api/guardrails/validate` - Validate AI output

See [docs/AUTH_AND_AUDIT.md](docs/AUTH_AND_AUDIT.md) for detailed API documentation.

## User Roles

- **clinician**: Medical doctors who use the AI assistant
- **radiologist**: Specialists who review radiology reports
- **admin**: System administrators with full access
- **quality_officer**: Quality assurance personnel who review AI performance

## Security

- **Authentication**: JWT-based with refresh tokens
- **Authorization**: Role-based access control (RBAC)
- **Encryption**: AES-256-GCM at rest, TLS 1.3 in transit
- **Audit Logging**: All operations logged for 7 years
- **Account Lockout**: After 5 failed login attempts (30 minutes)

## Documentation

- [Authentication & Audit System](docs/AUTH_AND_AUDIT.md)
- [Encryption Guide](docs/ENCRYPTION.md)
- [LLM Service](docs/LLM_SERVICE.md)
- [AI Services Overview](docs/AI_SERVICES.md)
- [Clinical Modules](docs/CLINICAL_MODULES.md)
- [Workflow & Gateway](docs/WORKFLOW_AND_GATEWAY.md)
- [Deployment Guide](docs/DEPLOYMENT_GUIDE.md)
- [Storage Architecture](docs/STORAGE_ARCHITECTURE.md)
- [Project Structure](docs/PROJECT_STRUCTURE.md)

## Environment Variables

Key environment variables (see `.env.example` for full list):

```env
# Server
NODE_ENV=production
PORT=3000

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=medsutra_ai
DB_USER=postgres
DB_PASSWORD=your_password

# Authentication
JWT_SECRET=your_jwt_secret_change_in_production
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
AUTH_ENABLED=true

# Encryption
ENCRYPTION_KEY=your_32_byte_key_change_in_production
TLS_ENABLED=true

# Deployment
DEPLOYMENT_MODE=ON_PREM
```

## First-Time Setup

1. Install dependencies: `npm install`
2. Configure environment: `cp .env.example .env` and edit
3. Generate encryption key: `npm run generate-key`
4. Run migrations: `npm run migrate`
5. Start server: `npm run dev`
6. Register admin user: `POST /api/auth/register`
7. Login and start using the system

## Compliance

- **HIPAA**: Audit logging, access controls, encryption, 7-year retention
- **DPDP Act (India)**: Patient data deletion, anonymization, consent tracking

## License

PROPRIETARY - MedSutra Team

## Support

For issues or questions, contact the MedSutra AI development team.

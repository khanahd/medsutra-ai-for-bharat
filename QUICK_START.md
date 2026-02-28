# MedSutra AI - Quick Start Guide

This guide will help you get MedSutra AI up and running in under 10 minutes.

## Prerequisites

- Node.js 20+ installed
- PostgreSQL 15+ installed and running
- Git installed

## Step 1: Clone and Install

```bash
# Clone the repository (if not already done)
# cd into project directory

# Install dependencies
npm install
```

## Step 2: Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env file with your settings
# Minimum required changes:
# - DB_PASSWORD: Your PostgreSQL password
# - JWT_SECRET: Generate a secure random string (32+ characters)
# - ENCRYPTION_KEY: Generate using the command below
```

## Step 3: Generate Encryption Key

```bash
# Generate a secure encryption key
npm run generate-key

# Copy the generated key to .env file
# ENCRYPTION_KEY=<generated-key>
```

## Step 4: Set Up Database

```bash
# Create database (in PostgreSQL)
createdb medsutra_ai

# Or using psql:
psql -U postgres -c "CREATE DATABASE medsutra_ai;"

# Run migrations
npm run migrate
```

## Step 5: Start the Server

```bash
# Development mode (with hot reload)
npm run dev

# Production mode
npm run build
npm start
```

The server will start on `http://localhost:3000`

## Step 6: Create Admin User

```bash
# Register the first admin user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@hospital.com",
    "password": "Admin123!",
    "name": "System Administrator",
    "role": "admin"
  }'
```

## Step 7: Login and Get Token

```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@hospital.com",
    "password": "Admin123!"
  }'

# Save the accessToken from the response
```

## Step 8: Test the API

```bash
# Test health endpoint (no auth required)
curl http://localhost:3000/health

# Test authenticated endpoint
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer <your-access-token>"
```

## Development Mode Configuration

For easier development, you can disable authentication:

```env
# In .env file
AUTH_ENABLED=false
SKIP_AUTH=true
NODE_ENV=development
```

**⚠️ WARNING**: Never use these settings in production!

## Common Issues

### Issue: Database connection failed
**Solution**: Check that PostgreSQL is running and credentials in .env are correct

```bash
# Check PostgreSQL status
pg_isready

# Test connection
psql -U postgres -d medsutra_ai -c "SELECT 1;"
```

### Issue: Migration failed
**Solution**: Ensure database exists and user has permissions

```bash
# Grant permissions
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE medsutra_ai TO postgres;"
```

### Issue: Port already in use
**Solution**: Change PORT in .env file or kill the process using port 3000

```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>
```

### Issue: JWT token invalid
**Solution**: Ensure JWT_SECRET is set and matches between requests

## Next Steps

1. **Create Users**: Use the admin account to create clinician, radiologist, and quality_officer accounts
2. **Configure LLM**: Set up OpenAI API key or local LLM endpoint
3. **Load Medical Data**: Add hospital-approved medical guidelines to RAG system
4. **Test Features**: Try clinical summarization, radiology analysis, etc.
5. **Review Documentation**: Read docs/AUTH_AND_AUDIT.md for detailed API documentation

## API Endpoints Overview

### Public Endpoints (No Auth)
- `GET /health` - Health check
- `POST /api/auth/register` - Register user
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Refresh token

### Protected Endpoints (Auth Required)
- `GET /api/auth/me` - Get current user
- `POST /api/clinical/summarize` - Generate patient summary
- `POST /api/radiology/analyze` - Analyze radiology report
- `POST /api/documents/draft` - Generate document
- `GET /api/workflow/suggestions` - Get workflow suggestions

### Admin Only
- `GET /api/audit/logs` - View audit logs
- `GET /api/quality/reports` - View quality reports
- `DELETE /api/patients/:id` - Delete patient data
- `POST /api/data/anonymize` - Anonymize patient data

## Docker Quick Start (Alternative)

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Environment Variables Quick Reference

```env
# Essential
NODE_ENV=development
PORT=3000
DB_PASSWORD=your_password
JWT_SECRET=your_jwt_secret_32_chars_minimum
ENCRYPTION_KEY=your_32_byte_encryption_key

# Optional (for development)
AUTH_ENABLED=false
SKIP_AUTH=true
TLS_ENABLED=false

# LLM (if using OpenAI)
OPENAI_API_KEY=your_openai_api_key
```

## Testing the System

### 1. Test Authentication
```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@hospital.com","password":"Admin123!"}' \
  | jq -r '.accessToken')

echo "Token: $TOKEN"
```

### 2. Test Clinical Summarization
```bash
curl -X POST http://localhost:3000/api/clinical/summarize \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "documents": [
      {
        "type": "lab_report",
        "content": "Patient: John Doe. Hemoglobin: 12.5 g/dL. WBC: 8000/μL."
      }
    ]
  }'
```

### 3. Test Audit Logs
```bash
curl -X GET http://localhost:3000/api/audit/logs \
  -H "Authorization: Bearer $TOKEN"
```

## Production Deployment Checklist

Before deploying to production:

- [ ] Set strong JWT_SECRET (32+ characters)
- [ ] Generate secure ENCRYPTION_KEY
- [ ] Set AUTH_ENABLED=true
- [ ] Set SKIP_AUTH=false
- [ ] Enable TLS (TLS_ENABLED=true)
- [ ] Configure TLS certificates
- [ ] Set NODE_ENV=production
- [ ] Configure production database
- [ ] Set up database backups
- [ ] Configure monitoring and logging
- [ ] Review and restrict CORS_ORIGIN
- [ ] Set up rate limiting
- [ ] Run security audit
- [ ] Test all endpoints
- [ ] Review audit logs

## Getting Help

- **Documentation**: See `docs/` folder for detailed guides
- **API Reference**: `docs/AUTH_AND_AUDIT.md`
- **Architecture**: `docs/STORAGE_ARCHITECTURE.md`
- **Deployment**: `docs/DEPLOYMENT_GUIDE.md`

## Useful Commands

```bash
# Development
npm run dev              # Start dev server with hot reload
npm run build            # Build for production
npm start                # Start production server

# Database
npm run migrate          # Run migrations
npm run migrate:revert   # Revert last migration

# Code Quality
npm run lint             # Run ESLint
npm run lint:fix         # Fix ESLint errors
npm run format           # Format code with Prettier

# Testing
npm test                 # Run tests
npm run test:watch       # Run tests in watch mode

# Utilities
npm run generate-key     # Generate encryption key
```

## Support

For issues or questions, contact the MedSutra AI development team.

---

**Happy Coding! 🚀**

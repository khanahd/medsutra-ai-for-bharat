# MedSutra AI Deployment Guide

This guide covers deployment configurations for MedSutra AI across different environments.

---

## Deployment Modes

MedSutra AI supports three deployment modes:

1. **On-Prem**: Complete deployment within hospital infrastructure (no external dependencies)
2. **Hybrid Cloud**: Edge inference + cloud processing with encrypted transmission
3. **Offline**: Core functionality without internet connectivity

---

## Task 19: On-Prem Deployment Configuration

### Overview

On-Prem deployment ensures complete data sovereignty with no external network dependencies. All components run within hospital infrastructure.

### Key Features

- ✅ **Network Isolation**: No external network calls
- ✅ **Local Model Inference**: All AI models run locally
- ✅ **Data Sovereignty**: All data stays within hospital
- ✅ **HIPAA/DPDP Compliant**: Full compliance with data protection regulations
- ✅ **No Cloud Dependencies**: Operates independently

### System Requirements

#### Minimum Requirements
- **CPU**: 8 cores (16 recommended)
- **RAM**: 32 GB (64 GB recommended)
- **Storage**: 500 GB SSD
- **GPU**: Optional (recommended for Vision Analyzer)
- **OS**: Ubuntu 20.04 LTS or Windows Server 2019+
- **Database**: PostgreSQL 14+
- **Network**: Isolated hospital network

#### Recommended Requirements
- **CPU**: 16+ cores
- **RAM**: 128 GB
- **Storage**: 1 TB NVMe SSD
- **GPU**: NVIDIA Tesla T4 or better (for Vision Analyzer)
- **OS**: Ubuntu 22.04 LTS
- **Database**: PostgreSQL 15+
- **Network**: Dedicated VLAN for MedSutra AI

### Installation Steps

#### 1. Prerequisites

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL 15
sudo apt install -y postgresql-15 postgresql-contrib

# Install Docker (optional, for containerized deployment)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
```

#### 2. Clone Repository

```bash
git clone https://github.com/your-org/medsutra-ai.git
cd medsutra-ai
```

#### 3. Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit configuration
nano .env
```

**On-Prem Configuration (.env):**

```bash
# Deployment Mode
DEPLOYMENT_MODE=ON_PREM

# Server Configuration
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# TLS Configuration (Required for production)
TLS_ENABLED=true
TLS_CERT_PATH=./certs/server.crt
TLS_KEY_PATH=./certs/server.key
TLS_CA_PATH=./certs/ca.crt

# Database Configuration (Local PostgreSQL)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=medsutra_ai
DB_USER=medsutra_user
DB_PASSWORD=<strong_password>
DB_SSL=true

# JWT Configuration
JWT_SECRET=<generate_strong_secret>
JWT_EXPIRES_IN=24h

# Encryption Configuration
ENCRYPTION_KEY=<generate_32_byte_key>
KEY_ID=key_v1

# LLM Configuration (Local Model)
LLM_ENDPOINT=http://localhost:8000/v1
LLM_MODEL=local-clinical-llm
LLM_API_KEY=local

# OpenAI Configuration (Not used in On-Prem)
OPENAI_API_KEY=
OPENAI_BASE_URL=

# Vector Database (Local pgvector)
VECTOR_DB_URL=postgresql://localhost:5432/medsutra_ai
VECTOR_DB_API_KEY=

# Vision Analyzer (Optional)
VISION_ANALYZER_ENABLED=false
VISION_MODEL_PATH=./models/vision_model.pth
GPU_ENABLED=false

# Regional Language Support
REGIONAL_LANGUAGES=tamil,telugu,kannada,malayalam

# EMR Integration (Local)
EMR_ENDPOINT=http://localhost:8080/emr
EMR_API_KEY=<emr_api_key>

# Performance Configuration
MAX_CONCURRENT_USERS=100
REQUEST_TIMEOUT_MS=30000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# Authentication
AUTH_ENABLED=true

# CORS Configuration (Restrict to hospital network)
CORS_ORIGIN=https://hospital-ui.local

# Logging
LOG_LEVEL=info
LOG_FILE_PATH=./logs/medsutra.log
```

#### 4. Generate Encryption Keys

```bash
# Generate encryption key
npm run generate-key

# Generate TLS certificates (if not provided by hospital IT)
openssl req -x509 -newkey rsa:4096 -keyout certs/server.key -out certs/server.crt -days 365 -nodes
```

#### 5. Install Dependencies

```bash
# Install Node.js dependencies
npm install

# Build TypeScript
npm run build
```

#### 6. Setup Database

```bash
# Create database
sudo -u postgres psql -c "CREATE DATABASE medsutra_ai;"
sudo -u postgres psql -c "CREATE USER medsutra_user WITH ENCRYPTED PASSWORD '<password>';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE medsutra_ai TO medsutra_user;"

# Enable pgvector extension
sudo -u postgres psql -d medsutra_ai -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Run migrations
npm run migrate
```

#### 7. Package Local Models

```bash
# Download and package models for local inference
# (This step requires access to model files)

mkdir -p models
# Copy Clinical LLM model files to ./models/
# Copy Vision Analyzer model (if enabled) to ./models/
# Copy Medical Ontology files to ./models/ontologies/
```

#### 8. Initialize RAG System

```bash
# Load hospital-approved medical guidelines
npm run init-rag
```

#### 9. Verify Network Isolation

```bash
# Run network isolation verification
npm run verify-isolation
```

#### 10. Start Application

```bash
# Start in production mode
npm run start

# Or use PM2 for process management
npm install -g pm2
pm2 start dist/index.js --name medsutra-ai
pm2 save
pm2 startup
```

### Docker Deployment (Recommended)

#### 1. Build Docker Image

```bash
docker build -t medsutra-ai:latest .
```

#### 2. Run with Docker Compose

```bash
# Start all services
docker-compose -f docker-compose.onprem.yml up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

**docker-compose.onprem.yml:**

```yaml
version: '3.8'

services:
  medsutra-ai:
    image: medsutra-ai:latest
    container_name: medsutra-ai
    restart: always
    ports:
      - "3000:3000"
    environment:
      - DEPLOYMENT_MODE=ON_PREM
      - NODE_ENV=production
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_NAME=medsutra_ai
      - DB_USER=medsutra_user
      - DB_PASSWORD=${DB_PASSWORD}
    volumes:
      - ./models:/app/models
      - ./logs:/app/logs
      - ./certs:/app/certs
    depends_on:
      - postgres
    networks:
      - medsutra-network

  postgres:
    image: pgvector/pgvector:pg15
    container_name: medsutra-postgres
    restart: always
    environment:
      - POSTGRES_DB=medsutra_ai
      - POSTGRES_USER=medsutra_user
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    networks:
      - medsutra-network

volumes:
  postgres-data:

networks:
  medsutra-network:
    driver: bridge
```

### Network Isolation Verification

The system automatically verifies network isolation on startup:

```typescript
import { deploymentManager } from './config/deployment';

// Verify network isolation
const isolation = await deploymentManager.verifyNetworkIsolation();

if (!isolation.isolated) {
  console.error('Network isolation verification failed:');
  console.error(isolation.externalCallsDetected);
  process.exit(1);
}
```

### Security Checklist

- [ ] TLS 1.3 enabled for all communications
- [ ] AES-256-GCM encryption for data at rest
- [ ] Strong JWT secret generated
- [ ] Strong encryption key generated
- [ ] Database password is strong and unique
- [ ] Network isolation verified
- [ ] No external API keys configured
- [ ] Firewall rules configured (block all outbound traffic)
- [ ] Access logs enabled
- [ ] Audit logging enabled
- [ ] Regular backups configured

### Firewall Configuration

```bash
# Allow inbound HTTPS only from hospital network
sudo ufw allow from 192.168.1.0/24 to any port 3000

# Block all outbound traffic (except local network)
sudo ufw default deny outgoing
sudo ufw allow out to 192.168.1.0/24

# Enable firewall
sudo ufw enable
```

### Backup Configuration

```bash
# Database backup script
#!/bin/bash
BACKUP_DIR="/backup/medsutra"
DATE=$(date +%Y%m%d_%H%M%S)

# Backup database
pg_dump -U medsutra_user medsutra_ai > "$BACKUP_DIR/db_$DATE.sql"

# Backup models
tar -czf "$BACKUP_DIR/models_$DATE.tar.gz" ./models

# Backup logs
tar -czf "$BACKUP_DIR/logs_$DATE.tar.gz" ./logs

# Keep only last 30 days of backups
find $BACKUP_DIR -name "*.sql" -mtime +30 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete
```

### Monitoring

```bash
# Check application status
pm2 status

# View logs
pm2 logs medsutra-ai

# Monitor resources
pm2 monit

# Check database connections
psql -U medsutra_user -d medsutra_ai -c "SELECT count(*) FROM pg_stat_activity;"

# Check disk space
df -h

# Check memory usage
free -h
```

### Troubleshooting

#### Application won't start

```bash
# Check logs
tail -f logs/medsutra.log

# Check database connection
psql -U medsutra_user -d medsutra_ai -c "SELECT 1;"

# Verify environment variables
node -e "require('dotenv').config(); console.log(process.env.DEPLOYMENT_MODE);"
```

#### Network isolation verification fails

```bash
# Check for external endpoints in configuration
grep -r "api.openai.com" .env
grep -r "https://" .env | grep -v "localhost"

# Verify firewall rules
sudo ufw status verbose
```

#### Performance issues

```bash
# Check CPU usage
top

# Check memory usage
free -h

# Check database performance
psql -U medsutra_user -d medsutra_ai -c "SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;"

# Increase max concurrent users
# Edit .env: MAX_CONCURRENT_USERS=200
```

### Maintenance

#### Update Application

```bash
# Backup current version
cp -r /opt/medsutra-ai /opt/medsutra-ai.backup

# Pull latest code
git pull origin main

# Install dependencies
npm install

# Build
npm run build

# Run migrations
npm run migrate

# Restart application
pm2 restart medsutra-ai
```

#### Update Models

```bash
# Stop application
pm2 stop medsutra-ai

# Backup current models
cp -r models models.backup

# Copy new models
cp -r /path/to/new/models/* models/

# Start application
pm2 start medsutra-ai
```

### Compliance

#### HIPAA Compliance

- ✅ Encryption at rest (AES-256-GCM)
- ✅ Encryption in transit (TLS 1.3)
- ✅ Access controls (RBAC)
- ✅ Audit logging (7-year retention)
- ✅ Data backup and recovery
- ✅ Network isolation

#### DPDP Act Compliance (India)

- ✅ Data localization (all data in India)
- ✅ Patient consent management
- ✅ Right to deletion
- ✅ Data anonymization for research
- ✅ Breach notification procedures

### Support

For technical support:
- Email: support@medsutra.ai
- Phone: +91-XXXX-XXXXXX
- Documentation: https://docs.medsutra.ai

---

## Next Steps

After On-Prem deployment:
1. Configure user accounts and roles (Task 4)
2. Set up audit logging (Task 5)
3. Train staff on system usage
4. Conduct security audit
5. Perform load testing
6. Schedule regular backups
7. Plan for disaster recovery

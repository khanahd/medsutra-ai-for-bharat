# Storage Architecture

This document explains where and how data is stored in the MedSutra AI system.

## Overview

The MedSutra AI system uses a **hybrid storage architecture**:
1. **PostgreSQL Database** - Persistent storage for clinical data, documents, and audit logs
2. **Vector Database** - Embeddings for RAG system (Pinecone/Weaviate/pgvector)
3. **In-Memory Storage** - Temporary caching and session data
4. **Redis (Recommended)** - Distributed caching for production

---

## Current Storage Status

### ✅ Persistent Storage (PostgreSQL)

The following data is **already configured** to be stored in PostgreSQL:

#### 1. **Patient Data**
- **Entity**: `src/entities/Patient.ts`
- **Table**: `patients`
- **Stores**: Patient demographics, medical record numbers, encrypted PHI
- **Status**: ✅ Database schema ready, TypeORM entity defined

#### 2. **Clinical Documents**
- **Entity**: `src/entities/ClinicalDocument.ts`
- **Table**: `clinical_documents`
- **Stores**: Source documents (EMR notes, lab reports, discharge summaries, etc.)
- **Status**: ✅ Database schema ready, TypeORM entity defined

#### 3. **Patient Snapshots**
- **Entity**: `src/entities/PatientSnapshot.ts`
- **Table**: `patient_snapshots`
- **Stores**: Generated patient summaries from Clinical Summarizer
- **Status**: ✅ Database schema ready, TypeORM entity defined
- **Note**: Currently generated on-the-fly, should be saved to database

#### 4. **Radiology Analyses**
- **Entity**: `src/entities/RadiologyAnalysis.ts`
- **Table**: `radiology_analyses`
- **Stores**: Radiology report analysis results, cancer risk flags
- **Status**: ✅ Database schema ready, TypeORM entity defined
- **Note**: Currently generated on-the-fly, should be saved to database

#### 5. **Document Drafts**
- **Entity**: `src/entities/DocumentDraft.ts`
- **Table**: `document_drafts`
- **Stores**: Clinical document drafts (OPD notes, discharge summaries, etc.)
- **Status**: ⚠️ Database schema ready, but service uses in-memory Map
- **Action Required**: Update DocumentationAssistant to use TypeORM repository

#### 6. **Workflow Suggestions**
- **Entity**: `src/entities/WorkflowSuggestion.ts`
- **Table**: `workflow_suggestions`
- **Stores**: AI-generated workflow suggestions (referrals, biopsies, follow-ups)
- **Status**: ✅ Database schema ready, TypeORM entity defined
- **Note**: Not yet implemented (Task 15)

#### 7. **Access Logs**
- **Entity**: `src/entities/AccessLog.ts`
- **Table**: `access_logs`
- **Stores**: All patient data access attempts with user identification
- **Status**: ✅ Database schema ready, TypeORM entity defined
- **Note**: Not yet implemented (Task 5)

#### 8. **Audit Records**
- **Entity**: `src/entities/AuditRecord.ts`
- **Table**: `audit_records`
- **Stores**: Comprehensive audit trail (AI suggestions, clinician decisions)
- **Retention**: 7 years minimum (enforced by database constraint)
- **Status**: ✅ Database schema ready, TypeORM entity defined
- **Note**: Not yet implemented (Task 5)

#### 9. **Flagged Statements**
- **Entity**: `src/entities/FlaggedStatement.ts`
- **Table**: `flagged_statements`
- **Stores**: AI statements flagged by Guardrail System
- **Status**: ⚠️ Database schema ready, but service uses in-memory Map
- **Action Required**: Update GuardrailSystem to use TypeORM repository

---

### ⚠️ In-Memory Storage (Temporary - Needs Migration)

The following services currently use **in-memory storage** and will lose data on server restart:

#### 1. **DocumentationAssistant**
**Location**: `src/services/documentation/DocumentationAssistant.ts`

**Current Implementation**:
```typescript
private drafts: Map<string, DocumentDraft>;
private workflows: Map<string, ReviewWorkflow>;
```

**Problem**: 
- Document drafts lost on server restart
- Cannot scale horizontally (each server has different data)
- No persistence for review workflows

**Solution**:
```typescript
// Replace with TypeORM repository
import { Repository } from 'typeorm';
import { DocumentDraft } from '../../entities/DocumentDraft';

private draftRepository: Repository<DocumentDraft>;

// Save to database
await this.draftRepository.save(draft);

// Retrieve from database
const draft = await this.draftRepository.findOne({ where: { id: draftId } });
```

**Action Required**: 
- Create ReviewWorkflow entity and table
- Update DocumentationAssistant to use TypeORM repositories
- Migrate existing Map-based methods to database queries

#### 2. **GuardrailSystem**
**Location**: `src/services/guardrails/GuardrailSystem.ts`

**Current Implementation**:
```typescript
private flaggedStatements: Map<string, FlaggedStatement>;
```

**Problem**:
- Flagged statements lost on server restart
- Cannot track review status across restarts
- Quality officers cannot review historical flags

**Solution**:
```typescript
// Use existing FlaggedStatement entity
import { Repository } from 'typeorm';
import { FlaggedStatement } from '../../entities/FlaggedStatement';

private flaggedRepository: Repository<FlaggedStatement>;

// Save to database
await this.flaggedRepository.save(flaggedStatement);
```

**Action Required**:
- Update GuardrailSystem to use TypeORM repository
- Add methods to query flagged statements by status, module, date range

#### 3. **RAGSystem**
**Location**: `src/services/rag/RAGSystem.ts`

**Current Implementation**:
```typescript
private documents: Map<string, RAGDocument>;
```

**Problem**:
- RAG documents lost on server restart
- Must reload all documents on startup
- No vector similarity search (using simple cosine similarity)

**Solution**:
```typescript
// Use vector database (pgvector, Pinecone, or Weaviate)
import { VectorStore } from './vector-store';

private vectorStore: VectorStore;

// Store document with embedding
await this.vectorStore.upsert({
  id: document.id,
  embedding: document.embedding,
  metadata: document
});

// Query similar documents
const results = await this.vectorStore.query(queryEmbedding, topK);
```

**Action Required**:
- Choose vector database (pgvector recommended for on-prem)
- Create VectorStore abstraction layer
- Migrate RAGSystem to use vector database
- Add document persistence to PostgreSQL for metadata

#### 4. **LLMCache**
**Location**: `src/services/llm/LLMCache.ts`

**Current Implementation**:
```typescript
private textCache: Map<string, CachedResponse>;
private embeddingCache: Map<string, CachedEmbedding>;
private classificationCache: Map<string, CachedClassification>;
```

**Problem**:
- Cache lost on server restart
- Cannot share cache across multiple servers
- No TTL (time-to-live) management

**Solution**:
```typescript
// Use Redis for distributed caching
import Redis from 'ioredis';

private redis: Redis;

// Cache with TTL
await this.redis.setex(
  `llm:text:${hash}`,
  3600, // 1 hour TTL
  JSON.stringify(response)
);

// Retrieve from cache
const cached = await this.redis.get(`llm:text:${hash}`);
```

**Action Required**:
- Add Redis to docker-compose.yml
- Create Redis client wrapper
- Update LLMCache to use Redis
- Add cache statistics and monitoring

#### 5. **MedicalOntology**
**Location**: `src/services/ontology/MedicalOntology.ts`

**Current Implementation**:
```typescript
private snomedCodes: Map<string, SnomedCode>;
private icd10Codes: Map<string, ICD10Code>;
private loincCodes: Map<string, LoincCode>;
```

**Status**: ✅ **Acceptable** - Reference data loaded at startup

**Reasoning**:
- Ontology codes are static reference data
- Loaded from files or database at startup
- Rarely changes (only with ontology updates)
- Fast in-memory lookup is beneficial

**Optional Enhancement**:
- Store in PostgreSQL for easier updates
- Add version tracking
- Support hot-reload without restart

---

## Database Schema Summary

### PostgreSQL Tables (Already Created)

```sql
-- Core clinical data
patients                 -- Patient demographics and encrypted PHI
clinical_documents       -- Source clinical documents
patient_snapshots        -- Generated patient summaries
radiology_analyses       -- Radiology analysis results

-- Documentation workflow
document_drafts          -- Clinical document drafts
workflow_suggestions     -- AI workflow suggestions

-- Security and compliance
access_logs             -- Patient data access logs
audit_records           -- Comprehensive audit trail (7-year retention)
flagged_statements      -- AI statements flagged for review
```

### Vector Database (To Be Implemented)

**Recommended**: pgvector (PostgreSQL extension)

```sql
-- RAG documents with embeddings
CREATE TABLE rag_documents (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source VARCHAR(50) NOT NULL,
  credibility FLOAT NOT NULL,
  last_verified TIMESTAMP NOT NULL,
  embedding vector(1536),  -- pgvector type
  metadata JSONB
);

-- Create index for similarity search
CREATE INDEX ON rag_documents USING ivfflat (embedding vector_cosine_ops);
```

**Alternatives**:
- **Pinecone**: Managed vector database (cloud-only)
- **Weaviate**: Open-source vector database
- **Milvus**: Scalable vector database

---

## Storage by Module

### Clinical Summarizer
- **Input**: `clinical_documents` table
- **Output**: `patient_snapshots` table (should be saved)
- **Current**: Generated on-the-fly, not persisted
- **Action**: Save snapshots to database for audit trail

### Radiology Analyzer
- **Input**: Radiology reports (from `clinical_documents`)
- **Output**: `radiology_analyses` table (should be saved)
- **Current**: Generated on-the-fly, not persisted
- **Action**: Save analyses to database for audit trail

### Vision Analyzer (Optional)
- **Input**: Medical images (DICOM files or URLs)
- **Output**: Image analysis results
- **Storage**: 
  - Image metadata in PostgreSQL
  - Image files in object storage (S3, MinIO, or file system)
  - Analysis results in PostgreSQL
- **Current**: Not persisted
- **Action**: Create ImageAnalysis entity and table

### Documentation Assistant
- **Input**: `patient_snapshots` table
- **Output**: `document_drafts` table
- **Current**: ⚠️ In-memory Map (needs migration)
- **Action**: Use TypeORM repository for persistence

### Workflow Engine (Not Yet Implemented)
- **Input**: `patient_snapshots`, `radiology_analyses`
- **Output**: `workflow_suggestions` table
- **Storage**: PostgreSQL
- **Status**: Database schema ready

### Guardrail System
- **Input**: AI-generated content
- **Output**: `flagged_statements` table
- **Current**: ⚠️ In-memory Map (needs migration)
- **Action**: Use TypeORM repository for persistence

### RAG System
- **Input**: Hospital-approved medical documents
- **Output**: Vector embeddings
- **Current**: ⚠️ In-memory Map (needs migration)
- **Action**: Migrate to vector database (pgvector recommended)

---

## Recommended Migration Priority

### Phase 1: Critical (Immediate)
1. **DocumentationAssistant** → PostgreSQL
   - Document drafts must persist across restarts
   - Review workflows need audit trail

2. **GuardrailSystem** → PostgreSQL
   - Flagged statements need persistence
   - Quality review requires historical data

### Phase 2: Important (Short-term)
3. **RAGSystem** → Vector Database
   - Improve similarity search performance
   - Enable document persistence

4. **LLMCache** → Redis
   - Enable distributed caching
   - Improve performance across multiple servers

### Phase 3: Enhancement (Medium-term)
5. **Save Analysis Results**
   - Patient snapshots to database
   - Radiology analyses to database
   - Enable historical analysis and trending

6. **Implement Audit Logging**
   - Access logs for all patient data access
   - Audit records for all AI suggestions and clinician decisions

---

## Production Deployment Considerations

### On-Prem Deployment
- PostgreSQL on hospital servers
- pgvector for RAG (no external dependencies)
- Redis on hospital servers (optional)
- File system for image storage

### Hybrid Cloud Deployment
- PostgreSQL on-prem for PHI data
- Vector database in cloud (encrypted)
- Redis in cloud for caching
- S3 for image storage (encrypted)

### Offline Deployment
- PostgreSQL on local servers
- pgvector for RAG
- Local file system for all storage
- No external dependencies

---

## Data Retention Policies

| Data Type | Retention Period | Storage Location |
|-----------|-----------------|------------------|
| Patient Data | Per hospital policy | PostgreSQL (encrypted) |
| Clinical Documents | Per hospital policy | PostgreSQL |
| Patient Snapshots | Per hospital policy | PostgreSQL |
| Radiology Analyses | Per hospital policy | PostgreSQL |
| Document Drafts | Per hospital policy | PostgreSQL |
| Audit Records | **7 years minimum** | PostgreSQL |
| Access Logs | **7 years minimum** | PostgreSQL |
| Flagged Statements | Per hospital policy | PostgreSQL |
| LLM Cache | 1-24 hours | Redis (ephemeral) |
| RAG Documents | Permanent | Vector DB + PostgreSQL |

---

## Next Steps

1. **Create Migration Script** to move in-memory data to PostgreSQL
2. **Implement Vector Database** for RAG system
3. **Add Redis** for distributed caching
4. **Update Services** to use TypeORM repositories
5. **Add Audit Logging** for all operations
6. **Test Data Persistence** across server restarts
7. **Document Backup Procedures** for production

---

## Code Examples

### Saving Document Draft to Database

```typescript
// Before (in-memory)
this.drafts.set(draft.id, draft);

// After (database)
import { AppDataSource } from '../../config/database';
import { DocumentDraft as DocumentDraftEntity } from '../../entities/DocumentDraft';

const draftRepository = AppDataSource.getRepository(DocumentDraftEntity);
await draftRepository.save({
  id: draft.id,
  patientId: draft.patientId,
  documentType: draft.type,
  content: draft.content,
  status: draft.status,
  createdBy: draft.generatedBy
});
```

### Saving Flagged Statement to Database

```typescript
// Before (in-memory)
this.flaggedStatements.set(statement.id, statement);

// After (database)
import { AppDataSource } from '../../config/database';
import { FlaggedStatement } from '../../entities/FlaggedStatement';

const flaggedRepository = AppDataSource.getRepository(FlaggedStatement);
await flaggedRepository.save({
  statement: statement.statement,
  reason: statement.reason,
  module: statement.module,
  patientId: statement.patientId
});
```

### Using Redis for LLM Cache

```typescript
// Before (in-memory)
this.textCache.set(hash, response);

// After (Redis)
import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379')
});

await redis.setex(
  `llm:text:${hash}`,
  3600, // 1 hour TTL
  JSON.stringify(response)
);
```

# Project Structure - File Locations

This document shows where all code files are saved in the MedSutra AI project.

## 📁 Complete Directory Structure

```
medsutra-ai/
├── .kiro/                          # Kiro IDE configuration
│   └── specs/                      # Specification files
│       └── medsutra-clinical-ai-assistant/
│           ├── requirements.md     # Requirements document
│           ├── design.md          # Design document
│           └── tasks.md           # Implementation tasks
│
├── docs/                          # Documentation
│   ├── AI_SERVICES.md            # AI services documentation
│   ├── CLINICAL_MODULES.md       # Clinical modules guide
│   ├── ENCRYPTION.md             # Encryption documentation
│   ├── IMPLEMENTATION_SUMMARY.md # Implementation summary
│   ├── LLM_SERVICE.md            # LLM service documentation
│   ├── STORAGE_ARCHITECTURE.md   # Storage architecture guide
│   └── PROJECT_STRUCTURE.md      # This file
│
├── examples/                      # Example code
│   └── ai-pipeline-integration.ts # Integration example
│
├── scripts/                       # Utility scripts
│   └── generate-encryption-key.ts # Encryption key generator
│
├── src/                          # Source code
│   ├── config/                   # Configuration files
│   │   ├── database.ts          # Database configuration
│   │   └── tls.ts               # TLS/HTTPS configuration
│   │
│   ├── entities/                 # TypeORM database entities
│   │   ├── AccessLog.ts         # Access log entity
│   │   ├── AuditRecord.ts       # Audit record entity
│   │   ├── ClinicalDocument.ts  # Clinical document entity
│   │   ├── DocumentDraft.ts     # Document draft entity
│   │   ├── FlaggedStatement.ts  # Flagged statement entity
│   │   ├── Patient.ts           # Patient entity
│   │   ├── PatientSnapshot.ts   # Patient snapshot entity
│   │   ├── RadiologyAnalysis.ts # Radiology analysis entity
│   │   ├── WorkflowSuggestion.ts # Workflow suggestion entity
│   │   └── index.ts             # Entity exports
│   │
│   ├── migrations/               # Database migrations
│   │   └── 1704000000000-InitialSchema.ts # Initial schema
│   │
│   ├── routes/                   # API route handlers
│   │   ├── clinical.routes.ts   # Clinical summarizer routes
│   │   ├── documentation.routes.ts # Documentation assistant routes
│   │   ├── explainability.routes.ts # Explainability routes
│   │   ├── guardrails.routes.ts # Guardrails routes
│   │   ├── llm.routes.ts        # LLM routes
│   │   ├── radiology.routes.ts  # Radiology analyzer routes
│   │   ├── rag.routes.ts        # RAG system routes
│   │   └── vision.routes.ts     # Vision analyzer routes
│   │
│   ├── services/                 # Business logic services
│   │   ├── clinical/            # Clinical Summarizer Module
│   │   │   ├── ClinicalSummarizer.ts # Main service
│   │   │   └── index.ts         # Module exports
│   │   │
│   │   ├── documentation/       # Documentation Assistant Module
│   │   │   ├── DocumentationAssistant.ts # Main service
│   │   │   └── index.ts         # Module exports
│   │   │
│   │   ├── explainability/      # Explainability Engine
│   │   │   ├── ExplainabilityEngine.ts # Main service
│   │   │   └── index.ts         # Module exports
│   │   │
│   │   ├── guardrails/          # Guardrail System
│   │   │   ├── GuardrailSystem.ts # Main service
│   │   │   └── index.ts         # Module exports
│   │   │
│   │   ├── llm/                 # LLM Integration
│   │   │   ├── ClinicalLLM.ts   # LLM client
│   │   │   ├── LLMCache.ts      # LLM caching
│   │   │   ├── LLMMonitor.ts    # LLM monitoring
│   │   │   └── index.ts         # Module exports
│   │   │
│   │   ├── ontology/            # Medical Ontology
│   │   │   ├── MedicalOntology.ts # Ontology service
│   │   │   └── index.ts         # Module exports
│   │   │
│   │   ├── radiology/           # Radiology Analyzer Module
│   │   │   ├── RadiologyAnalyzer.ts # Main service
│   │   │   └── index.ts         # Module exports
│   │   │
│   │   ├── rag/                 # RAG System
│   │   │   ├── RAGSystem.ts     # RAG service
│   │   │   ├── DocumentLoader.ts # Document loader
│   │   │   └── index.ts         # Module exports
│   │   │
│   │   └── vision/              # Vision Analyzer Module (Optional)
│   │       ├── VisionAnalyzer.ts # Main service
│   │       └── index.ts         # Module exports
│   │
│   ├── utils/                    # Utility functions
│   │   ├── database-init.ts     # Database initialization
│   │   ├── encryption.ts        # Encryption utilities
│   │   ├── encryption-errors.ts # Encryption error types
│   │   ├── key-management.ts    # Key management
│   │   └── logger.ts            # Winston logger
│   │
│   └── index.ts                  # Main application entry point
│
├── .env.example                  # Environment variables template
├── .eslintrc.json               # ESLint configuration
├── .gitignore                   # Git ignore rules
├── .prettierrc                  # Prettier configuration
├── docker-compose.yml           # Docker Compose configuration
├── Dockerfile                   # Docker image definition
├── package.json                 # NPM dependencies
├── README.md                    # Project README
└── tsconfig.json                # TypeScript configuration
```

---

## 📂 File Locations by Category

### 1. Core Application Files

| File | Location | Purpose |
|------|----------|---------|
| Main entry point | `src/index.ts` | Express server setup, route registration |
| Package dependencies | `package.json` | NPM dependencies and scripts |
| TypeScript config | `tsconfig.json` | TypeScript compiler settings |
| Environment template | `.env.example` | Environment variable template |

### 2. Configuration Files

| File | Location | Purpose |
|------|----------|---------|
| Database config | `src/config/database.ts` | TypeORM DataSource configuration |
| TLS config | `src/config/tls.ts` | HTTPS/TLS 1.3 configuration |
| ESLint config | `.eslintrc.json` | Code linting rules |
| Prettier config | `.prettierrc` | Code formatting rules |
| Docker config | `docker-compose.yml` | Multi-container setup |
| Dockerfile | `Dockerfile` | Container image definition |

### 3. Database Files

| File | Location | Purpose |
|------|----------|---------|
| Initial schema | `src/migrations/1704000000000-InitialSchema.ts` | Database schema migration |
| Patient entity | `src/entities/Patient.ts` | Patient data model |
| Clinical document | `src/entities/ClinicalDocument.ts` | Clinical document model |
| Patient snapshot | `src/entities/PatientSnapshot.ts` | Patient snapshot model |
| Radiology analysis | `src/entities/RadiologyAnalysis.ts` | Radiology analysis model |
| Document draft | `src/entities/DocumentDraft.ts` | Document draft model |
| Workflow suggestion | `src/entities/WorkflowSuggestion.ts` | Workflow suggestion model |
| Access log | `src/entities/AccessLog.ts` | Access log model |
| Audit record | `src/entities/AuditRecord.ts` | Audit record model |
| Flagged statement | `src/entities/FlaggedStatement.ts` | Flagged statement model |
| Entity index | `src/entities/index.ts` | All entity exports |

### 4. Service Modules (Business Logic)

#### Clinical Summarizer (Task 11)
| File | Location | Purpose |
|------|----------|---------|
| Main service | `src/services/clinical/ClinicalSummarizer.ts` | Patient snapshot generation |
| Module exports | `src/services/clinical/index.ts` | TypeScript exports |
| API routes | `src/routes/clinical.routes.ts` | REST API endpoints |

#### Radiology Analyzer (Task 12)
| File | Location | Purpose |
|------|----------|---------|
| Main service | `src/services/radiology/RadiologyAnalyzer.ts` | Radiology report analysis |
| Module exports | `src/services/radiology/index.ts` | TypeScript exports |
| API routes | `src/routes/radiology.routes.ts` | REST API endpoints |

#### Vision Analyzer (Task 13 - Optional)
| File | Location | Purpose |
|------|----------|---------|
| Main service | `src/services/vision/VisionAnalyzer.ts` | Medical image analysis |
| Module exports | `src/services/vision/index.ts` | TypeScript exports |
| API routes | `src/routes/vision.routes.ts` | REST API endpoints |

#### Documentation Assistant (Task 14)
| File | Location | Purpose |
|------|----------|---------|
| Main service | `src/services/documentation/DocumentationAssistant.ts` | Document drafting |
| Module exports | `src/services/documentation/index.ts` | TypeScript exports |
| API routes | `src/routes/documentation.routes.ts` | REST API endpoints |

#### LLM Integration (Task 6)
| File | Location | Purpose |
|------|----------|---------|
| LLM client | `src/services/llm/ClinicalLLM.ts` | OpenAI API integration |
| LLM cache | `src/services/llm/LLMCache.ts` | Response caching |
| LLM monitor | `src/services/llm/LLMMonitor.ts` | Performance monitoring |
| Module exports | `src/services/llm/index.ts` | TypeScript exports |
| API routes | `src/routes/llm.routes.ts` | REST API endpoints |

#### RAG System (Task 7)
| File | Location | Purpose |
|------|----------|---------|
| RAG service | `src/services/rag/RAGSystem.ts` | Document retrieval |
| Document loader | `src/services/rag/DocumentLoader.ts` | Load medical guidelines |
| Module exports | `src/services/rag/index.ts` | TypeScript exports |
| API routes | `src/routes/rag.routes.ts` | REST API endpoints |

#### Explainability Engine (Task 8)
| File | Location | Purpose |
|------|----------|---------|
| Main service | `src/services/explainability/ExplainabilityEngine.ts` | AI explanation generation |
| Module exports | `src/services/explainability/index.ts` | TypeScript exports |
| API routes | `src/routes/explainability.routes.ts` | REST API endpoints |

#### Guardrail System (Task 9)
| File | Location | Purpose |
|------|----------|---------|
| Main service | `src/services/guardrails/GuardrailSystem.ts` | AI output validation |
| Module exports | `src/services/guardrails/index.ts` | TypeScript exports |
| API routes | `src/routes/guardrails.routes.ts` | REST API endpoints |

#### Medical Ontology (Task 10)
| File | Location | Purpose |
|------|----------|---------|
| Main service | `src/services/ontology/MedicalOntology.ts` | SNOMED/ICD-10/LOINC mapping |
| Module exports | `src/services/ontology/index.ts` | TypeScript exports |

### 5. Security & Utilities

| File | Location | Purpose |
|------|----------|---------|
| Encryption utils | `src/utils/encryption.ts` | AES-256-GCM encryption |
| Key management | `src/utils/key-management.ts` | Encryption key rotation |
| Encryption errors | `src/utils/encryption-errors.ts` | Custom error types |
| Database init | `src/utils/database-init.ts` | Database connection setup |
| Logger | `src/utils/logger.ts` | Winston logging configuration |
| Key generator | `scripts/generate-encryption-key.ts` | Generate encryption keys |

### 6. Documentation

| File | Location | Purpose |
|------|----------|---------|
| Project README | `README.md` | Project overview |
| AI Services | `docs/AI_SERVICES.md` | AI services documentation |
| Clinical Modules | `docs/CLINICAL_MODULES.md` | Clinical modules guide |
| Encryption | `docs/ENCRYPTION.md` | Encryption documentation |
| Implementation | `docs/IMPLEMENTATION_SUMMARY.md` | Implementation summary |
| LLM Service | `docs/LLM_SERVICE.md` | LLM service guide |
| Storage | `docs/STORAGE_ARCHITECTURE.md` | Storage architecture |
| Project Structure | `docs/PROJECT_STRUCTURE.md` | This file |

### 7. Examples & Scripts

| File | Location | Purpose |
|------|----------|---------|
| Integration example | `examples/ai-pipeline-integration.ts` | End-to-end workflow example |
| Key generator | `scripts/generate-encryption-key.ts` | Generate encryption keys |

### 8. Specification Files

| File | Location | Purpose |
|------|----------|---------|
| Requirements | `.kiro/specs/medsutra-clinical-ai-assistant/requirements.md` | System requirements |
| Design | `.kiro/specs/medsutra-clinical-ai-assistant/design.md` | System design |
| Tasks | `.kiro/specs/medsutra-clinical-ai-assistant/tasks.md` | Implementation tasks |

---

## 🗂️ Files by Implementation Task

### Task 1: Project Setup ✅
- `package.json`
- `tsconfig.json`
- `.eslintrc.json`
- `.prettierrc`
- `Dockerfile`
- `docker-compose.yml`
- `.gitignore`
- `src/index.ts`
- `src/utils/logger.ts`
- `README.md`

### Task 2: Database Setup ✅
- `src/config/database.ts`
- `src/entities/*.ts` (all entity files)
- `src/migrations/1704000000000-InitialSchema.ts`
- `src/utils/database-init.ts`

### Task 3: Encryption & Security ✅
- `src/utils/encryption.ts`
- `src/utils/key-management.ts`
- `src/utils/encryption-errors.ts`
- `src/config/tls.ts`
- `scripts/generate-encryption-key.ts`
- `docs/ENCRYPTION.md`

### Task 6: Clinical LLM Integration ✅
- `src/services/llm/ClinicalLLM.ts`
- `src/services/llm/LLMCache.ts`
- `src/services/llm/LLMMonitor.ts`
- `src/services/llm/index.ts`
- `src/routes/llm.routes.ts`
- `docs/LLM_SERVICE.md`

### Task 7: RAG System ✅
- `src/services/rag/RAGSystem.ts`
- `src/services/rag/DocumentLoader.ts`
- `src/services/rag/index.ts`
- `src/routes/rag.routes.ts`

### Task 8: Explainability Engine ✅
- `src/services/explainability/ExplainabilityEngine.ts`
- `src/services/explainability/index.ts`
- `src/routes/explainability.routes.ts`

### Task 9: Guardrail System ✅
- `src/services/guardrails/GuardrailSystem.ts`
- `src/services/guardrails/index.ts`
- `src/routes/guardrails.routes.ts`

### Task 10: Medical Ontology ✅
- `src/services/ontology/MedicalOntology.ts`
- `src/services/ontology/index.ts`

### Task 11: Clinical Summarizer ✅
- `src/services/clinical/ClinicalSummarizer.ts`
- `src/services/clinical/index.ts`
- `src/routes/clinical.routes.ts`

### Task 12: Radiology Analyzer ✅
- `src/services/radiology/RadiologyAnalyzer.ts`
- `src/services/radiology/index.ts`
- `src/routes/radiology.routes.ts`

### Task 13: Vision Analyzer (Optional) ✅
- `src/services/vision/VisionAnalyzer.ts`
- `src/services/vision/index.ts`
- `src/routes/vision.routes.ts`

### Task 14: Documentation Assistant ✅
- `src/services/documentation/DocumentationAssistant.ts`
- `src/services/documentation/index.ts`
- `src/routes/documentation.routes.ts`

### Documentation Files ✅
- `docs/AI_SERVICES.md`
- `docs/CLINICAL_MODULES.md`
- `docs/ENCRYPTION.md`
- `docs/IMPLEMENTATION_SUMMARY.md`
- `docs/LLM_SERVICE.md`
- `docs/STORAGE_ARCHITECTURE.md`
- `docs/PROJECT_STRUCTURE.md`
- `examples/ai-pipeline-integration.ts`

---

## 📊 File Count Summary

| Category | Count | Location |
|----------|-------|----------|
| Service modules | 9 | `src/services/*/` |
| API routes | 8 | `src/routes/` |
| Database entities | 9 | `src/entities/` |
| Configuration files | 2 | `src/config/` |
| Utility files | 5 | `src/utils/` |
| Documentation files | 7 | `docs/` |
| Example files | 1 | `examples/` |
| Script files | 1 | `scripts/` |
| Migration files | 1 | `src/migrations/` |
| **Total TypeScript files** | **~60** | Various |

---

## 🔍 How to Find Files

### By Module Name
```bash
# Clinical Summarizer
src/services/clinical/
src/routes/clinical.routes.ts

# Radiology Analyzer
src/services/radiology/
src/routes/radiology.routes.ts

# Documentation Assistant
src/services/documentation/
src/routes/documentation.routes.ts

# Vision Analyzer
src/services/vision/
src/routes/vision.routes.ts
```

### By Functionality
```bash
# Database-related
src/config/database.ts
src/entities/
src/migrations/
src/utils/database-init.ts

# Security-related
src/utils/encryption.ts
src/utils/key-management.ts
src/config/tls.ts

# API-related
src/routes/
src/index.ts
```

### By Task Number
```bash
# Task 11 (Clinical Summarizer)
src/services/clinical/
src/routes/clinical.routes.ts

# Task 12 (Radiology Analyzer)
src/services/radiology/
src/routes/radiology.routes.ts

# Task 13 (Vision Analyzer)
src/services/vision/
src/routes/vision.routes.ts

# Task 14 (Documentation Assistant)
src/services/documentation/
src/routes/documentation.routes.ts
```

---

## 💾 Where Data is Stored

### Code Files (Git Repository)
All TypeScript source files are stored in the Git repository at the locations shown above.

### Runtime Data (See STORAGE_ARCHITECTURE.md)
- **PostgreSQL Database**: Patient data, documents, analyses, audit logs
- **In-Memory (Temporary)**: Caches, temporary processing data
- **File System**: Logs, uploaded files (if applicable)
- **Vector Database** (To be implemented): RAG document embeddings

---

## 🚀 Quick Navigation

- **Start here**: `src/index.ts` - Main application entry point
- **Add new route**: `src/routes/` - Create new route file
- **Add new service**: `src/services/` - Create new service folder
- **Add new entity**: `src/entities/` - Create new entity file
- **Configuration**: `src/config/` - Database, TLS configs
- **Documentation**: `docs/` - All documentation files
- **Examples**: `examples/` - Integration examples

---

## 📝 Notes

1. All TypeScript files are compiled to JavaScript in the `dist/` folder (not tracked in Git)
2. Node modules are installed in `node_modules/` (not tracked in Git)
3. Logs are written to `logs/` folder (not tracked in Git)
4. Environment variables are loaded from `.env` file (not tracked in Git, use `.env.example` as template)
5. Database files are stored in PostgreSQL (configured in `docker-compose.yml`)

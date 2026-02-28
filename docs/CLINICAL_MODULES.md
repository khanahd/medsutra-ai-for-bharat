# Clinical Modules Documentation

This document provides an overview of the core clinical analysis modules implemented in the MedSutra AI system.

## Overview

The MedSutra AI system includes four core clinical modules:
1. Clinical Summarizer - Document summarization and patient snapshot generation
2. Radiology Analyzer - Text-based radiology report analysis
3. Vision Analyzer (Optional) - Medical image analysis
4. Documentation Assistant - Automated clinical documentation drafting

---

## 1. Clinical Summarizer Module

### Purpose
Generate concise one-page patient snapshots from multiple clinical documents using NLP and entity extraction.

### Key Features
- **Document Types Supported**: EMR notes, lab reports, discharge summaries, referral notes, radiology text
- **Named Entity Recognition (NER)**: Extracts diseases, medications, dosages, lab values, procedures, symptoms
- **Entity Normalization**: Maps entities to SNOMED CT, ICD-10, and LOINC codes
- **Duplicate Detection**: Merges duplicate information from multiple documents
- **Length Constraint**: Ensures output ≤ 4000 characters (one page)
- **Performance**: Target <10 seconds response time

### API Endpoints

#### POST /api/clinical/summarize
Generate patient snapshot from clinical documents.

**Request:**
```json
{
  "patientId": "patient_123",
  "documents": [
    {
      "id": "doc_1",
      "type": "EMR_NOTE",
      "content": "Patient presents with...",
      "timestamp": "2024-01-15T10:00:00Z",
      "author": "Dr. Smith"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "snapshot": {
    "patientId": "patient_123",
    "generatedAt": "2024-01-15T10:05:00Z",
    "keyComplaints": ["chest pain", "shortness of breath"],
    "pastMedicalHistory": ["hypertension", "diabetes mellitus type 2"],
    "currentMedications": [
      {"name": "Metformin", "dosage": "500mg twice daily"}
    ],
    "abnormalFindings": ["elevated troponin", "ST elevation on ECG"],
    "pendingActions": ["cardiology consult", "repeat ECG in 6 hours"],
    "summary": "Brief clinical overview...",
    "sourceDocuments": ["doc_1"],
    "length": 2450
  }
}
```

#### POST /api/clinical/extract-entities
Extract medical entities from text.

#### POST /api/clinical/normalize-entity
Normalize entity to ontology codes.

#### POST /api/clinical/ambiguous-term
Handle ambiguous medical terms with multiple interpretations.

---

## 2. Radiology Analyzer Module

### Purpose
Analyze radiology reports for cancer-related suspicious findings using text-based detection and organ-specific scoring systems.

### Key Features
- **Suspicious Term Detection**: Identifies cancer-related terms (spiculated mass, ground-glass opacity, etc.)
- **Organ Detection**: Automatically detects organ (lung, breast, liver)
- **Organ-Specific Scoring**:
  - **Breast**: BI-RADS scoring (1-6)
  - **Liver**: LI-RADS scoring (LR-1 to LR-5, LR-M, LR-TIV)
  - **Lung**: Nodule characteristic analysis
- **Cancer Risk Flag**: Low/Medium/High risk assessment
- **Explainable Reasoning**: Provides clinical reasoning for risk assessment
- **Performance**: Target <5 seconds response time

### Suspicious Terms Database

**Lung:**
- spiculated mass, ground-glass opacity, nodule, cavitation
- pleural effusion, lymphadenopathy, consolidation, mass

**Breast:**
- spiculated mass, architectural distortion, microcalcifications
- irregular mass, suspicious calcifications, asymmetry, mass

**Liver:**
- arterial enhancement, washout, capsule, heterogeneous mass
- portal vein thrombosis, lesion, nodule, mass

**General:**
- malignant, suspicious, concerning, neoplasm, tumor
- metastasis, carcinoma, cancer, aggressive

### API Endpoints

#### POST /api/radiology/analyze
Analyze radiology report for cancer risk.

**Request:**
```json
{
  "id": "report_123",
  "patientId": "patient_123",
  "reportText": "CT chest shows 2.5 cm spiculated mass in right upper lobe...",
  "modality": "CT",
  "bodyPart": "Chest",
  "timestamp": "2024-01-15T10:00:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "analysis": {
    "reportId": "report_123",
    "patientId": "patient_123",
    "analyzedAt": "2024-01-15T10:00:05Z",
    "cancerRiskFlag": "High",
    "organ": "LUNG",
    "suspiciousTerms": [
      {
        "term": "spiculated mass",
        "startIndex": 25,
        "endIndex": 41,
        "category": "MASS",
        "severity": "HIGH"
      }
    ],
    "lungNoduleCharacteristics": {
      "size": "2.5 cm",
      "shape": "spiculated",
      "density": "solid",
      "location": "right upper lobe"
    },
    "reasoning": "The presence of a spiculated mass in the lung is highly suspicious for malignancy...",
    "recommendations": [
      "Urgent oncology referral recommended",
      "Consider biopsy for tissue diagnosis",
      "Consider PET-CT for further evaluation"
    ],
    "processingTime": 3200
  }
}
```

#### GET /api/radiology/risk-levels
Get available cancer risk levels and descriptions.

#### GET /api/radiology/organs
Get supported organ types and scoring systems.

---

## 3. Vision Analyzer Module (Optional)

### Purpose
Analyze medical images (CT/MRI) for suspicious regions using computer vision and deep learning models.

### Key Features
- **Image Types Supported**: CT, MRI, X-RAY, ULTRASOUND
- **Suspicious Region Detection**: Identifies regions of interest with bounding boxes
- **Explainable Heatmaps**: Generates Grad-CAM attention maps
- **Coordinate Validation**: Ensures bounding boxes are within image dimensions
- **Multimodal Fusion**: Combines image and text analysis for comprehensive assessment
- **Performance**: Target <30 seconds per scan
- **Optional Module**: Can be enabled/disabled via configuration

### Configuration

Set in `.env`:
```
VISION_ANALYZER_ENABLED=true
VISION_MODEL_PATH=./models/vision_model.pth
GPU_ENABLED=true
```

### API Endpoints

#### GET /api/vision/status
Check if Vision Analyzer is enabled.

**Response:**
```json
{
  "success": true,
  "enabled": true,
  "modelVersion": "1.0.0-placeholder",
  "message": "Vision Analyzer is enabled and ready"
}
```

#### POST /api/vision/analyze
Analyze medical image for suspicious regions.

**Request:**
```json
{
  "id": "image_123",
  "patientId": "patient_123",
  "type": "CT",
  "imageUrl": "https://example.com/images/scan.dcm",
  "metadata": {
    "modality": "CT",
    "bodyPart": "Chest",
    "studyDescription": "CT Chest with contrast",
    "imageWidth": 512,
    "imageHeight": 512
  },
  "timestamp": "2024-01-15T10:00:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "analysis": {
    "imageId": "image_123",
    "patientId": "patient_123",
    "analyzedAt": "2024-01-15T10:00:25Z",
    "suspiciousRegions": [
      {
        "id": "region_1",
        "coordinates": {
          "x": 150,
          "y": 200,
          "width": 50,
          "height": 50
        },
        "suspicionScore": 0.85,
        "characteristics": ["irregular border", "spiculated"],
        "category": "NODULE"
      }
    ],
    "heatmap": {
      "imageId": "image_123",
      "attentionMap": [[...]],
      "method": "GRAD_CAM",
      "width": 512,
      "height": 512
    },
    "overallSuspicionScore": 0.85,
    "confidence": 0.92,
    "processingTime": 24500,
    "modelVersion": "1.0.0-placeholder"
  }
}
```

#### POST /api/vision/multimodal-fusion
Fuse image and text analysis for comprehensive assessment.

**Request:**
```json
{
  "imageAnalysis": { /* ImageAnalysis object */ },
  "textAnalysis": { /* RadiologyAnalysis object */ }
}
```

**Response:**
```json
{
  "success": true,
  "assessment": {
    "imageAnalysis": { /* ... */ },
    "textAnalysis": { /* ... */ },
    "fusedRiskScore": 0.82,
    "fusedRiskLevel": "High",
    "reasoning": "Both image and text findings correlate...",
    "recommendations": [
      "Urgent multidisciplinary team review recommended",
      "Consider biopsy with image guidance"
    ]
  }
}
```

#### POST /api/vision/validate-coordinates
Validate bounding box coordinates are within image dimensions.

---

## 4. Documentation Assistant Module

### Purpose
Auto-draft clinical documents with clinician review and approval workflow.

### Key Features
- **Document Types**: OPD notes, discharge summaries, referral letters, insurance documentation
- **Structured Templates**: Pre-defined templates for each document type
- **Review Workflow**: Draft → Review → Edit → Approve
- **Section Editability**: All sections can be edited before approval
- **Approval Required**: Documents cannot be finalized without explicit approval
- **AI Disclaimer**: All outputs include "AI Suggestion – Final Decision by Clinician"
- **Performance**: Target <8 seconds response time

### Document Templates

#### OPD Note (SOAP Format)
- Patient Information
- Chief Complaint
- History of Present Illness
- Past Medical History
- Current Medications
- Physical Examination
- Assessment
- Plan

#### Discharge Summary (Narrative Format)
- Patient Information
- Admission Date / Discharge Date
- Admitting Diagnosis / Discharge Diagnosis
- Hospital Course
- Procedures Performed
- Discharge Medications
- Follow-up Instructions
- Discharge Condition

#### Referral Letter (Letter Format)
- Referring Physician
- Specialist
- Patient Information
- Reason for Referral
- Clinical Summary
- Investigations
- Current Treatment
- Specific Questions

#### Insurance Documentation (Structured Format)
- Patient Information (with policy number)
- Diagnosis (with ICD codes)
- Treatment Summary
- Procedures (with CPT codes)
- Medications
- Duration of Treatment
- Medical Necessity
- Prognosis

### API Endpoints

#### POST /api/documents/draft
Generate a document draft.

**Request:**
```json
{
  "patientId": "patient_123",
  "type": "OPD_NOTE",
  "snapshot": { /* PatientSnapshot object */ },
  "generatedBy": "dr_smith"
}
```

**Response:**
```json
{
  "success": true,
  "draft": {
    "id": "draft_123",
    "patientId": "patient_123",
    "type": "OPD_NOTE",
    "content": "Full formatted document...",
    "sections": [
      {
        "name": "Chief Complaint",
        "content": "Patient presents with chest pain...",
        "editable": true,
        "aiGenerated": true
      }
    ],
    "status": "DRAFT",
    "generatedAt": "2024-01-15T10:00:00Z",
    "generatedBy": "dr_smith"
  }
}
```

#### GET /api/documents/:id
Get a document draft by ID.

#### PUT /api/documents/:id/edit
Edit a section of a document draft.

**Request:**
```json
{
  "sectionName": "Chief Complaint",
  "newContent": "Updated content...",
  "editedBy": "dr_smith"
}
```

#### POST /api/documents/:id/review
Submit a document for review.

#### POST /api/documents/:id/approve
Approve a document draft.

**Request:**
```json
{
  "approvedBy": "dr_smith",
  "comments": "Reviewed and approved"
}
```

#### POST /api/documents/:id/reject
Reject a document draft.

**Request:**
```json
{
  "reviewerId": "dr_jones",
  "reason": "Incomplete medical history"
}
```

#### GET /api/documents/:id/workflow
Get workflow status for a document.

#### GET /api/documents/patient/:patientId
Get all drafts for a patient.

#### GET /api/documents/templates
Get available document templates.

#### GET /api/documents/statistics
Get documentation statistics.

---

## Integration Example

```typescript
import { ClinicalSummarizer } from './services/clinical';
import { RadiologyAnalyzer } from './services/radiology';
import { VisionAnalyzer } from './services/vision';
import { DocumentationAssistant } from './services/documentation';

// 1. Generate patient snapshot
const snapshot = await clinicalSummarizer.generateSummary(
  patientId,
  documents
);

// 2. Analyze radiology report
const radiologyAnalysis = await radiologyAnalyzer.analyzeReport(
  radiologyReport
);

// 3. Analyze medical image (optional)
if (visionAnalyzer.isEnabled()) {
  const imageAnalysis = await visionAnalyzer.analyzeImage(medicalImage);
  
  // 4. Fuse multimodal analysis
  const fusedAssessment = await visionAnalyzer.fuseMultimodal(
    imageAnalysis,
    radiologyAnalysis
  );
}

// 5. Generate clinical document
const draft = await documentationAssistant.draftDocument(
  patientId,
  'DISCHARGE_SUMMARY',
  snapshot,
  'dr_smith'
);

// 6. Edit and approve
await documentationAssistant.editSection(
  draft.id,
  'Hospital Course',
  updatedContent,
  'dr_smith'
);

await documentationAssistant.approveDocument(
  draft.id,
  'dr_smith',
  'Reviewed and approved'
);
```

---

## Performance Targets

| Module | Target Response Time | Actual Performance |
|--------|---------------------|-------------------|
| Clinical Summarizer | <10 seconds | Monitored per request |
| Radiology Analyzer | <5 seconds | Monitored per request |
| Vision Analyzer | <30 seconds | Monitored per request |
| Documentation Assistant | <8 seconds | Monitored per request |

---

## Error Handling

All modules implement comprehensive error handling:
- Input validation errors (400)
- Processing errors (500)
- Timeout errors
- Graceful degradation (Vision Analyzer fallback)
- Structured error logging

---

## Security and Compliance

- All AI outputs include disclaimer: "AI Suggestion – Final Decision by Clinician"
- No autonomous clinical decisions
- Explicit clinician approval required for all documents
- Guardrail validation for all generated content
- Audit logging for all operations
- HIPAA and DPDP Act compliance

---

## Future Enhancements

1. **Clinical Summarizer**:
   - Support for more document types
   - Improved entity extraction accuracy
   - Multi-language support

2. **Radiology Analyzer**:
   - Additional organ-specific scoring systems
   - Integration with PACS systems
   - Real-time analysis

3. **Vision Analyzer**:
   - Production-ready CNN/ViT models
   - DICOM image processing
   - GPU acceleration
   - 3D volume analysis

4. **Documentation Assistant**:
   - Custom template creation
   - Voice-to-text integration
   - Electronic signature support
   - EMR system integration

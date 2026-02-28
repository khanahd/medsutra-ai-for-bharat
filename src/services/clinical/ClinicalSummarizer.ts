import { ClinicalLLM } from '../llm/ClinicalLLM';
import { MedicalOntology } from '../ontology/MedicalOntology';
import { GuardrailSystem } from '../guardrails/GuardrailSystem';
import logger from '../../utils/logger';

export interface ClinicalDocument {
  id: string;
  type: 'EMR_NOTE' | 'LAB_REPORT' | 'DISCHARGE_SUMMARY' | 'REFERRAL' | 'RADIOLOGY_TEXT';
  content: string;
  timestamp: Date;
  author: string;
}

export interface MedicalEntity {
  text: string;
  type: 'DISEASE' | 'MEDICATION' | 'DOSAGE' | 'LAB_VALUE' | 'PROCEDURE' | 'SYMPTOM';
  startIndex: number;
  endIndex: number;
  confidence: number;
}

export interface NormalizedEntity extends MedicalEntity {
  snomedCode?: string;
  icd10Code?: string;
  loincCode?: string;
  normalizedTerm: string;
}

export interface PatientSnapshot {
  patientId: string;
  generatedAt: Date;
  keyComplaints: string[];
  pastMedicalHistory: string[];
  currentMedications: Array<{ name: string; dosage: string }>;
  abnormalFindings: string[];
  pendingActions: string[];
  summary: string;
  sourceDocuments: string[];
  length: number;
}

export class ClinicalSummarizer {
  private llm: ClinicalLLM;
  private ontology: MedicalOntology;
  private guardrails: GuardrailSystem;

  constructor(
    llm: ClinicalLLM,
    ontology: MedicalOntology,
    guardrails: GuardrailSystem
  ) {
    this.llm = llm;
    this.ontology = ontology;
    this.guardrails = guardrails;
  }

  async generateSummary(
    patientId: string,
    documents: ClinicalDocument[]
  ): Promise<PatientSnapshot> {
    const startTime = Date.now();
    
    try {
      logger.info(`Generating patient snapshot for patient ${patientId} from ${documents.length} documents`);

      // Extract entities from all documents
      const allEntities: MedicalEntity[] = [];
      for (const doc of documents) {
        const entities = await this.extractEntities(doc.content);
        allEntities.push(...entities);
      }

      // Normalize entities to ontology codes
      const normalizedEntities = await Promise.all(
        allEntities.map(entity => this.normalizeEntity(entity))
      );

      // Merge duplicates
      const uniqueEntities = this.mergeDuplicates(normalizedEntities);

      // Generate structured summary using LLM
      const snapshot = await this.generateStructuredSnapshot(
        patientId,
        documents,
        uniqueEntities
      );

      // Validate with guardrails
      const validation = await this.guardrails.validateDocument({
        content: snapshot.summary,
        sections: [
          ...snapshot.keyComplaints,
          ...snapshot.pastMedicalHistory,
          ...snapshot.abnormalFindings
        ]
      });

      if (validation.flaggedStatements.length > 0) {
        logger.warn(`Snapshot has ${validation.flaggedStatements.length} flagged statements`);
      }

      const duration = Date.now() - startTime;
      logger.info(`Patient snapshot generated in ${duration}ms`);

      if (duration > 10000) {
        logger.warn(`Snapshot generation exceeded 10 second target: ${duration}ms`);
      }

      return snapshot;
    } catch (error) {
      logger.error('Error generating patient snapshot:', error);
      throw new Error(`Failed to generate patient snapshot: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async extractEntities(text: string): Promise<MedicalEntity[]> {
    try {
      const prompt = `Extract medical entities from the following clinical text. Identify diseases, medications, dosages, lab values, procedures, and symptoms.

Clinical Text:
${text}

Return a JSON array of entities with the following structure:
[
  {
    "text": "entity text",
    "type": "DISEASE|MEDICATION|DOSAGE|LAB_VALUE|PROCEDURE|SYMPTOM",
    "startIndex": 0,
    "endIndex": 10,
    "confidence": 0.95
  }
]`;

      const response = await this.llm.generateText(prompt, {
        temperature: 0.1,
        maxTokens: 2000
      });

      // Parse JSON response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        logger.warn('No entities extracted from text');
        return [];
      }

      const entities = JSON.parse(jsonMatch[0]) as MedicalEntity[];
      return entities;
    } catch (error) {
      logger.error('Error extracting entities:', error);
      return [];
    }
  }

  async normalizeEntity(entity: MedicalEntity): Promise<NormalizedEntity> {
    try {
      const mappings = await this.ontology.mapEntity(entity.text, entity.type);

      return {
        ...entity,
        snomedCode: mappings.snomedCode,
        icd10Code: mappings.icd10Code,
        loincCode: mappings.loincCode,
        normalizedTerm: mappings.normalizedTerm || entity.text
      };
    } catch (error) {
      logger.error(`Error normalizing entity "${entity.text}":`, error);
      return {
        ...entity,
        normalizedTerm: entity.text
      };
    }
  }

  mergeDuplicates(entities: NormalizedEntity[]): NormalizedEntity[] {
    const entityMap = new Map<string, NormalizedEntity>();

    for (const entity of entities) {
      // Use normalized term + type as key
      const key = `${entity.normalizedTerm.toLowerCase()}_${entity.type}`;
      
      const existing = entityMap.get(key);
      if (!existing || entity.confidence > existing.confidence) {
        entityMap.set(key, entity);
      }
    }

    return Array.from(entityMap.values());
  }

  private async generateStructuredSnapshot(
    patientId: string,
    documents: ClinicalDocument[],
    entities: NormalizedEntity[]
  ): Promise<PatientSnapshot> {
    // Combine all document content
    const combinedContent = documents
      .map(doc => `[${doc.type}] ${doc.content}`)
      .join('\n\n');

    const prompt = `Generate a concise one-page patient snapshot from the following clinical documents. The snapshot must be under 4000 characters.

Clinical Documents:
${combinedContent}

Extracted Entities:
${JSON.stringify(entities.map(e => ({ text: e.normalizedTerm, type: e.type })), null, 2)}

Generate a structured patient snapshot with the following sections:
1. Key Complaints (chief complaints and presenting symptoms)
2. Past Medical History (chronic conditions, previous diagnoses)
3. Current Medications (with dosages)
4. Abnormal Findings (lab abnormalities, imaging findings)
5. Pending Actions (follow-ups, pending tests)
6. Summary (brief clinical overview)

Return as JSON:
{
  "keyComplaints": ["complaint1", "complaint2"],
  "pastMedicalHistory": ["condition1", "condition2"],
  "currentMedications": [{"name": "med1", "dosage": "dose1"}],
  "abnormalFindings": ["finding1", "finding2"],
  "pendingActions": ["action1", "action2"],
  "summary": "Brief clinical overview"
}`;

    const response = await this.llm.generateText(prompt, {
      temperature: 0.2,
      maxTokens: 2000
    });

    // Parse JSON response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse snapshot structure from LLM response');
    }

    const snapshotData = JSON.parse(jsonMatch[0]);

    // Construct full snapshot
    const snapshot: PatientSnapshot = {
      patientId,
      generatedAt: new Date(),
      keyComplaints: snapshotData.keyComplaints || [],
      pastMedicalHistory: snapshotData.pastMedicalHistory || [],
      currentMedications: snapshotData.currentMedications || [],
      abnormalFindings: snapshotData.abnormalFindings || [],
      pendingActions: snapshotData.pendingActions || [],
      summary: snapshotData.summary || '',
      sourceDocuments: documents.map(d => d.id),
      length: 0
    };

    // Calculate total length
    const fullText = this.formatSnapshotText(snapshot);
    snapshot.length = fullText.length;

    // Ensure length constraint
    if (snapshot.length > 4000) {
      logger.warn(`Snapshot exceeds 4000 characters (${snapshot.length}), truncating...`);
      snapshot.summary = snapshot.summary.substring(0, snapshot.summary.length - (snapshot.length - 4000));
      snapshot.length = this.formatSnapshotText(snapshot).length;
    }

    return snapshot;
  }

  private formatSnapshotText(snapshot: PatientSnapshot): string {
    return `
PATIENT SNAPSHOT
Generated: ${snapshot.generatedAt.toISOString()}

KEY COMPLAINTS:
${snapshot.keyComplaints.map(c => `- ${c}`).join('\n')}

PAST MEDICAL HISTORY:
${snapshot.pastMedicalHistory.map(h => `- ${h}`).join('\n')}

CURRENT MEDICATIONS:
${snapshot.currentMedications.map(m => `- ${m.name} ${m.dosage}`).join('\n')}

ABNORMAL FINDINGS:
${snapshot.abnormalFindings.map(f => `- ${f}`).join('\n')}

PENDING ACTIONS:
${snapshot.pendingActions.map(a => `- ${a}`).join('\n')}

SUMMARY:
${snapshot.summary}
    `.trim();
  }

  async handleAmbiguousTerm(
    term: string,
    context: string
  ): Promise<Array<{ interpretation: string; confidence: number }>> {
    try {
      const prompt = `The medical term "${term}" is ambiguous in the following context:

Context: ${context}

Provide possible interpretations of this term with confidence scores.

Return as JSON:
[
  {"interpretation": "interpretation1", "confidence": 0.8},
  {"interpretation": "interpretation2", "confidence": 0.6}
]`;

      const response = await this.llm.generateText(prompt, {
        temperature: 0.3,
        maxTokens: 500
      });

      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        return [{ interpretation: term, confidence: 0.5 }];
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      logger.error('Error handling ambiguous term:', error);
      return [{ interpretation: term, confidence: 0.5 }];
    }
  }
}

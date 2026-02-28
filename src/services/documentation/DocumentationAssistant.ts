import { ClinicalLLM } from '../llm/ClinicalLLM';
import { GuardrailSystem } from '../guardrails/GuardrailSystem';
import { PatientSnapshot } from '../clinical/ClinicalSummarizer';
import logger from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export type DocumentType = 'OPD_NOTE' | 'DISCHARGE_SUMMARY' | 'REFERRAL_LETTER' | 'INSURANCE_DOC';
export type DocumentStatus = 'DRAFT' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';
export type WorkflowStatus = 'PENDING' | 'EDITING' | 'APPROVED' | 'REJECTED';

export interface DocumentSection {
  name: string;
  content: string;
  editable: boolean;
  aiGenerated: boolean;
}

export interface DocumentDraft {
  id: string;
  patientId: string;
  type: DocumentType;
  content: string;
  sections: DocumentSection[];
  status: DocumentStatus;
  generatedAt: Date;
  generatedBy: string;
  approvedBy?: string;
  approvedAt?: Date;
}

export interface DocumentTemplate {
  type: DocumentType;
  sections: Array<{
    name: string;
    required: boolean;
    placeholder: string;
  }>;
  format: string;
}

export interface Edit {
  sectionName: string;
  originalContent: string;
  newContent: string;
  timestamp: Date;
  editedBy: string;
}

export interface ReviewWorkflow {
  draftId: string;
  reviewerId: string;
  status: WorkflowStatus;
  edits: Edit[];
  comments?: string;
  approvedAt?: Date;
}

export class DocumentationAssistant {
  private llm: ClinicalLLM;
  private guardrails: GuardrailSystem;
  private drafts: Map<string, DocumentDraft>;
  private workflows: Map<string, ReviewWorkflow>;

  constructor(llm: ClinicalLLM, guardrails: GuardrailSystem) {
    this.llm = llm;
    this.guardrails = guardrails;
    this.drafts = new Map();
    this.workflows = new Map();
  }

  async draftDocument(
    patientId: string,
    type: DocumentType,
    snapshot: PatientSnapshot,
    generatedBy: string
  ): Promise<DocumentDraft> {
    const startTime = Date.now();

    try {
      logger.info(`Drafting ${type} for patient ${patientId}`);

      // Get template for document type
      const template = this.getTemplate(type);

      // Populate template with patient data
      const sections = await this.populateTemplate(template, snapshot);

      // Generate full document content
      const content = this.formatDocument(type, sections);

      // Validate with guardrails
      const validation = await this.guardrails.validateDocument({
        content,
        sections: sections.map(s => s.content)
      });

      if (validation.flaggedStatements.length > 0) {
        logger.warn(`Document has ${validation.flaggedStatements.length} flagged statements`);
      }

      // Create draft
      const draft: DocumentDraft = {
        id: uuidv4(),
        patientId,
        type,
        content,
        sections,
        status: 'DRAFT',
        generatedAt: new Date(),
        generatedBy
      };

      // Store draft
      this.drafts.set(draft.id, draft);

      const duration = Date.now() - startTime;
      logger.info(`Document draft generated in ${duration}ms`);

      if (duration > 8000) {
        logger.warn(`Document generation exceeded 8 second target: ${duration}ms`);
      }

      return draft;
    } catch (error) {
      logger.error('Error drafting document:', error);
      throw new Error(`Failed to draft document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  getTemplate(type: DocumentType): DocumentTemplate {
    const templates: Record<DocumentType, DocumentTemplate> = {
      OPD_NOTE: {
        type: 'OPD_NOTE',
        sections: [
          { name: 'Patient Information', required: true, placeholder: 'Patient demographics and identifiers' },
          { name: 'Chief Complaint', required: true, placeholder: 'Primary reason for visit' },
          { name: 'History of Present Illness', required: true, placeholder: 'Detailed history of current condition' },
          { name: 'Past Medical History', required: true, placeholder: 'Previous medical conditions and surgeries' },
          { name: 'Current Medications', required: true, placeholder: 'List of current medications with dosages' },
          { name: 'Physical Examination', required: true, placeholder: 'Examination findings' },
          { name: 'Assessment', required: true, placeholder: 'Clinical assessment and diagnosis' },
          { name: 'Plan', required: true, placeholder: 'Treatment plan and follow-up' }
        ],
        format: 'SOAP'
      },
      DISCHARGE_SUMMARY: {
        type: 'DISCHARGE_SUMMARY',
        sections: [
          { name: 'Patient Information', required: true, placeholder: 'Patient demographics' },
          { name: 'Admission Date', required: true, placeholder: 'Date of admission' },
          { name: 'Discharge Date', required: true, placeholder: 'Date of discharge' },
          { name: 'Admitting Diagnosis', required: true, placeholder: 'Diagnosis at admission' },
          { name: 'Discharge Diagnosis', required: true, placeholder: 'Final diagnosis' },
          { name: 'Hospital Course', required: true, placeholder: 'Summary of hospital stay' },
          { name: 'Procedures Performed', required: false, placeholder: 'List of procedures' },
          { name: 'Discharge Medications', required: true, placeholder: 'Medications at discharge' },
          { name: 'Follow-up Instructions', required: true, placeholder: 'Follow-up care instructions' },
          { name: 'Discharge Condition', required: true, placeholder: 'Patient condition at discharge' }
        ],
        format: 'NARRATIVE'
      },
      REFERRAL_LETTER: {
        type: 'REFERRAL_LETTER',
        sections: [
          { name: 'Referring Physician', required: true, placeholder: 'Referring physician details' },
          { name: 'Specialist', required: true, placeholder: 'Specialist being referred to' },
          { name: 'Patient Information', required: true, placeholder: 'Patient demographics' },
          { name: 'Reason for Referral', required: true, placeholder: 'Primary reason for referral' },
          { name: 'Clinical Summary', required: true, placeholder: 'Relevant clinical information' },
          { name: 'Investigations', required: false, placeholder: 'Relevant test results' },
          { name: 'Current Treatment', required: true, placeholder: 'Current medications and treatment' },
          { name: 'Specific Questions', required: false, placeholder: 'Questions for specialist' }
        ],
        format: 'LETTER'
      },
      INSURANCE_DOC: {
        type: 'INSURANCE_DOC',
        sections: [
          { name: 'Patient Information', required: true, placeholder: 'Patient demographics and policy number' },
          { name: 'Diagnosis', required: true, placeholder: 'Primary and secondary diagnoses with ICD codes' },
          { name: 'Treatment Summary', required: true, placeholder: 'Summary of treatment provided' },
          { name: 'Procedures', required: true, placeholder: 'Procedures with CPT codes' },
          { name: 'Medications', required: true, placeholder: 'Medications prescribed' },
          { name: 'Duration of Treatment', required: true, placeholder: 'Treatment timeline' },
          { name: 'Medical Necessity', required: true, placeholder: 'Justification for treatment' },
          { name: 'Prognosis', required: true, placeholder: 'Expected outcome' }
        ],
        format: 'STRUCTURED'
      }
    };

    return templates[type];
  }

  private async populateTemplate(
    template: DocumentTemplate,
    snapshot: PatientSnapshot
  ): Promise<DocumentSection[]> {
    const sections: DocumentSection[] = [];

    for (const templateSection of template.sections) {
      const content = await this.generateSectionContent(
        template.type,
        templateSection.name,
        snapshot
      );

      sections.push({
        name: templateSection.name,
        content,
        editable: true,
        aiGenerated: true
      });
    }

    return sections;
  }

  private async generateSectionContent(
    documentType: DocumentType,
    sectionName: string,
    snapshot: PatientSnapshot
  ): Promise<string> {
    const prompt = `Generate the "${sectionName}" section for a ${documentType.replace('_', ' ')} using the following patient information:

Patient Snapshot:
- Key Complaints: ${snapshot.keyComplaints.join(', ')}
- Past Medical History: ${snapshot.pastMedicalHistory.join(', ')}
- Current Medications: ${snapshot.currentMedications.map(m => `${m.name} ${m.dosage}`).join(', ')}
- Abnormal Findings: ${snapshot.abnormalFindings.join(', ')}
- Pending Actions: ${snapshot.pendingActions.join(', ')}
- Summary: ${snapshot.summary}

Generate professional, concise content for the "${sectionName}" section. Include only relevant information from the patient snapshot.

IMPORTANT: Add the disclaimer "AI Suggestion – Final Decision by Clinician" at the end of the section.`;

    const content = await this.llm.generateText(prompt, {
      temperature: 0.3,
      maxTokens: 500
    });

    return content.trim();
  }

  private formatDocument(type: DocumentType, sections: DocumentSection[]): string {
    let formatted = `${type.replace('_', ' ')}\n`;
    formatted += `Generated: ${new Date().toISOString()}\n`;
    formatted += `\n${'='.repeat(60)}\n\n`;

    for (const section of sections) {
      formatted += `${section.name.toUpperCase()}\n`;
      formatted += `${'-'.repeat(section.name.length)}\n`;
      formatted += `${section.content}\n\n`;
    }

    formatted += `\n${'='.repeat(60)}\n`;
    formatted += `AI Suggestion – Final Decision by Clinician\n`;

    return formatted;
  }

  async editSection(
    draftId: string,
    sectionName: string,
    newContent: string,
    editedBy: string
  ): Promise<DocumentDraft> {
    const draft = this.drafts.get(draftId);
    if (!draft) {
      throw new Error(`Draft ${draftId} not found`);
    }

    if (draft.status === 'APPROVED') {
      throw new Error('Cannot edit approved document');
    }

    // Find and update section
    const section = draft.sections.find(s => s.name === sectionName);
    if (!section) {
      throw new Error(`Section "${sectionName}" not found`);
    }

    if (!section.editable) {
      throw new Error(`Section "${sectionName}" is not editable`);
    }

    const originalContent = section.content;
    section.content = newContent;
    section.aiGenerated = false;

    // Update full document content
    draft.content = this.formatDocument(draft.type, draft.sections);
    draft.status = 'UNDER_REVIEW';

    // Track edit in workflow
    const workflow = this.workflows.get(draftId);
    if (workflow) {
      workflow.edits.push({
        sectionName,
        originalContent,
        newContent,
        timestamp: new Date(),
        editedBy
      });
      workflow.status = 'EDITING';
    }

    logger.info(`Section "${sectionName}" edited in draft ${draftId}`);

    return draft;
  }

  async submitForReview(
    draftId: string,
    reviewerId: string
  ): Promise<ReviewWorkflow> {
    const draft = this.drafts.get(draftId);
    if (!draft) {
      throw new Error(`Draft ${draftId} not found`);
    }

    const workflow: ReviewWorkflow = {
      draftId,
      reviewerId,
      status: 'PENDING',
      edits: []
    };

    this.workflows.set(draftId, workflow);
    draft.status = 'UNDER_REVIEW';

    logger.info(`Draft ${draftId} submitted for review by ${reviewerId}`);

    return workflow;
  }

  async approveDocument(
    draftId: string,
    approvedBy: string,
    comments?: string
  ): Promise<DocumentDraft> {
    const draft = this.drafts.get(draftId);
    if (!draft) {
      throw new Error(`Draft ${draftId} not found`);
    }

    if (draft.status === 'APPROVED') {
      throw new Error('Document already approved');
    }

    // Validate all sections before approval
    const validation = await this.guardrails.validateDocument({
      content: draft.content,
      sections: draft.sections.map(s => s.content)
    });

    if (validation.hasUnverifiedFacts) {
      throw new Error('Cannot approve document with unverified facts');
    }

    draft.status = 'APPROVED';
    draft.approvedBy = approvedBy;
    draft.approvedAt = new Date();

    // Update workflow
    const workflow = this.workflows.get(draftId);
    if (workflow) {
      workflow.status = 'APPROVED';
      workflow.approvedAt = new Date();
      workflow.comments = comments;
    }

    logger.info(`Draft ${draftId} approved by ${approvedBy}`);

    return draft;
  }

  async rejectDocument(
    draftId: string,
    reviewerId: string,
    reason: string
  ): Promise<ReviewWorkflow> {
    const draft = this.drafts.get(draftId);
    if (!draft) {
      throw new Error(`Draft ${draftId} not found`);
    }

    draft.status = 'REJECTED';

    const workflow = this.workflows.get(draftId);
    if (workflow) {
      workflow.status = 'REJECTED';
      workflow.comments = reason;
    } else {
      const newWorkflow: ReviewWorkflow = {
        draftId,
        reviewerId,
        status: 'REJECTED',
        edits: [],
        comments: reason
      };
      this.workflows.set(draftId, newWorkflow);
      return newWorkflow;
    }

    logger.info(`Draft ${draftId} rejected by ${reviewerId}: ${reason}`);

    return workflow!;
  }

  getDraft(draftId: string): DocumentDraft | undefined {
    return this.drafts.get(draftId);
  }

  getWorkflow(draftId: string): ReviewWorkflow | undefined {
    return this.workflows.get(draftId);
  }

  getAllDrafts(patientId?: string): DocumentDraft[] {
    const allDrafts = Array.from(this.drafts.values());
    if (patientId) {
      return allDrafts.filter(d => d.patientId === patientId);
    }
    return allDrafts;
  }

  getStatistics(): {
    totalDrafts: number;
    byStatus: Record<DocumentStatus, number>;
    byType: Record<DocumentType, number>;
    averageGenerationTime: number;
  } {
    const drafts = Array.from(this.drafts.values());
    
    const byStatus: Record<DocumentStatus, number> = {
      DRAFT: 0,
      UNDER_REVIEW: 0,
      APPROVED: 0,
      REJECTED: 0
    };

    const byType: Record<DocumentType, number> = {
      OPD_NOTE: 0,
      DISCHARGE_SUMMARY: 0,
      REFERRAL_LETTER: 0,
      INSURANCE_DOC: 0
    };

    for (const draft of drafts) {
      byStatus[draft.status]++;
      byType[draft.type]++;
    }

    return {
      totalDrafts: drafts.length,
      byStatus,
      byType,
      averageGenerationTime: 0 // Would need to track this separately
    };
  }
}

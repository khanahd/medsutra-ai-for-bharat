import { ClinicalLLM } from '../llm/ClinicalLLM';
import { ExplainabilityEngine } from '../explainability/ExplainabilityEngine';
import { PatientSnapshot } from '../clinical/ClinicalSummarizer';
import { RadiologyAnalysis } from '../radiology/RadiologyAnalyzer';
import logger from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export type SuggestionType = 'ONCOLOGY_REFERRAL' | 'BIOPSY' | 'FOLLOW_UP_IMAGING' | 'LAB_TEST' | 'SPECIALIST_CONSULT';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type ClinicianAction = 'ACCEPT' | 'MODIFY' | 'REJECT' | 'PENDING';
export type Language = 'ENGLISH' | 'HINDI' | 'TAMIL' | 'TELUGU' | 'KANNADA' | 'MALAYALAM';

export interface WorkflowSuggestion {
  id: string;
  patientId: string;
  type: SuggestionType;
  priority: Priority;
  reasoning: string;
  evidence: string[];
  guidelineReference?: string;
  clinicianAction: ClinicianAction;
  createdAt: Date;
  respondedAt?: Date;
  respondedBy?: string;
  modificationNotes?: string;
}

export interface ReferralSuggestion {
  specialty: string;
  urgency: 'ROUTINE' | 'URGENT' | 'EMERGENCY';
  reason: string;
  supportingFindings: string[];
}

export interface PatientSummary {
  patientId: string;
  language: Language;
  summary: string;
  keyPoints: string[];
  nextSteps: string[];
  generatedAt: Date;
}

export class WorkflowEngine {
  private llm: ClinicalLLM;
  private explainability: ExplainabilityEngine;
  private suggestions: Map<string, WorkflowSuggestion>;

  constructor(llm: ClinicalLLM, explainability: ExplainabilityEngine) {
    this.llm = llm;
    this.explainability = explainability;
    this.suggestions = new Map();
  }

  async suggestNextSteps(
    patientId: string,
    snapshot: PatientSnapshot,
    radiologyAnalysis?: RadiologyAnalysis
  ): Promise<WorkflowSuggestion[]> {
    try {
      logger.info(`Generating workflow suggestions for patient ${patientId}`);

      const suggestions: WorkflowSuggestion[] = [];

      // Check for high-risk findings requiring oncology referral
      if (radiologyAnalysis && radiologyAnalysis.cancerRiskFlag === 'High') {
        const referralSuggestion = await this.generateOncologyReferral(
          patientId,
          snapshot,
          radiologyAnalysis
        );
        suggestions.push(referralSuggestion);
      }

      // Check for suspicious lesions requiring biopsy
      if (radiologyAnalysis && radiologyAnalysis.suspiciousTerms.length > 0) {
        const biopsySuggestion = await this.generateBiopsyRecommendation(
          patientId,
          snapshot,
          radiologyAnalysis
        );
        suggestions.push(biopsySuggestion);
      }

      // Check for follow-up imaging needs
      if (radiologyAnalysis && radiologyAnalysis.cancerRiskFlag === 'Medium') {
        const followUpSuggestion = await this.generateFollowUpImaging(
          patientId,
          snapshot,
          radiologyAnalysis
        );
        suggestions.push(followUpSuggestion);
      }

      // Check for abnormal findings requiring lab tests
      if (snapshot.abnormalFindings.length > 0) {
        const labSuggestion = await this.generateLabTestSuggestion(
          patientId,
          snapshot
        );
        if (labSuggestion) {
          suggestions.push(labSuggestion);
        }
      }

      // Store suggestions
      for (const suggestion of suggestions) {
        this.suggestions.set(suggestion.id, suggestion);
      }

      logger.info(`Generated ${suggestions.length} workflow suggestions for patient ${patientId}`);

      return suggestions;
    } catch (error) {
      logger.error('Error generating workflow suggestions:', error);
      throw new Error(`Failed to generate workflow suggestions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async generateOncologyReferral(
    patientId: string,
    snapshot: PatientSnapshot,
    radiologyAnalysis: RadiologyAnalysis
  ): Promise<WorkflowSuggestion> {
    const prompt = `Generate reasoning for an urgent oncology referral based on the following:

Patient Summary: ${snapshot.summary}
Radiology Risk: ${radiologyAnalysis.cancerRiskFlag}
Suspicious Findings: ${radiologyAnalysis.suspiciousTerms.map(t => t.term).join(', ')}
Radiology Reasoning: ${radiologyAnalysis.reasoning}

Provide a 2-3 sentence clinical reasoning for why this patient needs urgent oncology referral.`;

    const reasoning = await this.llm.generateText(prompt, {
      temperature: 0.2,
      maxTokens: 200
    });

    const evidence = [
      `Cancer Risk Flag: ${radiologyAnalysis.cancerRiskFlag}`,
      `Suspicious Terms: ${radiologyAnalysis.suspiciousTerms.map(t => t.term).join(', ')}`,
      ...radiologyAnalysis.recommendations
    ];

    return {
      id: uuidv4(),
      patientId,
      type: 'ONCOLOGY_REFERRAL',
      priority: 'URGENT',
      reasoning: reasoning.trim(),
      evidence,
      guidelineReference: 'NCCN Guidelines for Cancer Screening',
      clinicianAction: 'PENDING',
      createdAt: new Date()
    };
  }

  private async generateBiopsyRecommendation(
    patientId: string,
    snapshot: PatientSnapshot,
    radiologyAnalysis: RadiologyAnalysis
  ): Promise<WorkflowSuggestion> {
    const prompt = `Generate reasoning for a biopsy recommendation based on:

Suspicious Findings: ${radiologyAnalysis.suspiciousTerms.map(t => t.term).join(', ')}
Organ: ${radiologyAnalysis.organ}
Risk Level: ${radiologyAnalysis.cancerRiskFlag}

Provide a 2-3 sentence clinical reasoning for why biopsy is recommended.`;

    const reasoning = await this.llm.generateText(prompt, {
      temperature: 0.2,
      maxTokens: 200
    });

    const priority = radiologyAnalysis.cancerRiskFlag === 'High' ? 'URGENT' : 'HIGH';

    return {
      id: uuidv4(),
      patientId,
      type: 'BIOPSY',
      priority,
      reasoning: reasoning.trim(),
      evidence: [
        `Suspicious lesion detected in ${radiologyAnalysis.organ}`,
        ...radiologyAnalysis.suspiciousTerms.map(t => `${t.term} (${t.category})`)
      ],
      guidelineReference: 'ACR Appropriateness Criteria',
      clinicianAction: 'PENDING',
      createdAt: new Date()
    };
  }

  private async generateFollowUpImaging(
    patientId: string,
    snapshot: PatientSnapshot,
    radiologyAnalysis: RadiologyAnalysis
  ): Promise<WorkflowSuggestion> {
    const prompt = `Generate reasoning for follow-up imaging based on:

Risk Level: ${radiologyAnalysis.cancerRiskFlag}
Findings: ${radiologyAnalysis.suspiciousTerms.map(t => t.term).join(', ')}

Provide a 2-3 sentence clinical reasoning for follow-up imaging timeline.`;

    const reasoning = await this.llm.generateText(prompt, {
      temperature: 0.2,
      maxTokens: 200
    });

    return {
      id: uuidv4(),
      patientId,
      type: 'FOLLOW_UP_IMAGING',
      priority: 'MEDIUM',
      reasoning: reasoning.trim(),
      evidence: [
        `Medium risk findings require monitoring`,
        `Follow-up imaging recommended in 3-6 months`
      ],
      guidelineReference: 'Fleischner Society Guidelines',
      clinicianAction: 'PENDING',
      createdAt: new Date()
    };
  }

  private async generateLabTestSuggestion(
    patientId: string,
    snapshot: PatientSnapshot
  ): Promise<WorkflowSuggestion | null> {
    // Only suggest lab tests if there are relevant abnormal findings
    const relevantFindings = snapshot.abnormalFindings.filter(f =>
      f.toLowerCase().includes('elevated') ||
      f.toLowerCase().includes('abnormal') ||
      f.toLowerCase().includes('low') ||
      f.toLowerCase().includes('high')
    );

    if (relevantFindings.length === 0) {
      return null;
    }

    const prompt = `Generate reasoning for additional lab tests based on:

Abnormal Findings: ${relevantFindings.join(', ')}

Provide a 2-3 sentence clinical reasoning for recommended lab tests.`;

    const reasoning = await this.llm.generateText(prompt, {
      temperature: 0.2,
      maxTokens: 200
    });

    return {
      id: uuidv4(),
      patientId,
      type: 'LAB_TEST',
      priority: 'MEDIUM',
      reasoning: reasoning.trim(),
      evidence: relevantFindings,
      clinicianAction: 'PENDING',
      createdAt: new Date()
    };
  }

  async respondToSuggestion(
    suggestionId: string,
    action: ClinicianAction,
    respondedBy: string,
    modificationNotes?: string
  ): Promise<WorkflowSuggestion> {
    const suggestion = this.suggestions.get(suggestionId);
    if (!suggestion) {
      throw new Error(`Suggestion ${suggestionId} not found`);
    }

    suggestion.clinicianAction = action;
    suggestion.respondedAt = new Date();
    suggestion.respondedBy = respondedBy;
    suggestion.modificationNotes = modificationNotes;

    logger.info(`Clinician ${respondedBy} ${action} suggestion ${suggestionId}`);

    return suggestion;
  }

  async generatePatientSummary(
    patientId: string,
    snapshot: PatientSnapshot,
    language: Language = 'ENGLISH'
  ): Promise<PatientSummary> {
    try {
      logger.info(`Generating patient-friendly summary in ${language} for patient ${patientId}`);

      const prompt = `Generate a patient-friendly summary in ${language} from the following clinical information:

Key Complaints: ${snapshot.keyComplaints.join(', ')}
Medical History: ${snapshot.pastMedicalHistory.join(', ')}
Current Medications: ${snapshot.currentMedications.map(m => `${m.name} ${m.dosage}`).join(', ')}
Important Findings: ${snapshot.abnormalFindings.join(', ')}
Next Steps: ${snapshot.pendingActions.join(', ')}

Requirements:
1. Use simple, patient-friendly language
2. Translate medical jargon to layman terms
3. Keep it concise and easy to understand
4. Write in ${language}
5. Include key points and next steps

Format as:
Summary: [patient-friendly summary]
Key Points: [bullet points]
Next Steps: [what patient should do]`;

      const response = await this.llm.generateText(prompt, {
        temperature: 0.3,
        maxTokens: 500
      });

      // Parse response
      const summaryMatch = response.match(/Summary:(.*?)(?=Key Points:|$)/s);
      const keyPointsMatch = response.match(/Key Points:(.*?)(?=Next Steps:|$)/s);
      const nextStepsMatch = response.match(/Next Steps:(.*?)$/s);

      const summary = summaryMatch ? summaryMatch[1].trim() : response;
      const keyPoints = keyPointsMatch
        ? keyPointsMatch[1].trim().split('\n').filter(p => p.trim())
        : [];
      const nextSteps = nextStepsMatch
        ? nextStepsMatch[1].trim().split('\n').filter(s => s.trim())
        : [];

      return {
        patientId,
        language,
        summary,
        keyPoints,
        nextSteps,
        generatedAt: new Date()
      };
    } catch (error) {
      logger.error('Error generating patient summary:', error);
      throw new Error(`Failed to generate patient summary: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async translateToLayman(
    medicalText: string,
    language: Language = 'ENGLISH'
  ): Promise<string> {
    const prompt = `Translate the following medical text into simple, patient-friendly language in ${language}:

Medical Text: ${medicalText}

Requirements:
1. Use simple words that patients can understand
2. Avoid medical jargon
3. Keep the meaning accurate
4. Write in ${language}

Patient-friendly version:`;

    const translation = await this.llm.generateText(prompt, {
      temperature: 0.3,
      maxTokens: 300
    });

    return translation.trim();
  }

  async evaluateReferralNeed(
    findings: string[],
    specialty?: string
  ): Promise<ReferralSuggestion | null> {
    if (findings.length === 0) {
      return null;
    }

    const prompt = `Evaluate if a specialist referral is needed based on:

Findings: ${findings.join(', ')}
${specialty ? `Specialty: ${specialty}` : ''}

Determine:
1. Is referral needed? (yes/no)
2. Which specialty?
3. Urgency level (ROUTINE/URGENT/EMERGENCY)
4. Reason for referral

Return as JSON:
{
  "needed": true/false,
  "specialty": "specialty name",
  "urgency": "ROUTINE|URGENT|EMERGENCY",
  "reason": "brief reason"
}`;

    const response = await this.llm.generateText(prompt, {
      temperature: 0.2,
      maxTokens: 200
    });

    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return null;
      }

      const result = JSON.parse(jsonMatch[0]);

      if (!result.needed) {
        return null;
      }

      return {
        specialty: result.specialty,
        urgency: result.urgency,
        reason: result.reason,
        supportingFindings: findings
      };
    } catch (error) {
      logger.error('Error parsing referral evaluation:', error);
      return null;
    }
  }

  getSuggestion(suggestionId: string): WorkflowSuggestion | undefined {
    return this.suggestions.get(suggestionId);
  }

  getAllSuggestions(patientId?: string): WorkflowSuggestion[] {
    const allSuggestions = Array.from(this.suggestions.values());
    if (patientId) {
      return allSuggestions.filter(s => s.patientId === patientId);
    }
    return allSuggestions;
  }

  getStatistics(): {
    totalSuggestions: number;
    byType: Record<SuggestionType, number>;
    byPriority: Record<Priority, number>;
    byAction: Record<ClinicianAction, number>;
    acceptanceRate: number;
  } {
    const suggestions = Array.from(this.suggestions.values());

    const byType: Record<SuggestionType, number> = {
      ONCOLOGY_REFERRAL: 0,
      BIOPSY: 0,
      FOLLOW_UP_IMAGING: 0,
      LAB_TEST: 0,
      SPECIALIST_CONSULT: 0
    };

    const byPriority: Record<Priority, number> = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      URGENT: 0
    };

    const byAction: Record<ClinicianAction, number> = {
      ACCEPT: 0,
      MODIFY: 0,
      REJECT: 0,
      PENDING: 0
    };

    for (const suggestion of suggestions) {
      byType[suggestion.type]++;
      byPriority[suggestion.priority]++;
      byAction[suggestion.clinicianAction]++;
    }

    const responded = suggestions.filter(s => s.clinicianAction !== 'PENDING').length;
    const accepted = byAction.ACCEPT + byAction.MODIFY;
    const acceptanceRate = responded > 0 ? (accepted / responded) * 100 : 0;

    return {
      totalSuggestions: suggestions.length,
      byType,
      byPriority,
      byAction,
      acceptanceRate
    };
  }
}

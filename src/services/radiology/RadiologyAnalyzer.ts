import { ClinicalLLM } from '../llm/ClinicalLLM';
import { MedicalOntology } from '../ontology/MedicalOntology';
import { ExplainabilityEngine } from '../explainability/ExplainabilityEngine';
import logger from '../../utils/logger';

export type CancerRiskLevel = 'Low' | 'Medium' | 'High';
export type OrganType = 'LUNG' | 'BREAST' | 'LIVER' | 'OTHER';

export interface RadiologyReport {
  id: string;
  patientId: string;
  reportText: string;
  modality: string; // CT, MRI, X-RAY, ULTRASOUND, etc.
  bodyPart: string;
  timestamp: Date;
}

export interface SuspiciousTerm {
  term: string;
  startIndex: number;
  endIndex: number;
  category: 'MASS' | 'NODULE' | 'LESION' | 'OPACITY' | 'CALCIFICATION' | 'OTHER';
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface RadiologyAnalysis {
  reportId: string;
  patientId: string;
  analyzedAt: Date;
  cancerRiskFlag: CancerRiskLevel;
  organ: OrganType;
  suspiciousTerms: SuspiciousTerm[];
  biRadsScore?: number; // For breast lesions (1-6)
  liRadsScore?: string; // For liver lesions (LR-1 to LR-5, LR-M, LR-TIV)
  lungNoduleCharacteristics?: {
    size: string;
    shape: string;
    density: string;
    location: string;
  };
  reasoning: string;
  recommendations: string[];
  processingTime: number;
}

export class RadiologyAnalyzer {
  private llm: ClinicalLLM;
  private ontology: MedicalOntology;
  private explainability: ExplainabilityEngine;

  // Suspicious terms database
  private readonly suspiciousTerms = {
    LUNG: [
      'spiculated mass', 'ground-glass opacity', 'nodule', 'cavitation',
      'pleural effusion', 'lymphadenopathy', 'consolidation', 'mass'
    ],
    BREAST: [
      'spiculated mass', 'architectural distortion', 'microcalcifications',
      'irregular mass', 'suspicious calcifications', 'asymmetry', 'mass'
    ],
    LIVER: [
      'arterial enhancement', 'washout', 'capsule', 'heterogeneous mass',
      'portal vein thrombosis', 'lesion', 'nodule', 'mass'
    ],
    GENERAL: [
      'malignant', 'suspicious', 'concerning', 'neoplasm', 'tumor',
      'metastasis', 'carcinoma', 'cancer', 'aggressive'
    ]
  };

  constructor(
    llm: ClinicalLLM,
    ontology: MedicalOntology,
    explainability: ExplainabilityEngine
  ) {
    this.llm = llm;
    this.ontology = ontology;
    this.explainability = explainability;
  }

  async analyzeReport(report: RadiologyReport): Promise<RadiologyAnalysis> {
    const startTime = Date.now();

    try {
      logger.info(`Analyzing radiology report ${report.id} for patient ${report.patientId}`);

      // Detect organ
      const organ = this.detectOrgan(report.reportText, report.bodyPart);

      // Detect suspicious terms
      const suspiciousTerms = this.detectSuspiciousTerms(report.reportText, organ);

      // Perform organ-specific analysis
      let analysis: Partial<RadiologyAnalysis> = {
        reportId: report.id,
        patientId: report.patientId,
        analyzedAt: new Date(),
        organ,
        suspiciousTerms
      };

      if (organ === 'BREAST') {
        analysis = await this.analyzeBreastLesion(report, suspiciousTerms, analysis);
      } else if (organ === 'LIVER') {
        analysis = await this.analyzeLiverLesion(report, suspiciousTerms, analysis);
      } else if (organ === 'LUNG') {
        analysis = await this.analyzeLungNodule(report, suspiciousTerms, analysis);
      } else {
        analysis = await this.analyzeGeneral(report, suspiciousTerms, analysis);
      }

      // Generate reasoning
      analysis.reasoning = await this.generateReasoning(report, analysis as RadiologyAnalysis);

      // Generate recommendations
      analysis.recommendations = this.generateRecommendations(analysis as RadiologyAnalysis);

      const processingTime = Date.now() - startTime;
      analysis.processingTime = processingTime;

      logger.info(`Radiology analysis completed in ${processingTime}ms with risk: ${analysis.cancerRiskFlag}`);

      if (processingTime > 5000) {
        logger.warn(`Analysis exceeded 5 second target: ${processingTime}ms`);
      }

      return analysis as RadiologyAnalysis;
    } catch (error) {
      logger.error('Error analyzing radiology report:', error);
      throw new Error(`Failed to analyze radiology report: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private detectOrgan(reportText: string, bodyPart: string): OrganType {
    const text = (reportText + ' ' + bodyPart).toLowerCase();

    if (text.includes('lung') || text.includes('chest') || text.includes('thorax')) {
      return 'LUNG';
    } else if (text.includes('breast') || text.includes('mammogram')) {
      return 'BREAST';
    } else if (text.includes('liver') || text.includes('hepatic')) {
      return 'LIVER';
    }

    return 'OTHER';
  }

  private detectSuspiciousTerms(reportText: string, organ: OrganType): SuspiciousTerm[] {
    const terms: SuspiciousTerm[] = [];
    const lowerText = reportText.toLowerCase();

    // Get organ-specific and general terms
    const organTerms = organ !== 'OTHER' ? this.suspiciousTerms[organ] : [];
    const allTerms = [...organTerms, ...this.suspiciousTerms.GENERAL];

    for (const term of allTerms) {
      const index = lowerText.indexOf(term.toLowerCase());
      if (index !== -1) {
        terms.push({
          term,
          startIndex: index,
          endIndex: index + term.length,
          category: this.categorizeTerm(term),
          severity: this.assessTermSeverity(term)
        });
      }
    }

    return terms;
  }

  private categorizeTerm(term: string): SuspiciousTerm['category'] {
    const lower = term.toLowerCase();
    if (lower.includes('mass')) return 'MASS';
    if (lower.includes('nodule')) return 'NODULE';
    if (lower.includes('lesion')) return 'LESION';
    if (lower.includes('opacity')) return 'OPACITY';
    if (lower.includes('calcification')) return 'CALCIFICATION';
    return 'OTHER';
  }

  private assessTermSeverity(term: string): 'LOW' | 'MEDIUM' | 'HIGH' {
    const lower = term.toLowerCase();
    const highSeverity = ['malignant', 'cancer', 'carcinoma', 'metastasis', 'aggressive'];
    const mediumSeverity = ['suspicious', 'concerning', 'spiculated', 'irregular'];

    if (highSeverity.some(t => lower.includes(t))) return 'HIGH';
    if (mediumSeverity.some(t => lower.includes(t))) return 'MEDIUM';
    return 'LOW';
  }

  private async analyzeBreastLesion(
    report: RadiologyReport,
    suspiciousTerms: SuspiciousTerm[],
    analysis: Partial<RadiologyAnalysis>
  ): Promise<Partial<RadiologyAnalysis>> {
    // Calculate BI-RADS score using LLM
    const prompt = `Analyze the following breast imaging report and assign a BI-RADS score (1-6).

Report: ${report.reportText}

BI-RADS Categories:
1 - Negative
2 - Benign
3 - Probably benign
4 - Suspicious
5 - Highly suggestive of malignancy
6 - Known biopsy-proven malignancy

Return only the numeric score (1-6).`;

    const response = await this.llm.generateText(prompt, {
      temperature: 0.1,
      maxTokens: 10
    });

    const biRadsScore = parseInt(response.trim());
    analysis.biRadsScore = isNaN(biRadsScore) ? undefined : biRadsScore;

    // Determine cancer risk based on BI-RADS
    if (biRadsScore >= 5) {
      analysis.cancerRiskFlag = 'High';
    } else if (biRadsScore === 4) {
      analysis.cancerRiskFlag = 'Medium';
    } else {
      analysis.cancerRiskFlag = suspiciousTerms.length > 0 ? 'Low' : 'Low';
    }

    return analysis;
  }

  private async analyzeLiverLesion(
    report: RadiologyReport,
    suspiciousTerms: SuspiciousTerm[],
    analysis: Partial<RadiologyAnalysis>
  ): Promise<Partial<RadiologyAnalysis>> {
    // Calculate LI-RADS score using LLM
    const prompt = `Analyze the following liver imaging report and assign a LI-RADS score.

Report: ${report.reportText}

LI-RADS Categories:
LR-1 - Definitely benign
LR-2 - Probably benign
LR-3 - Intermediate probability of malignancy
LR-4 - Probably HCC
LR-5 - Definitely HCC
LR-M - Probably or definitely malignant but not HCC specific
LR-TIV - Tumor in vein

Return only the LI-RADS category (e.g., LR-3, LR-5).`;

    const response = await this.llm.generateText(prompt, {
      temperature: 0.1,
      maxTokens: 20
    });

    const liRadsScore = response.trim().toUpperCase();
    analysis.liRadsScore = liRadsScore.startsWith('LR-') ? liRadsScore : undefined;

    // Determine cancer risk based on LI-RADS
    if (liRadsScore === 'LR-5' || liRadsScore === 'LR-M' || liRadsScore === 'LR-TIV') {
      analysis.cancerRiskFlag = 'High';
    } else if (liRadsScore === 'LR-4') {
      analysis.cancerRiskFlag = 'Medium';
    } else {
      analysis.cancerRiskFlag = suspiciousTerms.length > 0 ? 'Low' : 'Low';
    }

    return analysis;
  }

  private async analyzeLungNodule(
    report: RadiologyReport,
    suspiciousTerms: SuspiciousTerm[],
    analysis: Partial<RadiologyAnalysis>
  ): Promise<Partial<RadiologyAnalysis>> {
    // Extract nodule characteristics using LLM
    const prompt = `Extract lung nodule characteristics from the following report:

Report: ${report.reportText}

Return as JSON:
{
  "size": "size in mm",
  "shape": "round/irregular/spiculated",
  "density": "solid/ground-glass/part-solid",
  "location": "anatomical location"
}`;

    const response = await this.llm.generateText(prompt, {
      temperature: 0.1,
      maxTokens: 200
    });

    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis.lungNoduleCharacteristics = JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      logger.warn('Failed to parse lung nodule characteristics');
    }

    // Determine cancer risk based on characteristics and suspicious terms
    const highRiskTerms = suspiciousTerms.filter(t => t.severity === 'HIGH');
    const mediumRiskTerms = suspiciousTerms.filter(t => t.severity === 'MEDIUM');

    if (highRiskTerms.length > 0) {
      analysis.cancerRiskFlag = 'High';
    } else if (mediumRiskTerms.length > 0 || suspiciousTerms.length >= 2) {
      analysis.cancerRiskFlag = 'Medium';
    } else {
      analysis.cancerRiskFlag = suspiciousTerms.length > 0 ? 'Low' : 'Low';
    }

    return analysis;
  }

  private async analyzeGeneral(
    report: RadiologyReport,
    suspiciousTerms: SuspiciousTerm[],
    analysis: Partial<RadiologyAnalysis>
  ): Promise<Partial<RadiologyAnalysis>> {
    // General risk assessment based on suspicious terms
    const highRiskTerms = suspiciousTerms.filter(t => t.severity === 'HIGH');
    const mediumRiskTerms = suspiciousTerms.filter(t => t.severity === 'MEDIUM');

    if (highRiskTerms.length > 0) {
      analysis.cancerRiskFlag = 'High';
    } else if (mediumRiskTerms.length > 0) {
      analysis.cancerRiskFlag = 'Medium';
    } else {
      analysis.cancerRiskFlag = suspiciousTerms.length > 0 ? 'Low' : 'Low';
    }

    return analysis;
  }

  private async generateReasoning(
    report: RadiologyReport,
    analysis: RadiologyAnalysis
  ): Promise<string> {
    const prompt = `Generate a brief clinical reasoning for the following radiology analysis:

Report: ${report.reportText}

Analysis:
- Risk Level: ${analysis.cancerRiskFlag}
- Organ: ${analysis.organ}
- Suspicious Terms: ${analysis.suspiciousTerms.map(t => t.term).join(', ')}
${analysis.biRadsScore ? `- BI-RADS Score: ${analysis.biRadsScore}` : ''}
${analysis.liRadsScore ? `- LI-RADS Score: ${analysis.liRadsScore}` : ''}

Provide a 2-3 sentence explanation for the risk assessment.`;

    const reasoning = await this.llm.generateText(prompt, {
      temperature: 0.2,
      maxTokens: 200
    });

    return reasoning.trim();
  }

  private generateRecommendations(analysis: RadiologyAnalysis): string[] {
    const recommendations: string[] = [];

    if (analysis.cancerRiskFlag === 'High') {
      recommendations.push('Urgent oncology referral recommended');
      recommendations.push('Consider biopsy for tissue diagnosis');
      recommendations.push('Multidisciplinary team discussion advised');
    } else if (analysis.cancerRiskFlag === 'Medium') {
      recommendations.push('Follow-up imaging in 3-6 months');
      recommendations.push('Consider specialist consultation');
      recommendations.push('Monitor for changes in size or characteristics');
    } else {
      recommendations.push('Routine follow-up as clinically indicated');
      recommendations.push('No immediate intervention required');
    }

    // Organ-specific recommendations
    if (analysis.organ === 'BREAST' && analysis.biRadsScore && analysis.biRadsScore >= 4) {
      recommendations.push('Breast biopsy recommended');
    }

    if (analysis.organ === 'LIVER' && analysis.liRadsScore === 'LR-5') {
      recommendations.push('Hepatocellular carcinoma treatment planning');
    }

    if (analysis.organ === 'LUNG' && analysis.suspiciousTerms.length > 0) {
      recommendations.push('Consider PET-CT for further evaluation');
    }

    return recommendations;
  }

  async handleNoFindings(report: RadiologyReport): Promise<RadiologyAnalysis> {
    return {
      reportId: report.id,
      patientId: report.patientId,
      analyzedAt: new Date(),
      cancerRiskFlag: 'Low',
      organ: this.detectOrgan(report.reportText, report.bodyPart),
      suspiciousTerms: [],
      reasoning: 'No suspicious findings detected in the radiology report.',
      recommendations: ['Routine follow-up as clinically indicated'],
      processingTime: 0
    };
  }
}

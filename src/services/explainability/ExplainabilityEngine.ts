import { clinicalLLM } from '../llm';
import { ragSystem, RAGDocument } from '../rag';
import { logger } from '../../utils/logger';

export interface Citation {
  source: string;
  relevantText: string;
  credibilityScore: number;
  url?: string;
}

export interface Explanation {
  suggestionId: string;
  reasoning: string;
  evidenceSources: Citation[];
  clinicalGuidelines: string[];
  confidenceLevel: number;
  generatedAt: Date;
}

export interface RiskExplanation {
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  contributingFactors: Factor[];
  clinicalSignificance: string;
  recommendedActions: string[];
}

export interface Factor {
  name: string;
  value: string;
  weight: number;
  description: string;
}

export interface DetailedReasoning {
  suggestionId: string;
  stepByStepAnalysis: string[];
  alternativeConsiderations: string[];
  limitations: string[];
  references: Citation[];
}

/**
 * Explainability Engine
 * Provides reasoning and evidence for all AI suggestions
 */
export class ExplainabilityEngine {
  /**
   * Explain a workflow suggestion
   */
  async explainSuggestion(
    suggestionId: string,
    suggestionType: string,
    reasoning: string,
    evidence: any[]
  ): Promise<Explanation> {
    try {
      logger.debug('Generating explanation', { suggestionId, suggestionType });

      // Get supporting documents from RAG
      const ragResult = await ragSystem.query({
        query: reasoning,
        topK: 3,
        filters: { minCredibility: 0.7 },
      });

      // Extract citations
      const evidenceSources: Citation[] = ragResult.documents.map((doc, idx) => ({
        source: `${doc.source}: ${doc.title}`,
        relevantText: this.extractRelevantText(doc.content, reasoning),
        credibilityScore: doc.credibility,
      }));

      // Extract clinical guidelines
      const clinicalGuidelines = ragResult.documents
        .filter((doc) => doc.source === 'CLINICAL_GUIDELINE')
        .map((doc) => doc.title);

      // Calculate confidence based on evidence quality
      const confidenceLevel = this.calculateConfidence(ragResult.documents, ragResult.relevanceScores);

      return {
        suggestionId,
        reasoning,
        evidenceSources,
        clinicalGuidelines,
        confidenceLevel,
        generatedAt: new Date(),
      };
    } catch (error) {
      logger.error('Failed to generate explanation', error);
      throw new Error('Failed to explain suggestion');
    }
  }

  /**
   * Cite sources for a medical statement
   */
  async citeSources(statement: string): Promise<Citation[]> {
    try {
      logger.debug('Finding citations', { statementLength: statement.length });

      const ragResult = await ragSystem.query({
        query: statement,
        topK: 5,
        filters: { minCredibility: 0.6 },
      });

      return ragResult.documents.map((doc, idx) => ({
        source: `${doc.source}: ${doc.title}`,
        relevantText: this.extractRelevantText(doc.content, statement),
        credibilityScore: doc.credibility,
      }));
    } catch (error) {
      logger.error('Failed to cite sources', error);
      return [];
    }
  }

  /**
   * Explain cancer risk flag
   */
  async explainRiskFlag(
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH',
    findings: any[]
  ): Promise<RiskExplanation> {
    try {
      logger.debug('Explaining risk flag', { riskLevel, findingsCount: findings.length });

      // Extract contributing factors
      const contributingFactors: Factor[] = findings.map((finding, idx) => ({
        name: finding.term || finding.name || `Finding ${idx + 1}`,
        value: finding.value || finding.description || 'Present',
        weight: finding.severity || 0.5,
        description: finding.description || '',
      }));

      // Generate clinical significance explanation
      const clinicalSignificance = await this.generateClinicalSignificance(riskLevel, findings);

      // Get recommended actions from guidelines
      const recommendedActions = await this.getRecommendedActions(riskLevel, findings);

      return {
        riskLevel,
        contributingFactors,
        clinicalSignificance,
        recommendedActions,
      };
    } catch (error) {
      logger.error('Failed to explain risk flag', error);
      throw new Error('Failed to explain risk flag');
    }
  }

  /**
   * Provide detailed reasoning for a suggestion
   */
  async provideDetailedReasoning(
    suggestionId: string,
    suggestionType: string,
    context: any
  ): Promise<DetailedReasoning> {
    try {
      logger.debug('Generating detailed reasoning', { suggestionId });

      // Generate step-by-step analysis using LLM
      const analysisPrompt = `Provide a step-by-step clinical reasoning for this ${suggestionType} suggestion. Context: ${JSON.stringify(context)}`;
      const analysis = await clinicalLLM.generateText(analysisPrompt);
      const stepByStepAnalysis = analysis.split('\n').filter((line) => line.trim());

      // Generate alternative considerations
      const alternativesPrompt = `What alternative diagnoses or approaches should be considered? Context: ${JSON.stringify(context)}`;
      const alternatives = await clinicalLLM.generateText(alternativesPrompt);
      const alternativeConsiderations = alternatives.split('\n').filter((line) => line.trim());

      // Identify limitations
      const limitations = [
        'AI-generated suggestion requires clinical validation',
        'Individual patient factors may not be fully captured',
        'Based on available data at time of analysis',
      ];

      // Get references
      const references = await this.citeSources(JSON.stringify(context));

      return {
        suggestionId,
        stepByStepAnalysis,
        alternativeConsiderations,
        limitations,
        references,
      };
    } catch (error) {
      logger.error('Failed to provide detailed reasoning', error);
      throw new Error('Failed to provide detailed reasoning');
    }
  }

  /**
   * Extract relevant text from document
   */
  private extractRelevantText(content: string, query: string, maxLength: number = 200): string {
    // Simple extraction - in production, use more sophisticated methods
    const sentences = content.split(/[.!?]+/);
    const queryTerms = query.toLowerCase().split(/\s+/);

    // Find sentence with most query terms
    let bestSentence = sentences[0] || '';
    let maxMatches = 0;

    for (const sentence of sentences) {
      const lowerSentence = sentence.toLowerCase();
      const matches = queryTerms.filter((term) => lowerSentence.includes(term)).length;

      if (matches > maxMatches) {
        maxMatches = matches;
        bestSentence = sentence;
      }
    }

    // Truncate if too long
    if (bestSentence.length > maxLength) {
      bestSentence = bestSentence.substring(0, maxLength) + '...';
    }

    return bestSentence.trim();
  }

  /**
   * Calculate confidence level based on evidence
   */
  private calculateConfidence(documents: RAGDocument[], relevanceScores: number[]): number {
    if (documents.length === 0) {
      return 0.3; // Low confidence without evidence
    }

    // Average of credibility and relevance
    const avgCredibility = documents.reduce((sum, doc) => sum + doc.credibility, 0) / documents.length;
    const avgRelevance = relevanceScores.reduce((sum, score) => sum + score, 0) / relevanceScores.length;

    return (avgCredibility + avgRelevance) / 2;
  }

  /**
   * Generate clinical significance explanation
   */
  private async generateClinicalSignificance(
    riskLevel: string,
    findings: any[]
  ): Promise<string> {
    const prompt = `Explain the clinical significance of ${riskLevel} risk with these findings: ${JSON.stringify(findings)}. Keep it concise and clinically relevant.`;

    try {
      return await clinicalLLM.generateText(prompt);
    } catch {
      // Fallback explanation
      return `${riskLevel} risk level indicates ${
        riskLevel === 'HIGH'
          ? 'urgent clinical attention required'
          : riskLevel === 'MEDIUM'
          ? 'close monitoring and follow-up recommended'
          : 'routine follow-up appropriate'
      }.`;
    }
  }

  /**
   * Get recommended actions from guidelines
   */
  private async getRecommendedActions(riskLevel: string, findings: any[]): Promise<string[]> {
    const actions: string[] = [];

    if (riskLevel === 'HIGH') {
      actions.push('Urgent oncology referral within 2 weeks');
      actions.push('Consider biopsy for tissue diagnosis');
      actions.push('Complete staging workup');
    } else if (riskLevel === 'MEDIUM') {
      actions.push('Oncology consultation recommended');
      actions.push('Follow-up imaging in 3-6 months');
      actions.push('Monitor for symptom progression');
    } else {
      actions.push('Routine follow-up as clinically indicated');
      actions.push('Patient education on warning signs');
    }

    return actions;
  }

  /**
   * Generate explanation summary
   */
  generateSummary(explanation: Explanation): string {
    return `
Suggestion: ${explanation.suggestionId}
Confidence: ${(explanation.confidenceLevel * 100).toFixed(0)}%

Reasoning:
${explanation.reasoning}

Evidence Sources (${explanation.evidenceSources.length}):
${explanation.evidenceSources.map((src, idx) => `${idx + 1}. ${src.source} (Credibility: ${(src.credibilityScore * 100).toFixed(0)}%)`).join('\n')}

Clinical Guidelines Referenced:
${explanation.clinicalGuidelines.length > 0 ? explanation.clinicalGuidelines.map((g, idx) => `${idx + 1}. ${g}`).join('\n') : 'None'}
    `.trim();
  }
}

// Singleton instance
export const explainabilityEngine = new ExplainabilityEngine();

import { ragSystem, RAGValidation } from '../rag';
import { logger } from '../../utils/logger';
import { AppDataSource } from '../../config/database';
import { FlaggedStatement } from '../../entities';

export interface ValidationResult {
  statement: string;
  isVerifiable: boolean;
  confidence: number;
  sources: string[];
  contradictions: Contradiction[];
  flagged: boolean;
  reason?: string;
}

export interface Contradiction {
  statement1: string;
  statement2: string;
  source1: string;
  source2: string;
  conflictType: 'DIRECT' | 'PARTIAL' | 'CONTEXTUAL';
}

export interface FlaggedItem {
  id: string;
  statement: string;
  reason: string;
  module: string;
  flaggedAt: Date;
  reviewed: boolean;
}

/**
 * Guardrail System
 * Validates AI outputs and prevents hallucinations
 */
export class GuardrailSystem {
  private readonly MIN_CONFIDENCE_THRESHOLD = 0.7;
  private readonly DISCLAIMER = 'AI Suggestion – Final Decision by Clinician';

  /**
   * Validate a medical statement
   */
  async validateStatement(statement: string, module: string = 'unknown'): Promise<ValidationResult> {
    try {
      logger.debug('Validating statement', { statementLength: statement.length, module });

      // Check against RAG system
      const ragValidation = await this.checkAgainstRAG(statement);

      // Detect contradictions
      const contradictions = await this.detectContradictions([statement]);

      // Determine if statement should be flagged
      const shouldFlag =
        !ragValidation.verified ||
        ragValidation.relevanceScore < this.MIN_CONFIDENCE_THRESHOLD ||
        contradictions.length > 0;

      // Flag if necessary
      if (shouldFlag) {
        await this.flagForReview(
          statement,
          this.determineReason(ragValidation, contradictions),
          module
        );
      }

      return {
        statement,
        isVerifiable: ragValidation.verified,
        confidence: ragValidation.relevanceScore,
        sources: ragValidation.supportingDocuments.map((doc) => doc.title),
        contradictions,
        flagged: shouldFlag,
        reason: shouldFlag ? this.determineReason(ragValidation, contradictions) : undefined,
      };
    } catch (error) {
      logger.error('Statement validation failed', error);
      
      // On error, flag for manual review
      await this.flagForReview(statement, 'Validation error - requires manual review', module);

      return {
        statement,
        isVerifiable: false,
        confidence: 0,
        sources: [],
        contradictions: [],
        flagged: true,
        reason: 'Validation error',
      };
    }
  }

  /**
   * Check statement against RAG system
   */
  async checkAgainstRAG(statement: string): Promise<RAGValidation> {
    try {
      return await ragSystem.validateStatement(statement);
    } catch (error) {
      logger.error('RAG validation failed', error);
      
      return {
        statement,
        supportingDocuments: [],
        relevanceScore: 0,
        verified: false,
      };
    }
  }

  /**
   * Detect contradictions in statements
   */
  async detectContradictions(statements: string[]): Promise<Contradiction[]> {
    const contradictions: Contradiction[] = [];

    try {
      // Simple contradiction detection - compare statements pairwise
      for (let i = 0; i < statements.length; i++) {
        for (let j = i + 1; j < statements.length; j++) {
          const contradiction = await this.checkPairForContradiction(
            statements[i],
            statements[j]
          );

          if (contradiction) {
            contradictions.push(contradiction);
          }
        }
      }

      if (contradictions.length > 0) {
        logger.warn('Contradictions detected', { count: contradictions.length });
      }

      return contradictions;
    } catch (error) {
      logger.error('Contradiction detection failed', error);
      return [];
    }
  }

  /**
   * Flag statement for review
   */
  async flagForReview(statement: string, reason: string, module: string): Promise<FlaggedItem> {
    try {
      const flaggedStatementRepo = AppDataSource.getRepository(FlaggedStatement);

      const flagged = flaggedStatementRepo.create({
        statement,
        reason,
        module,
        flaggedAt: new Date(),
        reviewed: false,
      });

      await flaggedStatementRepo.save(flagged);

      logger.warn('Statement flagged for review', {
        id: flagged.id,
        reason,
        module,
      });

      return {
        id: flagged.id,
        statement: flagged.statement,
        reason: flagged.reason,
        module: flagged.module,
        flaggedAt: flagged.flaggedAt,
        reviewed: flagged.reviewed,
      };
    } catch (error) {
      logger.error('Failed to flag statement', error);
      throw new Error('Failed to flag statement for review');
    }
  }

  /**
   * Get all flagged statements
   */
  async getFlaggedStatements(reviewedOnly: boolean = false): Promise<FlaggedItem[]> {
    try {
      const flaggedStatementRepo = AppDataSource.getRepository(FlaggedStatement);

      const query = flaggedStatementRepo.createQueryBuilder('flagged');

      if (reviewedOnly) {
        query.where('flagged.reviewed = :reviewed', { reviewed: true });
      }

      const flagged = await query.orderBy('flagged.flaggedAt', 'DESC').getMany();

      return flagged.map((f) => ({
        id: f.id,
        statement: f.statement,
        reason: f.reason,
        module: f.module,
        flaggedAt: f.flaggedAt,
        reviewed: f.reviewed,
      }));
    } catch (error) {
      logger.error('Failed to get flagged statements', error);
      return [];
    }
  }

  /**
   * Mark statement as reviewed
   */
  async markAsReviewed(id: string, reviewNotes: string): Promise<void> {
    try {
      const flaggedStatementRepo = AppDataSource.getRepository(FlaggedStatement);

      await flaggedStatementRepo.update(id, {
        reviewed: true,
        reviewNotes,
      });

      logger.info('Statement marked as reviewed', { id });
    } catch (error) {
      logger.error('Failed to mark statement as reviewed', error);
      throw new Error('Failed to update review status');
    }
  }

  /**
   * Add AI disclaimer to output
   */
  addDisclaimer(output: string): string {
    return `${this.DISCLAIMER}\n\n${output}`;
  }

  /**
   * Validate that output includes disclaimer
   */
  hasDisclaimer(output: string): boolean {
    return output.includes(this.DISCLAIMER);
  }

  /**
   * Prevent unvalidated facts in final documents
   */
  async validateDocument(content: string, module: string): Promise<{
    isValid: boolean;
    invalidStatements: string[];
    validationResults: ValidationResult[];
  }> {
    try {
      // Split content into sentences
      const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 10);

      const validationResults: ValidationResult[] = [];
      const invalidStatements: string[] = [];

      // Validate each sentence
      for (const sentence of sentences) {
        const result = await this.validateStatement(sentence.trim(), module);
        validationResults.push(result);

        if (result.flagged) {
          invalidStatements.push(sentence.trim());
        }
      }

      const isValid = invalidStatements.length === 0;

      if (!isValid) {
        logger.warn('Document contains unvalidated statements', {
          module,
          count: invalidStatements.length,
        });
      }

      return {
        isValid,
        invalidStatements,
        validationResults,
      };
    } catch (error) {
      logger.error('Document validation failed', error);
      
      return {
        isValid: false,
        invalidStatements: [],
        validationResults: [],
      };
    }
  }

  /**
   * Check pair of statements for contradiction
   */
  private async checkPairForContradiction(
    statement1: string,
    statement2: string
  ): Promise<Contradiction | null> {
    // Simple keyword-based contradiction detection
    // In production, use more sophisticated NLP methods

    const negationWords = ['not', 'no', 'never', 'without', 'absent'];
    const s1Lower = statement1.toLowerCase();
    const s2Lower = statement2.toLowerCase();

    // Check if one statement negates the other
    const s1HasNegation = negationWords.some((word) => s1Lower.includes(word));
    const s2HasNegation = negationWords.some((word) => s2Lower.includes(word));

    // If one has negation and they share keywords, might be contradiction
    if (s1HasNegation !== s2HasNegation) {
      const s1Words = new Set(s1Lower.split(/\s+/));
      const s2Words = new Set(s2Lower.split(/\s+/));
      const commonWords = [...s1Words].filter((word) => s2Words.has(word));

      if (commonWords.length > 3) {
        return {
          statement1,
          statement2,
          source1: 'AI Generated',
          source2: 'AI Generated',
          conflictType: 'PARTIAL',
        };
      }
    }

    return null;
  }

  /**
   * Determine reason for flagging
   */
  private determineReason(validation: RAGValidation, contradictions: Contradiction[]): string {
    const reasons: string[] = [];

    if (!validation.verified) {
      reasons.push('Unverifiable against approved sources');
    }

    if (validation.relevanceScore < this.MIN_CONFIDENCE_THRESHOLD) {
      reasons.push(`Low confidence score (${(validation.relevanceScore * 100).toFixed(0)}%)`);
    }

    if (contradictions.length > 0) {
      reasons.push(`${contradictions.length} contradiction(s) detected`);
    }

    return reasons.join('; ');
  }

  /**
   * Get guardrail statistics
   */
  async getStats(): Promise<{
    totalFlagged: number;
    pendingReview: number;
    reviewed: number;
    flaggedByModule: Record<string, number>;
  }> {
    try {
      const flaggedStatementRepo = AppDataSource.getRepository(FlaggedStatement);

      const total = await flaggedStatementRepo.count();
      const pending = await flaggedStatementRepo.count({ where: { reviewed: false } });
      const reviewed = await flaggedStatementRepo.count({ where: { reviewed: true } });

      const byModule = await flaggedStatementRepo
        .createQueryBuilder('flagged')
        .select('flagged.module', 'module')
        .addSelect('COUNT(*)', 'count')
        .groupBy('flagged.module')
        .getRawMany();

      const flaggedByModule: Record<string, number> = {};
      for (const item of byModule) {
        flaggedByModule[item.module] = parseInt(item.count);
      }

      return {
        totalFlagged: total,
        pendingReview: pending,
        reviewed,
        flaggedByModule,
      };
    } catch (error) {
      logger.error('Failed to get guardrail stats', error);
      
      return {
        totalFlagged: 0,
        pendingReview: 0,
        reviewed: 0,
        flaggedByModule: {},
      };
    }
  }
}

// Singleton instance
export const guardrailSystem = new GuardrailSystem();

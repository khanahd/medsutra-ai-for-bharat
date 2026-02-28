import { AppDataSource } from '../../config/database';
import { AuditRecord } from '../../entities/AuditRecord';
import { WorkflowSuggestion } from '../../entities/WorkflowSuggestion';
import { DocumentDraft } from '../../entities/DocumentDraft';
import logger from '../../utils/logger';

export interface QualityMetrics {
  period: {
    startDate: Date;
    endDate: Date;
  };
  aiSuggestions: {
    total: number;
    accepted: number;
    modified: number;
    rejected: number;
    acceptanceRate: number;
    modificationRate: number;
    rejectionRate: number;
  };
  timeSavings: {
    byDocumentType: Record<string, { count: number; avgTimeSaved: number }>;
    totalTimeSaved: number;
  };
  flaggedCases: {
    total: number;
    cases: Array<{
      patientId: string;
      aiSuggestion: string;
      clinicianResponse: string;
      timestamp: Date;
      divergenceReason?: string;
    }>;
  };
  userActivity: {
    totalUsers: number;
    activeUsers: number;
    byRole: Record<string, number>;
  };
}

export class QualityMonitor {
  private auditRepository = AppDataSource.getRepository(AuditRecord);
  private workflowRepository = AppDataSource.getRepository(WorkflowSuggestion);
  private documentRepository = AppDataSource.getRepository(DocumentDraft);

  /**
   * Generate monthly quality report
   */
  async generateMonthlyReport(year: number, month: number): Promise<QualityMetrics> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    return this.generateReport(startDate, endDate);
  }

  /**
   * Generate quality report for a date range
   */
  async generateReport(startDate: Date, endDate: Date): Promise<QualityMetrics> {
    logger.info(`Generating quality report from ${startDate} to ${endDate}`);

    // Get AI suggestions and clinician responses
    const suggestions = await this.auditRepository
      .createQueryBuilder('audit')
      .where('audit.timestamp >= :startDate', { startDate })
      .andWhere('audit.timestamp <= :endDate', { endDate })
      .andWhere('audit.event_type IN (:...types)', {
        types: ['AI_SUGGESTION', 'CLINICIAN_DECISION']
      })
      .getMany();

    // Calculate AI suggestion metrics
    const aiMetrics = this.calculateAISuggestionMetrics(suggestions);

    // Calculate time savings
    const timeSavings = await this.calculateTimeSavings(startDate, endDate);

    // Identify flagged cases (AI vs clinician divergence)
    const flaggedCases = this.identifyFlaggedCases(suggestions);

    // Calculate user activity
    const userActivity = await this.calculateUserActivity(startDate, endDate);

    return {
      period: { startDate, endDate },
      aiSuggestions: aiMetrics,
      timeSavings,
      flaggedCases,
      userActivity
    };
  }

  /**
   * Track time savings for a document
   */
  async trackTimeSavings(
    documentType: string,
    timeSavedMinutes: number,
    userId: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    // Store in document metadata or separate tracking table
    logger.info(
      `Time savings tracked: ${timeSavedMinutes} minutes for ${documentType} by user ${userId}`
    );
  }

  /**
   * Get flagged cases for review
   */
  async getFlaggedCasesForReview(
    startDate?: Date,
    endDate?: Date,
    limit: number = 50
  ): Promise<Array<{
    id: string;
    patientId: string;
    aiSuggestion: string;
    clinicianResponse: string;
    timestamp: Date;
    userId: string;
    metadata?: Record<string, any>;
  }>> {
    const queryBuilder = this.auditRepository
      .createQueryBuilder('audit')
      .where('audit.event_type = :type', { type: 'CLINICIAN_DECISION' })
      .andWhere('audit.clinician_response = :response', { response: 'REJECTED' });

    if (startDate) {
      queryBuilder.andWhere('audit.timestamp >= :startDate', { startDate });
    }

    if (endDate) {
      queryBuilder.andWhere('audit.timestamp <= :endDate', { endDate });
    }

    const records = await queryBuilder
      .orderBy('audit.timestamp', 'DESC')
      .limit(limit)
      .getMany();

    return records.map((record) => ({
      id: record.id,
      patientId: record.patientId || 'unknown',
      aiSuggestion: record.aiSuggestion || '',
      clinicianResponse: record.clinicianResponse || '',
      timestamp: record.timestamp,
      userId: record.userId,
      metadata: record.metadata
    }));
  }

  /**
   * Calculate AI suggestion metrics
   */
  private calculateAISuggestionMetrics(suggestions: AuditRecord[]): QualityMetrics['aiSuggestions'] {
    const decisions = suggestions.filter((s) => s.eventType === 'CLINICIAN_DECISION');

    const total = decisions.length;
    const accepted = decisions.filter((s) => s.clinicianResponse === 'ACCEPTED').length;
    const modified = decisions.filter((s) => s.clinicianResponse === 'MODIFIED').length;
    const rejected = decisions.filter((s) => s.clinicianResponse === 'REJECTED').length;

    return {
      total,
      accepted,
      modified,
      rejected,
      acceptanceRate: total > 0 ? (accepted / total) * 100 : 0,
      modificationRate: total > 0 ? (modified / total) * 100 : 0,
      rejectionRate: total > 0 ? (rejected / total) * 100 : 0
    };
  }

  /**
   * Calculate time savings
   */
  private async calculateTimeSavings(
    startDate: Date,
    endDate: Date
  ): Promise<QualityMetrics['timeSavings']> {
    // Get documents created in the period
    const documents = await this.documentRepository
      .createQueryBuilder('doc')
      .where('doc.created_at >= :startDate', { startDate })
      .andWhere('doc.created_at <= :endDate', { endDate })
      .getMany();

    // Estimate time savings based on document type
    const timeSavingsByType: Record<string, { count: number; avgTimeSaved: number }> = {
      opd_note: { count: 0, avgTimeSaved: 10 },
      discharge_summary: { count: 0, avgTimeSaved: 20 },
      referral_letter: { count: 0, avgTimeSaved: 15 },
      insurance_doc: { count: 0, avgTimeSaved: 25 }
    };

    documents.forEach((doc) => {
      const type = doc.documentType;
      if (timeSavingsByType[type]) {
        timeSavingsByType[type].count += 1;
      }
    });

    const totalTimeSaved = Object.values(timeSavingsByType).reduce(
      (sum, item) => sum + item.count * item.avgTimeSaved,
      0
    );

    return {
      byDocumentType: timeSavingsByType,
      totalTimeSaved
    };
  }

  /**
   * Identify flagged cases (AI vs clinician divergence)
   */
  private identifyFlaggedCases(suggestions: AuditRecord[]): QualityMetrics['flaggedCases'] {
    const flagged = suggestions.filter(
      (s) => s.eventType === 'CLINICIAN_DECISION' && s.clinicianResponse === 'REJECTED'
    );

    return {
      total: flagged.length,
      cases: flagged.slice(0, 20).map((record) => ({
        patientId: record.patientId || 'unknown',
        aiSuggestion: record.aiSuggestion || '',
        clinicianResponse: record.clinicianResponse || '',
        timestamp: record.timestamp,
        divergenceReason: record.metadata?.divergenceReason
      }))
    };
  }

  /**
   * Calculate user activity
   */
  private async calculateUserActivity(
    startDate: Date,
    endDate: Date
  ): Promise<QualityMetrics['userActivity']> {
    const activities = await this.auditRepository
      .createQueryBuilder('audit')
      .select('DISTINCT audit.user_id', 'userId')
      .addSelect('COUNT(*)', 'activityCount')
      .where('audit.timestamp >= :startDate', { startDate })
      .andWhere('audit.timestamp <= :endDate', { endDate })
      .groupBy('audit.user_id')
      .getRawMany();

    return {
      totalUsers: activities.length,
      activeUsers: activities.filter((a) => parseInt(a.activityCount) > 10).length,
      byRole: {} // Would need to join with users table to get roles
    };
  }
}

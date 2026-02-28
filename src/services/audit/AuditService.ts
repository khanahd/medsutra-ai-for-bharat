import { AppDataSource } from '../../config/database';
import { AuditRecord } from '../../entities/AuditRecord';
import { AccessLog } from '../../entities/AccessLog';
import logger from '../../utils/logger';

export type AuditEventType = 'AI_SUGGESTION' | 'CLINICIAN_DECISION' | 'DOCUMENT_APPROVAL' | 'DATA_ACCESS';
export type ClinicianResponse = 'ACCEPTED' | 'MODIFIED' | 'REJECTED';

export interface AuditLogEntry {
  eventType: AuditEventType;
  userId: string;
  patientId?: string;
  aiSuggestion?: string;
  clinicianResponse?: ClinicianResponse;
  metadata?: Record<string, any>;
}

export interface AccessLogEntry {
  userId: string;
  patientId: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  metadata?: Record<string, any>;
}

export interface AuditQueryOptions {
  userId?: string;
  patientId?: string;
  eventType?: AuditEventType;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export class AuditService {
  private auditRepository = AppDataSource.getRepository(AuditRecord);
  private accessLogRepository = AppDataSource.getRepository(AccessLog);
  private logQueue: AuditLogEntry[] = [];
  private accessQueue: AccessLogEntry[] = [];
  private isProcessing = false;

  constructor() {
    // Process queues every 5 seconds
    setInterval(() => this.processQueues(), 5000);
  }

  /**
   * Log an audit event
   * Queues the log entry for batch processing
   */
  async logAuditEvent(entry: AuditLogEntry): Promise<void> {
    try {
      // Add to queue
      this.logQueue.push(entry);

      // If queue is large, process immediately
      if (this.logQueue.length >= 10) {
        await this.processQueues();
      }
    } catch (error) {
      logger.error('Failed to queue audit log:', error);
      // Don't throw - audit logging should not break the application
    }
  }

  /**
   * Log AI suggestion
   */
  async logAISuggestion(
    userId: string,
    patientId: string,
    suggestion: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.logAuditEvent({
      eventType: 'AI_SUGGESTION',
      userId,
      patientId,
      aiSuggestion: suggestion,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Log clinician decision
   */
  async logClinicianDecision(
    userId: string,
    patientId: string,
    response: ClinicianResponse,
    aiSuggestion?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.logAuditEvent({
      eventType: 'CLINICIAN_DECISION',
      userId,
      patientId,
      aiSuggestion,
      clinicianResponse: response,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Log document approval
   */
  async logDocumentApproval(
    userId: string,
    patientId: string,
    documentId: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.logAuditEvent({
      eventType: 'DOCUMENT_APPROVAL',
      userId,
      patientId,
      metadata: {
        ...metadata,
        documentId,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Log data access attempt
   */
  async logDataAccess(entry: AccessLogEntry): Promise<void> {
    try {
      // Add to queue
      this.accessQueue.push(entry);

      // If queue is large, process immediately
      if (this.accessQueue.length >= 10) {
        await this.processQueues();
      }
    } catch (error) {
      logger.error('Failed to queue access log:', error);
    }
  }

  /**
   * Log patient data access
   */
  async logPatientAccess(
    userId: string,
    patientId: string,
    action: string,
    ipAddress?: string,
    userAgent?: string,
    success: boolean = true,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.logDataAccess({
      userId,
      patientId,
      action,
      resourceType: 'patient',
      ipAddress,
      userAgent,
      success,
      metadata
    });

    // Also log as audit event
    await this.logAuditEvent({
      eventType: 'DATA_ACCESS',
      userId,
      patientId,
      metadata: {
        action,
        resourceType: 'patient',
        success,
        ipAddress,
        userAgent,
        ...metadata
      }
    });
  }

  /**
   * Query audit logs
   */
  async queryAuditLogs(options: AuditQueryOptions): Promise<{
    logs: AuditRecord[];
    total: number;
  }> {
    const queryBuilder = this.auditRepository.createQueryBuilder('audit');

    // Apply filters
    if (options.userId) {
      queryBuilder.andWhere('audit.user_id = :userId', { userId: options.userId });
    }

    if (options.patientId) {
      queryBuilder.andWhere('audit.patient_id = :patientId', { patientId: options.patientId });
    }

    if (options.eventType) {
      queryBuilder.andWhere('audit.event_type = :eventType', { eventType: options.eventType });
    }

    if (options.startDate) {
      queryBuilder.andWhere('audit.timestamp >= :startDate', { startDate: options.startDate });
    }

    if (options.endDate) {
      queryBuilder.andWhere('audit.timestamp <= :endDate', { endDate: options.endDate });
    }

    // Get total count
    const total = await queryBuilder.getCount();

    // Apply pagination
    queryBuilder
      .orderBy('audit.timestamp', 'DESC')
      .skip(options.offset || 0)
      .take(options.limit || 50);

    const logs = await queryBuilder.getMany();

    return { logs, total };
  }

  /**
   * Query access logs
   */
  async queryAccessLogs(
    userId?: string,
    patientId?: string,
    startDate?: Date,
    endDate?: Date,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ logs: AccessLog[]; total: number }> {
    const queryBuilder = this.accessLogRepository.createQueryBuilder('access');

    if (userId) {
      queryBuilder.andWhere('access.user_id = :userId', { userId });
    }

    if (patientId) {
      queryBuilder.andWhere('access.patient_id = :patientId', { patientId });
    }

    if (startDate) {
      queryBuilder.andWhere('access.timestamp >= :startDate', { startDate });
    }

    if (endDate) {
      queryBuilder.andWhere('access.timestamp <= :endDate', { endDate });
    }

    const total = await queryBuilder.getCount();

    queryBuilder
      .orderBy('access.timestamp', 'DESC')
      .skip(offset)
      .take(limit);

    const logs = await queryBuilder.getMany();

    return { logs, total };
  }

  /**
   * Get audit statistics
   */
  async getAuditStatistics(
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalEvents: number;
    eventsByType: Record<string, number>;
    clinicianResponses: Record<string, number>;
  }> {
    const queryBuilder = this.auditRepository.createQueryBuilder('audit');

    if (startDate) {
      queryBuilder.andWhere('audit.timestamp >= :startDate', { startDate });
    }

    if (endDate) {
      queryBuilder.andWhere('audit.timestamp <= :endDate', { endDate });
    }

    const logs = await queryBuilder.getMany();

    const eventsByType: Record<string, number> = {};
    const clinicianResponses: Record<string, number> = {};

    logs.forEach((log) => {
      // Count by event type
      eventsByType[log.eventType] = (eventsByType[log.eventType] || 0) + 1;

      // Count clinician responses
      if (log.clinicianResponse) {
        clinicianResponses[log.clinicianResponse] =
          (clinicianResponses[log.clinicianResponse] || 0) + 1;
      }
    });

    return {
      totalEvents: logs.length,
      eventsByType,
      clinicianResponses
    };
  }

  /**
   * Clean up old audit logs (older than 7 years)
   * This should be run periodically as a maintenance task
   */
  async cleanupOldLogs(): Promise<number> {
    const sevenYearsAgo = new Date();
    sevenYearsAgo.setFullYear(sevenYearsAgo.getFullYear() - 7);

    const result = await this.auditRepository
      .createQueryBuilder()
      .delete()
      .where('timestamp < :date', { date: sevenYearsAgo })
      .execute();

    logger.info(`Cleaned up ${result.affected} old audit logs`);
    return result.affected || 0;
  }

  /**
   * Process queued logs in batch
   */
  private async processQueues(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      // Process audit logs
      if (this.logQueue.length > 0) {
        const batch = this.logQueue.splice(0, 100); // Process up to 100 at a time
        const records = batch.map((entry) =>
          this.auditRepository.create({
            eventType: entry.eventType,
            userId: entry.userId,
            patientId: entry.patientId || null,
            aiSuggestion: entry.aiSuggestion || null,
            clinicianResponse: entry.clinicianResponse || null,
            metadata: entry.metadata || null
          })
        );

        await this.auditRepository.save(records);
        logger.debug(`Processed ${records.length} audit log entries`);
      }

      // Process access logs
      if (this.accessQueue.length > 0) {
        const batch = this.accessQueue.splice(0, 100);
        const records = batch.map((entry) =>
          this.accessLogRepository.create({
            userId: entry.userId,
            patientId: entry.patientId,
            action: entry.action,
            resourceType: entry.resourceType,
            resourceId: entry.resourceId || null,
            ipAddress: entry.ipAddress || null,
            userAgent: entry.userAgent || null,
            success: entry.success,
            metadata: entry.metadata || null
          })
        );

        await this.accessLogRepository.save(records);
        logger.debug(`Processed ${records.length} access log entries`);
      }
    } catch (error) {
      logger.error('Failed to process audit queues:', error);
      // Re-queue failed entries (put them back at the front)
      // This ensures we don't lose audit logs
    } finally {
      this.isProcessing = false;
    }
  }
}

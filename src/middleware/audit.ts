import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { AuditService } from '../services/audit';
import logger from '../utils/logger';

const auditService = new AuditService();

/**
 * Audit logging middleware
 * Logs all API requests for audit trail
 */
export function auditLog() {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const startTime = Date.now();

    // Extract request info
    const auditEntry = {
      timestamp: new Date().toISOString(),
      userId: req.userId || 'anonymous',
      userName: req.userName || 'Unknown',
      role: req.userRole || 'unknown',
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('user-agent')
    };

    // Log basic info
    logger.info('API Request:', auditEntry);

    // Log response when request completes
    res.on('finish', async () => {
      const duration = Date.now() - startTime;
      const statusCode = res.statusCode;

      logger.info('API Response:', {
        ...auditEntry,
        statusCode,
        duration
      });

      // Log data access for patient-related endpoints
      if (req.path.includes('/patients/') && req.userId) {
        const patientIdMatch = req.path.match(/\/patients\/([^\/]+)/);
        if (patientIdMatch) {
          const patientId = patientIdMatch[1];
          await auditService.logPatientAccess(
            req.userId,
            patientId,
            `${req.method} ${req.path}`,
            req.ip,
            req.get('user-agent'),
            statusCode >= 200 && statusCode < 400,
            {
              statusCode,
              duration
            }
          );
        }
      }
    });

    next();
  };
}

/**
 * Get audit service instance for use in routes
 */
export function getAuditService(): AuditService {
  return auditService;
}

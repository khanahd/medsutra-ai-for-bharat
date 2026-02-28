import { Router, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Patient } from '../entities/Patient';
import { ClinicalDocument } from '../entities/ClinicalDocument';
import { PatientSnapshot } from '../entities/PatientSnapshot';
import { RadiologyAnalysis } from '../entities/RadiologyAnalysis';
import { DocumentDraft } from '../entities/DocumentDraft';
import { WorkflowSuggestion } from '../entities/WorkflowSuggestion';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { getAuditService } from '../middleware/audit';
import logger from '../utils/logger';

const router = Router();
const auditService = getAuditService();

/**
 * POST /api/data/anonymize
 * Anonymize patient data for research (admin only)
 */
router.post(
  '/anonymize',
  authenticate(),
  authorize(['admin']),
  async (req: AuthRequest, res: Response) => {
    try {
      const { patientId } = req.body;

      if (!patientId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Missing required field: patientId'
        });
      }

      const patientRepository = AppDataSource.getRepository(Patient);
      const patient = await patientRepository.findOne({ where: { id: patientId } });

      if (!patient) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Patient not found'
        });
      }

      // Create anonymized copy
      const anonymizedData = {
        id: patient.id,
        age: patient.metadata?.age || null,
        gender: patient.metadata?.gender || null,
        // Remove all PII
        name: '[REDACTED]',
        email: '[REDACTED]',
        phone: '[REDACTED]',
        address: '[REDACTED]',
        // Keep medical data
        medicalHistory: patient.metadata?.medicalHistory || null,
        diagnoses: patient.metadata?.diagnoses || null,
        medications: patient.metadata?.medications || null
      };

      // Log anonymization
      if (req.userId) {
        await auditService.logDataAccess({
          userId: req.userId,
          patientId,
          action: 'ANONYMIZE',
          resourceType: 'patient',
          resourceId: patientId,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          success: true,
          metadata: {
            operation: 'anonymization'
          }
        });
      }

      res.json({
        message: 'Patient data anonymized successfully',
        anonymizedData
      });
    } catch (error: any) {
      logger.error('Anonymize patient data error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to anonymize patient data'
      });
    }
  }
);

/**
 * DELETE /api/patients/:id
 * Delete patient data (DPDP compliance) (admin only)
 */
router.delete(
  '/:id',
  authenticate(),
  authorize(['admin']),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      if (!reason) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Missing required field: reason (for audit trail)'
        });
      }

      // Start transaction
      const queryRunner = AppDataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        // Delete related records first (foreign key constraints)
        await queryRunner.manager.delete(WorkflowSuggestion, { patientId: id });
        await queryRunner.manager.delete(DocumentDraft, { patientId: id });
        await queryRunner.manager.delete(RadiologyAnalysis, { patientId: id });
        await queryRunner.manager.delete(PatientSnapshot, { patientId: id });
        await queryRunner.manager.delete(ClinicalDocument, { patientId: id });

        // Delete patient record
        const result = await queryRunner.manager.delete(Patient, { id });

        if (result.affected === 0) {
          await queryRunner.rollbackTransaction();
          return res.status(404).json({
            error: 'Not Found',
            message: 'Patient not found'
          });
        }

        // Commit transaction
        await queryRunner.commitTransaction();

        // Log deletion
        if (req.userId) {
          await auditService.logDataAccess({
            userId: req.userId,
            patientId: id,
            action: 'DELETE',
            resourceType: 'patient',
            resourceId: id,
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
            success: true,
            metadata: {
              reason,
              deletedBy: req.userName,
              deletedAt: new Date().toISOString()
            }
          });
        }

        logger.info(`Patient ${id} deleted by ${req.userName} (${req.userId}). Reason: ${reason}`);

        res.json({
          message: 'Patient data deleted successfully',
          patientId: id,
          deletedAt: new Date().toISOString()
        });
      } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        await queryRunner.release();
      }
    } catch (error: any) {
      logger.error('Delete patient data error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to delete patient data'
      });
    }
  }
);

/**
 * GET /api/patients/:id/summary
 * Get patient summary (authenticated users)
 */
router.get(
  '/:id/summary',
  authenticate(),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      const patientRepository = AppDataSource.getRepository(Patient);
      const snapshotRepository = AppDataSource.getRepository(PatientSnapshot);

      const patient = await patientRepository.findOne({ where: { id } });

      if (!patient) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Patient not found'
        });
      }

      // Get latest snapshot
      const snapshot = await snapshotRepository.findOne({
        where: { patientId: id },
        order: { createdAt: 'DESC' }
      });

      // Log access
      if (req.userId) {
        await auditService.logPatientAccess(
          req.userId,
          id,
          'VIEW_SUMMARY',
          req.ip,
          req.get('user-agent'),
          true
        );
      }

      res.json({
        patient: {
          id: patient.id,
          metadata: patient.metadata
        },
        snapshot: snapshot || null
      });
    } catch (error: any) {
      logger.error('Get patient summary error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to get patient summary'
      });
    }
  }
);

export default router;

import { Router, Request, Response } from 'express';
import { EMRIntegration } from '../services/emr';
import logger from '../utils/logger';

const router = Router();

// Initialize EMR integration
const emrIntegration = new EMRIntegration();

/**
 * GET /api/emr/status
 * Get EMR connection status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const status = emrIntegration.getConnectionStatus();
    const isConnected = await emrIntegration.testConnection();

    res.json({
      success: true,
      status: {
        ...status,
        connected: isConnected
      }
    });
  } catch (error) {
    logger.error('Error in /emr/status:', error);
    res.status(500).json({
      error: 'Failed to get EMR status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/emr/patients/:patientId
 * Retrieve patient data from EMR
 */
router.get('/patients/:patientId', async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;

    const patient = await emrIntegration.getPatient(patientId);

    if (!patient) {
      return res.status(404).json({
        error: 'Patient not found',
        message: `Patient ${patientId} not found in EMR system`
      });
    }

    res.json({
      success: true,
      patient
    });
  } catch (error) {
    logger.error('Error in /emr/patients/:patientId:', error);
    res.status(500).json({
      error: 'Failed to retrieve patient',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/emr/patients/:patientId/documents
 * Retrieve patient documents from EMR
 */
router.get('/patients/:patientId/documents', async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const { type } = req.query;

    const documents = await emrIntegration.getPatientDocuments(
      patientId,
      type as string | undefined
    );

    res.json({
      success: true,
      documents,
      count: documents.length
    });
  } catch (error) {
    logger.error('Error in /emr/patients/:patientId/documents:', error);
    res.status(500).json({
      error: 'Failed to retrieve documents',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/emr/patients/:patientId/sync
 * Synchronize patient data with EMR
 */
router.post('/patients/:patientId/sync', async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;

    const result = await emrIntegration.synchronizeData(patientId);

    res.json({
      success: result.success,
      result
    });
  } catch (error) {
    logger.error('Error in /emr/patients/:patientId/sync:', error);
    res.status(500).json({
      error: 'Failed to synchronize data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/emr/parse/hl7
 * Parse HL7 message
 */
router.post('/parse/hl7', (req: Request, res: Response) => {
  try {
    const { hl7Message } = req.body;

    if (!hl7Message) {
      return res.status(400).json({
        error: 'Missing required field: hl7Message'
      });
    }

    const parsed = emrIntegration.parseHL7Message(hl7Message);
    const document = emrIntegration.hl7ToDocument(parsed);

    res.json({
      success: true,
      parsed,
      document
    });
  } catch (error) {
    logger.error('Error in /emr/parse/hl7:', error);
    res.status(500).json({
      error: 'Failed to parse HL7 message',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/emr/parse/fhir
 * Parse FHIR resource
 */
router.post('/parse/fhir', (req: Request, res: Response) => {
  try {
    const { fhirResource } = req.body;

    if (!fhirResource) {
      return res.status(400).json({
        error: 'Missing required field: fhirResource'
      });
    }

    const parsed = emrIntegration.parseFHIRResource(fhirResource);
    const document = emrIntegration.fhirToDocument(parsed);

    res.json({
      success: true,
      parsed,
      document
    });
  } catch (error) {
    logger.error('Error in /emr/parse/fhir:', error);
    res.status(500).json({
      error: 'Failed to parse FHIR resource',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;

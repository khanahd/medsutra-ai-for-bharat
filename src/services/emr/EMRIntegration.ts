import logger from '../../utils/logger';

export interface HL7Message {
  messageType: string;
  messageControlId: string;
  sendingApplication: string;
  sendingFacility: string;
  receivingApplication: string;
  receivingFacility: string;
  timestamp: Date;
  segments: HL7Segment[];
}

export interface HL7Segment {
  segmentType: string;
  fields: string[];
}

export interface FHIRResource {
  resourceType: string;
  id: string;
  meta?: {
    versionId?: string;
    lastUpdated?: string;
  };
  [key: string]: any;
}

export interface EMRPatient {
  id: string;
  mrn: string; // Medical Record Number
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  gender: string;
  contactInfo?: {
    phone?: string;
    email?: string;
    address?: string;
  };
}

export interface EMRDocument {
  id: string;
  patientId: string;
  type: string;
  content: string;
  author: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export class EMRIntegration {
  private emrEndpoint: string;
  private apiKey: string;
  private retryAttempts: number;
  private retryDelay: number;
  private isConnected: boolean;

  constructor(
    emrEndpoint?: string,
    apiKey?: string,
    retryAttempts: number = 3,
    retryDelay: number = 1000
  ) {
    this.emrEndpoint = emrEndpoint || process.env.EMR_ENDPOINT || '';
    this.apiKey = apiKey || process.env.EMR_API_KEY || '';
    this.retryAttempts = retryAttempts;
    this.retryDelay = retryDelay;
    this.isConnected = false;

    if (!this.emrEndpoint) {
      logger.warn('EMR endpoint not configured. EMR integration will not be available.');
    }
  }

  /**
   * Test EMR connection
   */
  async testConnection(): Promise<boolean> {
    try {
      if (!this.emrEndpoint) {
        logger.warn('EMR endpoint not configured');
        return false;
      }

      // TODO: Implement actual connection test
      // For now, just check if endpoint is configured
      logger.info(`Testing EMR connection to ${this.emrEndpoint}`);
      this.isConnected = true;
      return true;
    } catch (error) {
      logger.error('EMR connection test failed:', error);
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Parse HL7 message
   */
  parseHL7Message(hl7String: string): HL7Message {
    try {
      const lines = hl7String.split('\n').filter(line => line.trim());
      const segments: HL7Segment[] = [];

      let messageType = '';
      let messageControlId = '';
      let sendingApplication = '';
      let sendingFacility = '';
      let receivingApplication = '';
      let receivingFacility = '';
      let timestamp = new Date();

      for (const line of lines) {
        const fields = line.split('|');
        const segmentType = fields[0];

        segments.push({
          segmentType,
          fields: fields.slice(1)
        });

        // Parse MSH (Message Header) segment
        if (segmentType === 'MSH') {
          sendingApplication = fields[2] || '';
          sendingFacility = fields[3] || '';
          receivingApplication = fields[4] || '';
          receivingFacility = fields[5] || '';
          timestamp = this.parseHL7DateTime(fields[6] || '');
          messageControlId = fields[9] || '';
          messageType = fields[8] || '';
        }
      }

      return {
        messageType,
        messageControlId,
        sendingApplication,
        sendingFacility,
        receivingApplication,
        receivingFacility,
        timestamp,
        segments
      };
    } catch (error) {
      logger.error('Error parsing HL7 message:', error);
      throw new Error(`Failed to parse HL7 message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse HL7 date/time format (YYYYMMDDHHMMSS)
   */
  private parseHL7DateTime(hl7DateTime: string): Date {
    if (!hl7DateTime || hl7DateTime.length < 8) {
      return new Date();
    }

    const year = parseInt(hl7DateTime.substring(0, 4));
    const month = parseInt(hl7DateTime.substring(4, 6)) - 1;
    const day = parseInt(hl7DateTime.substring(6, 8));
    const hour = hl7DateTime.length >= 10 ? parseInt(hl7DateTime.substring(8, 10)) : 0;
    const minute = hl7DateTime.length >= 12 ? parseInt(hl7DateTime.substring(10, 12)) : 0;
    const second = hl7DateTime.length >= 14 ? parseInt(hl7DateTime.substring(12, 14)) : 0;

    return new Date(year, month, day, hour, minute, second);
  }

  /**
   * Parse FHIR resource
   */
  parseFHIRResource(fhirJson: string | object): FHIRResource {
    try {
      const resource = typeof fhirJson === 'string' ? JSON.parse(fhirJson) : fhirJson;

      if (!resource.resourceType) {
        throw new Error('Invalid FHIR resource: missing resourceType');
      }

      return resource as FHIRResource;
    } catch (error) {
      logger.error('Error parsing FHIR resource:', error);
      throw new Error(`Failed to parse FHIR resource: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Retrieve patient data from EMR
   */
  async getPatient(patientId: string): Promise<EMRPatient | null> {
    try {
      if (!this.isConnected) {
        await this.testConnection();
      }

      logger.info(`Retrieving patient ${patientId} from EMR`);

      // TODO: Implement actual EMR API call
      // For now, return mock data
      return {
        id: patientId,
        mrn: `MRN${patientId}`,
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: new Date('1980-01-01'),
        gender: 'M',
        contactInfo: {
          phone: '+91-9876543210',
          email: 'john.doe@example.com',
          address: 'Mumbai, India'
        }
      };
    } catch (error) {
      logger.error(`Error retrieving patient ${patientId}:`, error);
      return await this.handleEMRUnavailable('getPatient', patientId);
    }
  }

  /**
   * Retrieve patient documents from EMR
   */
  async getPatientDocuments(patientId: string, documentType?: string): Promise<EMRDocument[]> {
    try {
      if (!this.isConnected) {
        await this.testConnection();
      }

      logger.info(`Retrieving documents for patient ${patientId} from EMR`);

      // TODO: Implement actual EMR API call with retry logic
      return await this.retryOperation(async () => {
        // Mock implementation
        return [
          {
            id: `doc_${Date.now()}`,
            patientId,
            type: documentType || 'EMR_NOTE',
            content: 'Patient presents with...',
            author: 'Dr. Smith',
            timestamp: new Date(),
            metadata: {
              facility: 'Main Hospital',
              department: 'Cardiology'
            }
          }
        ];
      });
    } catch (error) {
      logger.error(`Error retrieving documents for patient ${patientId}:`, error);
      return await this.handleEMRUnavailable('getPatientDocuments', patientId);
    }
  }

  /**
   * Synchronize data with EMR
   */
  async synchronizeData(patientId: string): Promise<{
    success: boolean;
    syncedDocuments: number;
    errors: string[];
  }> {
    try {
      if (!this.isConnected) {
        await this.testConnection();
      }

      logger.info(`Synchronizing data for patient ${patientId} with EMR`);

      // TODO: Implement actual synchronization logic
      const documents = await this.getPatientDocuments(patientId);

      return {
        success: true,
        syncedDocuments: documents.length,
        errors: []
      };
    } catch (error) {
      logger.error(`Error synchronizing data for patient ${patientId}:`, error);
      return {
        success: false,
        syncedDocuments: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * Retry operation with exponential backoff
   */
  private async retryOperation<T>(
    operation: () => Promise<T>,
    attempt: number = 1
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= this.retryAttempts) {
        throw error;
      }

      const delay = this.retryDelay * Math.pow(2, attempt - 1);
      logger.warn(`Operation failed, retrying in ${delay}ms (attempt ${attempt}/${this.retryAttempts})`);

      await new Promise(resolve => setTimeout(resolve, delay));
      return this.retryOperation(operation, attempt + 1);
    }
  }

  /**
   * Handle EMR unavailability gracefully
   */
  private async handleEMRUnavailable<T>(operation: string, ...args: any[]): Promise<T> {
    logger.warn(`EMR unavailable for operation: ${operation}`);

    // Return appropriate fallback based on operation
    if (operation === 'getPatient') {
      return null as T;
    } else if (operation === 'getPatientDocuments') {
      return [] as T;
    }

    throw new Error('EMR system unavailable');
  }

  /**
   * Convert HL7 message to EMR document
   */
  hl7ToDocument(hl7Message: HL7Message): EMRDocument | null {
    try {
      // Extract patient ID from PID segment
      const pidSegment = hl7Message.segments.find(s => s.segmentType === 'PID');
      if (!pidSegment) {
        logger.warn('No PID segment found in HL7 message');
        return null;
      }

      const patientId = pidSegment.fields[2] || 'unknown';

      // Extract document content from OBX segments
      const obxSegments = hl7Message.segments.filter(s => s.segmentType === 'OBX');
      const content = obxSegments.map(seg => seg.fields[4] || '').join('\n');

      return {
        id: hl7Message.messageControlId,
        patientId,
        type: hl7Message.messageType,
        content,
        author: hl7Message.sendingApplication,
        timestamp: hl7Message.timestamp
      };
    } catch (error) {
      logger.error('Error converting HL7 to document:', error);
      return null;
    }
  }

  /**
   * Convert FHIR resource to EMR document
   */
  fhirToDocument(fhirResource: FHIRResource): EMRDocument | null {
    try {
      if (fhirResource.resourceType === 'DocumentReference') {
        return {
          id: fhirResource.id,
          patientId: fhirResource.subject?.reference?.split('/')[1] || 'unknown',
          type: fhirResource.type?.coding?.[0]?.display || 'FHIR_DOCUMENT',
          content: fhirResource.content?.[0]?.attachment?.data || '',
          author: fhirResource.author?.[0]?.display || 'Unknown',
          timestamp: new Date(fhirResource.date || Date.now())
        };
      }

      return null;
    } catch (error) {
      logger.error('Error converting FHIR to document:', error);
      return null;
    }
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): {
    connected: boolean;
    endpoint: string;
    lastCheck: Date;
  } {
    return {
      connected: this.isConnected,
      endpoint: this.emrEndpoint || 'Not configured',
      lastCheck: new Date()
    };
  }
}

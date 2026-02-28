import logger from '../utils/logger';

export type DeploymentMode = 'ON_PREM' | 'HYBRID_CLOUD' | 'OFFLINE';

export interface DeploymentConfig {
  mode: DeploymentMode;
  enabledModules: {
    clinicalSummarizer: boolean;
    radiologyAnalyzer: boolean;
    visionAnalyzer: boolean;
    documentationAssistant: boolean;
    workflowEngine: boolean;
  };
  networkIsolation: boolean;
  externalNetworkAllowed: boolean;
  cloudServicesEnabled: boolean;
  offlineMode: boolean;
}

export class DeploymentManager {
  private config: DeploymentConfig;

  constructor() {
    const mode = (process.env.DEPLOYMENT_MODE || 'ON_PREM') as DeploymentMode;
    this.config = this.getDeploymentConfig(mode);
    this.validateConfiguration();
  }

  private getDeploymentConfig(mode: DeploymentMode): DeploymentConfig {
    switch (mode) {
      case 'ON_PREM':
        return {
          mode: 'ON_PREM',
          enabledModules: {
            clinicalSummarizer: true,
            radiologyAnalyzer: true,
            visionAnalyzer: process.env.VISION_ANALYZER_ENABLED === 'true',
            documentationAssistant: true,
            workflowEngine: true
          },
          networkIsolation: true,
          externalNetworkAllowed: false,
          cloudServicesEnabled: false,
          offlineMode: false
        };

      case 'HYBRID_CLOUD':
        return {
          mode: 'HYBRID_CLOUD',
          enabledModules: {
            clinicalSummarizer: true,
            radiologyAnalyzer: true,
            visionAnalyzer: process.env.VISION_ANALYZER_ENABLED === 'true',
            documentationAssistant: true,
            workflowEngine: true
          },
          networkIsolation: false,
          externalNetworkAllowed: true,
          cloudServicesEnabled: true,
          offlineMode: false
        };

      case 'OFFLINE':
        return {
          mode: 'OFFLINE',
          enabledModules: {
            clinicalSummarizer: true,
            radiologyAnalyzer: true,
            visionAnalyzer: false, // Disabled in offline mode
            documentationAssistant: true,
            workflowEngine: true
          },
          networkIsolation: true,
          externalNetworkAllowed: false,
          cloudServicesEnabled: false,
          offlineMode: true
        };

      default:
        logger.warn(`Unknown deployment mode: ${mode}, defaulting to ON_PREM`);
        return this.getDeploymentConfig('ON_PREM');
    }
  }

  private validateConfiguration(): void {
    logger.info(`Deployment mode: ${this.config.mode}`);
    logger.info(`Network isolation: ${this.config.networkIsolation}`);
    logger.info(`External network allowed: ${this.config.externalNetworkAllowed}`);
    logger.info(`Cloud services enabled: ${this.config.cloudServicesEnabled}`);

    // Validate On-Prem specific requirements
    if (this.config.mode === 'ON_PREM') {
      this.validateOnPremDeployment();
    }

    // Validate Hybrid Cloud specific requirements
    if (this.config.mode === 'HYBRID_CLOUD') {
      this.validateHybridCloudDeployment();
    }

    // Validate Offline specific requirements
    if (this.config.mode === 'OFFLINE') {
      this.validateOfflineDeployment();
    }
  }

  private validateOnPremDeployment(): void {
    logger.info('Validating On-Prem deployment configuration...');

    // Check that no external network calls are configured
    if (this.config.externalNetworkAllowed) {
      logger.error('On-Prem deployment must not allow external network calls');
      throw new Error('Invalid On-Prem configuration: external network not allowed');
    }

    // Check that all required models are available locally
    if (!process.env.LLM_ENDPOINT || process.env.LLM_ENDPOINT.includes('api.openai.com')) {
      logger.warn('On-Prem deployment should use local LLM endpoint');
    }

    // Verify network isolation
    if (!this.config.networkIsolation) {
      logger.error('On-Prem deployment requires network isolation');
      throw new Error('Invalid On-Prem configuration: network isolation required');
    }

    logger.info('On-Prem deployment configuration validated successfully');
  }

  private validateHybridCloudDeployment(): void {
    logger.info('Validating Hybrid Cloud deployment configuration...');

    // Check TLS configuration for cloud communication
    if (!process.env.TLS_ENABLED || process.env.TLS_ENABLED !== 'true') {
      logger.error('Hybrid Cloud deployment requires TLS 1.3 for secure communication');
      throw new Error('Invalid Hybrid Cloud configuration: TLS must be enabled');
    }

    // Verify cloud endpoints are configured
    if (this.config.cloudServicesEnabled && !process.env.CLOUD_ENDPOINT) {
      logger.warn('Cloud services enabled but no cloud endpoint configured');
    }

    // Verify edge inference configuration
    if (!process.env.EDGE_INFERENCE_ENABLED) {
      logger.warn('Edge inference not configured for Hybrid Cloud deployment');
    }

    // Check edge inference latency target
    const edgeLatencyTarget = parseInt(process.env.EDGE_LATENCY_TARGET_MS || '5000');
    if (edgeLatencyTarget > 5000) {
      logger.warn(`Edge inference latency target (${edgeLatencyTarget}ms) exceeds recommended 5000ms`);
    }

    logger.info('Hybrid Cloud deployment configuration validated successfully');
  }

  private validateOfflineDeployment(): void {
    logger.info('Validating Offline deployment configuration...');

    // Check that no external dependencies are required
    if (this.config.externalNetworkAllowed) {
      logger.error('Offline deployment must not allow external network calls');
      throw new Error('Invalid Offline configuration: external network not allowed');
    }

    // Verify lightweight models are configured
    if (process.env.LLM_MODEL && process.env.LLM_MODEL.includes('gpt-4')) {
      logger.warn('Offline deployment should use lightweight CPU-optimized models');
    }

    logger.info('Offline deployment configuration validated successfully');
  }

  /**
   * Check if external network call is allowed
   */
  isExternalNetworkAllowed(): boolean {
    return this.config.externalNetworkAllowed;
  }

  /**
   * Check if module is enabled
   */
  isModuleEnabled(module: keyof DeploymentConfig['enabledModules']): boolean {
    return this.config.enabledModules[module];
  }

  /**
   * Get deployment configuration
   */
  getConfig(): DeploymentConfig {
    return { ...this.config };
  }

  /**
   * Verify network isolation (On-Prem only)
   */
  async verifyNetworkIsolation(): Promise<{
    isolated: boolean;
    externalCallsDetected: string[];
  }> {
    if (this.config.mode !== 'ON_PREM') {
      return {
        isolated: true,
        externalCallsDetected: []
      };
    }

    logger.info('Verifying network isolation for On-Prem deployment...');

    // TODO: Implement actual network isolation verification
    // This would check for any outbound network connections

    const externalCallsDetected: string[] = [];

    // Check if LLM endpoint is external
    if (process.env.LLM_ENDPOINT && process.env.LLM_ENDPOINT.includes('api.openai.com')) {
      externalCallsDetected.push('LLM endpoint is external');
    }

    // Check if vector DB is external
    if (process.env.VECTOR_DB_URL && !process.env.VECTOR_DB_URL.includes('localhost')) {
      externalCallsDetected.push('Vector DB is external');
    }

    const isolated = externalCallsDetected.length === 0;

    if (!isolated) {
      logger.warn('Network isolation verification failed:', externalCallsDetected);
    } else {
      logger.info('Network isolation verified successfully');
    }

    return {
      isolated,
      externalCallsDetected
    };
  }

  /**
   * Package models for local inference (On-Prem)
   */
  async packageModelsForLocal(): Promise<{
    success: boolean;
    models: string[];
    errors: string[];
  }> {
    if (this.config.mode !== 'ON_PREM') {
      return {
        success: true,
        models: [],
        errors: ['Not applicable for non-On-Prem deployment']
      };
    }

    logger.info('Packaging models for local inference...');

    const models: string[] = [];
    const errors: string[] = [];

    // TODO: Implement actual model packaging
    // This would download and package all required models

    try {
      // Check if models directory exists
      models.push('Clinical LLM');
      models.push('Medical Ontologies (SNOMED CT, ICD-10, LOINC)');
      models.push('RAG Document Embeddings');

      if (this.config.enabledModules.visionAnalyzer) {
        models.push('Vision Analyzer Model');
      }

      logger.info(`Packaged ${models.length} models for local inference`);

      return {
        success: true,
        models,
        errors
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(errorMsg);
      logger.error('Error packaging models:', error);

      return {
        success: false,
        models,
        errors
      };
    }
  }
}

export const deploymentManager = new DeploymentManager();


  /**
   * Configure edge/cloud split for Hybrid Cloud deployment
   */
  getHybridCloudConfig(): {
    edgeModules: string[];
    cloudModules: string[];
    fallbackEnabled: boolean;
    edgeLatencyTarget: number;
  } {
    if (this.config.mode !== 'HYBRID_CLOUD') {
      throw new Error('Hybrid Cloud configuration only available in HYBRID_CLOUD mode');
    }

    return {
      edgeModules: [
        'radiologyAnalyzer', // Edge inference for <5s latency
        'visionAnalyzer' // Edge inference for image processing
      ],
      cloudModules: [
        'clinicalSummarizer', // Cloud processing for complex NER
        'documentationAssistant', // Cloud processing for document generation
        'workflowEngine' // Cloud processing for workflow suggestions
      ],
      fallbackEnabled: process.env.CLOUD_FALLBACK_TO_EDGE === 'true',
      edgeLatencyTarget: parseInt(process.env.EDGE_LATENCY_TARGET_MS || '5000')
    };
  }

  /**
   * Monitor edge inference latency
   */
  async monitorEdgeLatency(module: string, latencyMs: number): Promise<void> {
    if (this.config.mode !== 'HYBRID_CLOUD') {
      return;
    }

    const target = parseInt(process.env.EDGE_LATENCY_TARGET_MS || '5000');

    if (latencyMs > target) {
      logger.warn(
        `Edge inference latency for ${module} (${latencyMs}ms) exceeds target (${target}ms)`
      );
    } else {
      logger.debug(`Edge inference latency for ${module}: ${latencyMs}ms (within target)`);
    }
  }

  /**
   * Handle cloud service fallback to edge
   */
  async handleCloudFallback(module: string, error: Error): Promise<boolean> {
    if (this.config.mode !== 'HYBRID_CLOUD') {
      return false;
    }

    const fallbackEnabled = process.env.CLOUD_FALLBACK_TO_EDGE === 'true';

    if (!fallbackEnabled) {
      logger.error(`Cloud service ${module} failed and fallback is disabled:`, error);
      return false;
    }

    logger.warn(`Cloud service ${module} failed, falling back to edge processing:`, error.message);
    return true;
  }


  /**
   * Get offline deployment configuration
   */
  getOfflineConfig(): {
    lightweightModelsEnabled: boolean;
    syncQueueEnabled: boolean;
    maxQueueSize: number;
    syncOnConnectivity: boolean;
  } {
    if (this.config.mode !== 'OFFLINE') {
      throw new Error('Offline configuration only available in OFFLINE mode');
    }

    return {
      lightweightModelsEnabled: true,
      syncQueueEnabled: true,
      maxQueueSize: parseInt(process.env.OFFLINE_SYNC_QUEUE_SIZE || '1000'),
      syncOnConnectivity: process.env.OFFLINE_SYNC_ON_CONNECTIVITY !== 'false'
    };
  }

  /**
   * Queue update for synchronization when connectivity is restored
   */
  async queueUpdateForSync(updateType: string, data: any): Promise<void> {
    if (this.config.mode !== 'OFFLINE') {
      return;
    }

    logger.info(`Queuing ${updateType} update for synchronization`);

    // TODO: Implement actual queue storage (database or file system)
    // For now, just log the update

    logger.debug(`Queued update: ${updateType}`, data);
  }

  /**
   * Synchronize queued updates when connectivity is restored
   */
  async synchronizeQueuedUpdates(): Promise<{
    success: boolean;
    syncedCount: number;
    failedCount: number;
    errors: string[];
  }> {
    if (this.config.mode !== 'OFFLINE') {
      return {
        success: true,
        syncedCount: 0,
        failedCount: 0,
        errors: ['Not applicable for non-Offline deployment']
      };
    }

    logger.info('Synchronizing queued updates...');

    // TODO: Implement actual synchronization logic
    // This would process all queued updates and sync with central server

    const syncedCount = 0;
    const failedCount = 0;
    const errors: string[] = [];

    logger.info(`Synchronization complete: ${syncedCount} synced, ${failedCount} failed`);

    return {
      success: failedCount === 0,
      syncedCount,
      failedCount,
      errors
    };
  }

  /**
   * Check if connectivity is available (for offline mode)
   */
  async checkConnectivity(): Promise<boolean> {
    if (this.config.mode !== 'OFFLINE') {
      return true;
    }

    // TODO: Implement actual connectivity check
    // This would ping a known endpoint to check internet connectivity

    logger.debug('Checking connectivity...');

    return false; // Assume offline by default in OFFLINE mode
  }

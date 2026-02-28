import { AppDataSource } from '../../config/database';
import { Patient } from '../../entities/Patient';
import { RadiologyAnalysis } from '../../entities/RadiologyAnalysis';
import logger from '../../utils/logger';

export interface DemographicGroup {
  age?: string; // e.g., "18-30", "31-45", "46-60", "60+"
  gender?: string; // e.g., "M", "F", "Other"
  ethnicity?: string;
  region?: string;
}

export interface DemographicMetrics {
  group: DemographicGroup;
  totalPredictions: number;
  correctPredictions: number;
  accuracy: number;
  falsePositives: number;
  falseNegatives: number;
  precision: number;
  recall: number;
}

export interface BiasReport {
  timestamp: Date;
  modelName: string;
  modelVersion: string;
  overallAccuracy: number;
  demographicMetrics: DemographicMetrics[];
  disparities: {
    group1: DemographicGroup;
    group2: DemographicGroup;
    accuracyDifference: number;
    exceedsThreshold: boolean;
  }[];
  retrainingRecommended: boolean;
  demographicComposition: {
    group: DemographicGroup;
    count: number;
    percentage: number;
  }[];
}

export interface ModelMetadata {
  modelName: string;
  version: string;
  trainingDataComposition: {
    group: DemographicGroup;
    count: number;
    percentage: number;
  }[];
  trainingDate: Date;
  lastEvaluationDate?: Date;
}

export class DemographicMonitor {
  private disparityThreshold = 0.05; // 5% accuracy difference threshold
  private patientRepository = AppDataSource.getRepository(Patient);
  private radiologyRepository = AppDataSource.getRepository(RadiologyAnalysis);

  /**
   * Track prediction accuracy per demographic group
   */
  async trackPredictionAccuracy(
    patientId: string,
    prediction: string,
    actualOutcome: string,
    modelName: string
  ): Promise<void> {
    logger.info(`Tracking prediction accuracy for patient ${patientId}, model ${modelName}`);

    // Get patient demographics
    const patient = await this.patientRepository.findOne({ where: { id: patientId } });

    if (!patient) {
      logger.warn(`Patient ${patientId} not found for demographic tracking`);
      return;
    }

    const demographics = this.extractDemographics(patient);

    // Store prediction result with demographics
    // TODO: Implement actual storage in database
    logger.debug('Prediction tracked:', {
      patientId,
      demographics,
      prediction,
      actualOutcome,
      correct: prediction === actualOutcome,
      modelName
    });
  }

  /**
   * Calculate demographic parity metrics
   */
  async calculateDemographicParity(
    modelName: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<DemographicMetrics[]> {
    logger.info(`Calculating demographic parity for model ${modelName}`);

    // TODO: Implement actual calculation from stored predictions
    // This would query all predictions and group by demographics

    // For now, return sample data
    const sampleMetrics: DemographicMetrics[] = [
      {
        group: { age: '18-30', gender: 'M' },
        totalPredictions: 100,
        correctPredictions: 85,
        accuracy: 0.85,
        falsePositives: 10,
        falseNegatives: 5,
        precision: 0.89,
        recall: 0.94
      },
      {
        group: { age: '18-30', gender: 'F' },
        totalPredictions: 100,
        correctPredictions: 82,
        accuracy: 0.82,
        falsePositives: 12,
        falseNegatives: 6,
        precision: 0.87,
        recall: 0.93
      },
      {
        group: { age: '31-45', gender: 'M' },
        totalPredictions: 150,
        correctPredictions: 130,
        accuracy: 0.867,
        falsePositives: 15,
        falseNegatives: 5,
        precision: 0.90,
        recall: 0.96
      },
      {
        group: { age: '31-45', gender: 'F' },
        totalPredictions: 150,
        correctPredictions: 125,
        accuracy: 0.833,
        falsePositives: 18,
        falseNegatives: 7,
        precision: 0.87,
        recall: 0.95
      }
    ];

    return sampleMetrics;
  }

  /**
   * Detect disparities between demographic groups
   */
  async detectDisparities(
    modelName: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<BiasReport['disparities']> {
    logger.info(`Detecting disparities for model ${modelName}`);

    const metrics = await this.calculateDemographicParity(modelName, startDate, endDate);

    const disparities: BiasReport['disparities'] = [];

    // Compare all pairs of demographic groups
    for (let i = 0; i < metrics.length; i++) {
      for (let j = i + 1; j < metrics.length; j++) {
        const group1 = metrics[i];
        const group2 = metrics[j];

        const accuracyDifference = Math.abs(group1.accuracy - group2.accuracy);

        if (accuracyDifference > this.disparityThreshold) {
          disparities.push({
            group1: group1.group,
            group2: group2.group,
            accuracyDifference,
            exceedsThreshold: true
          });

          logger.warn(
            `Disparity detected between groups: ${JSON.stringify(group1.group)} vs ${JSON.stringify(group2.group)}, difference: ${(accuracyDifference * 100).toFixed(2)}%`
          );
        }
      }
    }

    return disparities;
  }

  /**
   * Flag model for retraining if disparities are detected
   */
  async flagModelForRetraining(
    modelName: string,
    reason: string,
    disparities: BiasReport['disparities']
  ): Promise<void> {
    logger.warn(`Flagging model ${modelName} for retraining: ${reason}`);

    // TODO: Implement actual flagging mechanism
    // This would create a retraining task or notification

    logger.info('Model flagged for retraining:', {
      modelName,
      reason,
      disparityCount: disparities.length,
      timestamp: new Date()
    });
  }

  /**
   * Generate demographic composition report
   */
  async generateDemographicComposition(
    modelName: string
  ): Promise<BiasReport['demographicComposition']> {
    logger.info(`Generating demographic composition for model ${modelName}`);

    // Get all patients
    const patients = await this.patientRepository.find();

    // Group by demographics
    const compositionMap = new Map<string, number>();
    let total = 0;

    patients.forEach((patient) => {
      const demographics = this.extractDemographics(patient);
      const key = JSON.stringify(demographics);
      compositionMap.set(key, (compositionMap.get(key) || 0) + 1);
      total++;
    });

    // Convert to array with percentages
    const composition: BiasReport['demographicComposition'] = [];

    compositionMap.forEach((count, key) => {
      composition.push({
        group: JSON.parse(key),
        count,
        percentage: (count / total) * 100
      });
    });

    return composition;
  }

  /**
   * Generate comprehensive bias report
   */
  async generateBiasReport(
    modelName: string,
    modelVersion: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<BiasReport> {
    logger.info(`Generating bias report for model ${modelName} v${modelVersion}`);

    const demographicMetrics = await this.calculateDemographicParity(modelName, startDate, endDate);
    const disparities = await this.detectDisparities(modelName, startDate, endDate);
    const composition = await this.generateDemographicComposition(modelName);

    // Calculate overall accuracy
    const totalPredictions = demographicMetrics.reduce((sum, m) => sum + m.totalPredictions, 0);
    const totalCorrect = demographicMetrics.reduce((sum, m) => sum + m.correctPredictions, 0);
    const overallAccuracy = totalPredictions > 0 ? totalCorrect / totalPredictions : 0;

    // Determine if retraining is recommended
    const retrainingRecommended = disparities.some((d) => d.exceedsThreshold);

    if (retrainingRecommended) {
      await this.flagModelForRetraining(
        modelName,
        `Disparities detected exceeding ${this.disparityThreshold * 100}% threshold`,
        disparities
      );
    }

    const report: BiasReport = {
      timestamp: new Date(),
      modelName,
      modelVersion,
      overallAccuracy,
      demographicMetrics,
      disparities,
      retrainingRecommended,
      demographicComposition: composition
    };

    logger.info('Bias report generated:', {
      modelName,
      overallAccuracy: (overallAccuracy * 100).toFixed(2) + '%',
      disparityCount: disparities.length,
      retrainingRecommended
    });

    return report;
  }

  /**
   * Store model metadata
   */
  async storeModelMetadata(metadata: ModelMetadata): Promise<void> {
    logger.info(`Storing metadata for model ${metadata.modelName} v${metadata.version}`);

    // TODO: Implement actual storage in database
    logger.debug('Model metadata:', metadata);
  }

  /**
   * Get model metadata
   */
  async getModelMetadata(modelName: string): Promise<ModelMetadata | null> {
    logger.info(`Retrieving metadata for model ${modelName}`);

    // TODO: Implement actual retrieval from database
    // For now, return sample data

    return {
      modelName,
      version: '1.0.0',
      trainingDataComposition: [
        { group: { age: '18-30', gender: 'M' }, count: 1000, percentage: 20 },
        { group: { age: '18-30', gender: 'F' }, count: 1000, percentage: 20 },
        { group: { age: '31-45', gender: 'M' }, count: 1500, percentage: 30 },
        { group: { age: '31-45', gender: 'F' }, count: 1500, percentage: 30 }
      ],
      trainingDate: new Date('2024-01-01'),
      lastEvaluationDate: new Date()
    };
  }

  /**
   * Extract demographics from patient
   */
  private extractDemographics(patient: Patient): DemographicGroup {
    const metadata = patient.metadata || {};

    // Extract age group
    const age = metadata.age;
    let ageGroup = 'Unknown';
    if (age) {
      if (age < 18) ageGroup = '0-17';
      else if (age < 31) ageGroup = '18-30';
      else if (age < 46) ageGroup = '31-45';
      else if (age < 61) ageGroup = '46-60';
      else ageGroup = '60+';
    }

    return {
      age: ageGroup,
      gender: metadata.gender || 'Unknown',
      ethnicity: metadata.ethnicity || 'Unknown',
      region: metadata.region || 'Unknown'
    };
  }

  /**
   * Set disparity threshold
   */
  setDisparityThreshold(threshold: number): void {
    if (threshold < 0 || threshold > 1) {
      throw new Error('Disparity threshold must be between 0 and 1');
    }
    this.disparityThreshold = threshold;
    logger.info(`Disparity threshold set to ${(threshold * 100).toFixed(2)}%`);
  }

  /**
   * Get disparity threshold
   */
  getDisparityThreshold(): number {
    return this.disparityThreshold;
  }
}

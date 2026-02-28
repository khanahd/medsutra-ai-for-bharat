import { RAGDocument } from './RAGSystem';
import { logger } from '../../utils/logger';
import fs from 'fs/promises';
import path from 'path';

/**
 * Document Loader for RAG System
 * Loads medical documents from various sources
 */
export class DocumentLoader {
  /**
   * Load documents from JSON file
   */
  async loadFromJSON(filePath: string): Promise<RAGDocument[]> {
    try {
      logger.info('Loading documents from JSON', { filePath });

      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      const documents: RAGDocument[] = data.documents.map((doc: any) => ({
        id: doc.id,
        title: doc.title,
        content: doc.content,
        source: doc.source,
        credibility: doc.credibility || 0.8,
        lastVerified: new Date(doc.lastVerified || Date.now()),
        metadata: doc.metadata || {},
      }));

      logger.info(`Loaded ${documents.length} documents from JSON`);
      return documents;
    } catch (error) {
      logger.error('Failed to load documents from JSON', error);
      throw new Error('Failed to load documents');
    }
  }

  /**
   * Load sample medical guidelines
   */
  async loadSampleGuidelines(): Promise<RAGDocument[]> {
    return [
      {
        id: 'guideline_001',
        title: 'NCCN Guidelines for Lung Cancer Screening',
        content: `Lung cancer screening recommendations:
- Annual low-dose CT screening for adults aged 50-80 years
- 20 pack-year smoking history
- Currently smoke or have quit within the past 15 years
- Screening should be discontinued once a person has not smoked for 15 years
- Nodules >6mm require follow-up imaging
- Spiculated nodules are highly suspicious for malignancy`,
        source: 'CLINICAL_GUIDELINE',
        credibility: 0.95,
        lastVerified: new Date('2024-01-01'),
        metadata: {
          organization: 'NCCN',
          year: 2024,
          specialty: 'Oncology',
        },
      },
      {
        id: 'guideline_002',
        title: 'BI-RADS Classification for Breast Lesions',
        content: `BI-RADS categories for breast imaging:
- BI-RADS 0: Incomplete - Need additional imaging
- BI-RADS 1: Negative - No abnormality
- BI-RADS 2: Benign finding
- BI-RADS 3: Probably benign - Short interval follow-up suggested
- BI-RADS 4: Suspicious abnormality - Biopsy should be considered
- BI-RADS 5: Highly suggestive of malignancy - Appropriate action should be taken
- BI-RADS 6: Known biopsy-proven malignancy`,
        source: 'CLINICAL_GUIDELINE',
        credibility: 0.98,
        lastVerified: new Date('2024-01-01'),
        metadata: {
          organization: 'ACR',
          specialty: 'Radiology',
        },
      },
      {
        id: 'guideline_003',
        title: 'LI-RADS Classification for Liver Lesions',
        content: `LI-RADS categories for liver observations:
- LR-1: Definitely benign
- LR-2: Probably benign
- LR-3: Intermediate probability of malignancy
- LR-4: Probably hepatocellular carcinoma (HCC)
- LR-5: Definitely HCC
- LR-M: Probably or definitely malignant but not HCC specific
- LR-TIV: Tumor in vein`,
        source: 'CLINICAL_GUIDELINE',
        credibility: 0.97,
        lastVerified: new Date('2024-01-01'),
        metadata: {
          organization: 'ACR',
          specialty: 'Radiology',
        },
      },
      {
        id: 'protocol_001',
        title: 'Hospital Protocol for Oncology Referrals',
        content: `Oncology referral criteria:
- Any confirmed malignancy requires oncology consultation within 2 weeks
- Suspicious lesions with high cancer risk (BI-RADS 5, LI-RADS 5) require urgent referral
- Patients with multiple risk factors should be referred for screening
- Referral should include complete medical history, imaging reports, and biopsy results if available`,
        source: 'HOSPITAL_PROTOCOL',
        credibility: 0.90,
        lastVerified: new Date('2024-01-01'),
        metadata: {
          department: 'Oncology',
          hospital: 'Sample Hospital',
        },
      },
      {
        id: 'guideline_004',
        title: 'Indian Guidelines for Diabetes Management',
        content: `Diabetes management recommendations for Indian population:
- HbA1c target <7% for most adults
- Fasting plasma glucose 80-130 mg/dL
- Postprandial glucose <180 mg/dL
- Annual screening for complications (retinopathy, nephropathy, neuropathy)
- Lifestyle modifications: diet, exercise, weight management
- Metformin as first-line therapy unless contraindicated`,
        source: 'CLINICAL_GUIDELINE',
        credibility: 0.92,
        lastVerified: new Date('2024-01-01'),
        metadata: {
          organization: 'RSSDI',
          country: 'India',
          specialty: 'Endocrinology',
        },
      },
    ];
  }

  /**
   * Save documents to JSON file
   */
  async saveToJSON(documents: RAGDocument[], filePath: string): Promise<void> {
    try {
      const data = {
        documents: documents.map((doc) => ({
          ...doc,
          embedding: undefined, // Don't save embeddings to JSON
        })),
        exportedAt: new Date().toISOString(),
      };

      await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
      logger.info(`Saved ${documents.length} documents to JSON`, { filePath });
    } catch (error) {
      logger.error('Failed to save documents to JSON', error);
      throw new Error('Failed to save documents');
    }
  }

  /**
   * Load documents from directory
   */
  async loadFromDirectory(dirPath: string): Promise<RAGDocument[]> {
    try {
      logger.info('Loading documents from directory', { dirPath });

      const files = await fs.readdir(dirPath);
      const documents: RAGDocument[] = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(dirPath, file);
          const docs = await this.loadFromJSON(filePath);
          documents.push(...docs);
        }
      }

      logger.info(`Loaded ${documents.length} documents from directory`);
      return documents;
    } catch (error) {
      logger.error('Failed to load documents from directory', error);
      throw new Error('Failed to load documents from directory');
    }
  }
}

export const documentLoader = new DocumentLoader();

import { logger } from '../../utils/logger';

export interface OntologyMapping {
  originalTerm: string;
  snomedCT?: {
    code: string;
    description: string;
    hierarchy: string[];
  };
  icd10?: {
    code: string;
    description: string;
  };
  loinc?: {
    code: string;
    description: string;
    component: string;
  };
}

export interface NormalizedEntity {
  text: string;
  type: 'DISEASE' | 'MEDICATION' | 'PROCEDURE' | 'LAB_VALUE' | 'SYMPTOM';
  snomedCode?: string;
  icd10Code?: string;
  loincCode?: string;
  confidence: number;
}

/**
 * Medical Ontology Service
 * Maps medical terms to standard ontologies (SNOMED CT, ICD-10, LOINC)
 */
export class MedicalOntology {
  private snomedMap: Map<string, any> = new Map();
  private icd10Map: Map<string, any> = new Map();
  private loincMap: Map<string, any> = new Map();
  private termIndex: Map<string, string[]> = new Map(); // term -> [snomed, icd10, loinc]

  constructor() {
    this.initializeOntologies();
  }

  /**
   * Initialize ontology mappings
   */
  private initializeOntologies(): void {
    logger.info('Initializing medical ontologies...');

    // Load sample SNOMED CT codes
    this.loadSNOMEDCT();

    // Load sample ICD-10 codes
    this.loadICD10();

    // Load sample LOINC codes
    this.loadLOINC();

    // Build term index for fast lookup
    this.buildTermIndex();

    logger.info('Medical ontologies initialized');
  }

  /**
   * Map entity to ontology codes
   */
  mapEntity(term: string, type?: string): OntologyMapping {
    const normalizedTerm = this.normalizeTerm(term);
    const codes = this.termIndex.get(normalizedTerm) || [];

    const mapping: OntologyMapping = {
      originalTerm: term,
    };

    // Get SNOMED CT mapping
    if (codes[0]) {
      mapping.snomedCT = this.snomedMap.get(codes[0]);
    }

    // Get ICD-10 mapping
    if (codes[1]) {
      mapping.icd10 = this.icd10Map.get(codes[1]);
    }

    // Get LOINC mapping
    if (codes[2]) {
      mapping.loinc = this.loincMap.get(codes[2]);
    }

    return mapping;
  }

  /**
   * Normalize entity with ontology codes
   */
  normalizeEntity(entity: {
    text: string;
    type: string;
    confidence?: number;
  }): NormalizedEntity {
    const mapping = this.mapEntity(entity.text, entity.type);

    return {
      text: entity.text,
      type: entity.type as any,
      snomedCode: mapping.snomedCT?.code,
      icd10Code: mapping.icd10?.code,
      loincCode: mapping.loinc?.code,
      confidence: entity.confidence || 0.8,
    };
  }

  /**
   * Fuzzy match for ambiguous terms
   */
  fuzzyMatch(term: string, maxResults: number = 5): OntologyMapping[] {
    const normalizedTerm = this.normalizeTerm(term);
    const matches: Array<{ term: string; score: number }> = [];

    // Calculate similarity scores
    for (const [indexedTerm] of this.termIndex.entries()) {
      const score = this.calculateSimilarity(normalizedTerm, indexedTerm);
      if (score > 0.6) {
        matches.push({ term: indexedTerm, score });
      }
    }

    // Sort by score and take top results
    matches.sort((a, b) => b.score - a.score);
    const topMatches = matches.slice(0, maxResults);

    return topMatches.map((match) => this.mapEntity(match.term));
  }

  /**
   * Get SNOMED CT code
   */
  getSNOMEDCode(term: string): string | null {
    const mapping = this.mapEntity(term);
    return mapping.snomedCT?.code || null;
  }

  /**
   * Get ICD-10 code
   */
  getICD10Code(term: string): string | null {
    const mapping = this.mapEntity(term);
    return mapping.icd10?.code || null;
  }

  /**
   * Get LOINC code
   */
  getLOINCCode(term: string): string | null {
    const mapping = this.mapEntity(term);
    return mapping.loinc?.code || null;
  }

  /**
   * Normalize term for matching
   */
  private normalizeTerm(term: string): string {
    return term.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
  }

  /**
   * Calculate similarity between terms (simple Levenshtein-based)
   */
  private calculateSimilarity(term1: string, term2: string): number {
    const len1 = term1.length;
    const len2 = term2.length;

    if (len1 === 0) return len2 === 0 ? 1 : 0;
    if (len2 === 0) return 0;

    // Simple similarity: common prefix + common words
    let commonPrefix = 0;
    for (let i = 0; i < Math.min(len1, len2); i++) {
      if (term1[i] === term2[i]) commonPrefix++;
      else break;
    }

    const words1 = new Set(term1.split(/\s+/));
    const words2 = new Set(term2.split(/\s+/));
    const commonWords = [...words1].filter((w) => words2.has(w)).length;

    const prefixScore = commonPrefix / Math.max(len1, len2);
    const wordScore = commonWords / Math.max(words1.size, words2.size);

    return (prefixScore + wordScore) / 2;
  }

  /**
   * Load SNOMED CT codes
   */
  private loadSNOMEDCT(): void {
    const snomedData = [
      {
        code: '254637007',
        description: 'Non-small cell lung cancer',
        hierarchy: ['Neoplasm', 'Malignant neoplasm', 'Lung cancer'],
        terms: ['non-small cell lung cancer', 'nsclc', 'lung cancer'],
      },
      {
        code: '13645005',
        description: 'Chronic obstructive pulmonary disease',
        hierarchy: ['Respiratory disease', 'Chronic lung disease'],
        terms: ['copd', 'chronic obstructive pulmonary disease', 'emphysema'],
      },
      {
        code: '73211009',
        description: 'Diabetes mellitus',
        hierarchy: ['Endocrine disease', 'Metabolic disease'],
        terms: ['diabetes', 'diabetes mellitus', 'dm'],
      },
      {
        code: '38341003',
        description: 'Hypertension',
        hierarchy: ['Cardiovascular disease'],
        terms: ['hypertension', 'high blood pressure', 'htn'],
      },
      {
        code: '49436004',
        description: 'Atrial fibrillation',
        hierarchy: ['Cardiovascular disease', 'Arrhythmia'],
        terms: ['atrial fibrillation', 'afib', 'af'],
      },
      {
        code: '22298006',
        description: 'Myocardial infarction',
        hierarchy: ['Cardiovascular disease', 'Ischemic heart disease'],
        terms: ['myocardial infarction', 'heart attack', 'mi'],
      },
      {
        code: '233604007',
        description: 'Pneumonia',
        hierarchy: ['Respiratory disease', 'Infection'],
        terms: ['pneumonia', 'lung infection'],
      },
    ];

    for (const item of snomedData) {
      this.snomedMap.set(item.code, {
        code: item.code,
        description: item.description,
        hierarchy: item.hierarchy,
      });

      // Index all terms
      for (const term of item.terms) {
        const normalized = this.normalizeTerm(term);
        const existing = this.termIndex.get(normalized) || [];
        existing[0] = item.code;
        this.termIndex.set(normalized, existing);
      }
    }

    logger.debug(`Loaded ${snomedData.length} SNOMED CT codes`);
  }

  /**
   * Load ICD-10 codes
   */
  private loadICD10(): void {
    const icd10Data = [
      { code: 'C34.9', description: 'Malignant neoplasm of bronchus and lung, unspecified', terms: ['lung cancer'] },
      { code: 'J44.9', description: 'Chronic obstructive pulmonary disease, unspecified', terms: ['copd'] },
      { code: 'E11.9', description: 'Type 2 diabetes mellitus without complications', terms: ['diabetes', 'diabetes mellitus'] },
      { code: 'I10', description: 'Essential (primary) hypertension', terms: ['hypertension'] },
      { code: 'I48.91', description: 'Unspecified atrial fibrillation', terms: ['atrial fibrillation', 'afib'] },
      { code: 'I21.9', description: 'Acute myocardial infarction, unspecified', terms: ['myocardial infarction', 'heart attack'] },
      { code: 'J18.9', description: 'Pneumonia, unspecified organism', terms: ['pneumonia'] },
    ];

    for (const item of icd10Data) {
      this.icd10Map.set(item.code, {
        code: item.code,
        description: item.description,
      });

      // Index all terms
      for (const term of item.terms) {
        const normalized = this.normalizeTerm(term);
        const existing = this.termIndex.get(normalized) || [];
        existing[1] = item.code;
        this.termIndex.set(normalized, existing);
      }
    }

    logger.debug(`Loaded ${icd10Data.length} ICD-10 codes`);
  }

  /**
   * Load LOINC codes
   */
  private loadLOINC(): void {
    const loincData = [
      { code: '2345-7', description: 'Glucose [Mass/volume] in Serum or Plasma', component: 'Glucose', terms: ['glucose', 'blood sugar'] },
      { code: '2160-0', description: 'Creatinine [Mass/volume] in Serum or Plasma', component: 'Creatinine', terms: ['creatinine'] },
      { code: '4548-4', description: 'Hemoglobin A1c/Hemoglobin.total in Blood', component: 'HbA1c', terms: ['hba1c', 'hemoglobin a1c'] },
      { code: '2085-9', description: 'Cholesterol in HDL [Mass/volume] in Serum or Plasma', component: 'HDL', terms: ['hdl', 'hdl cholesterol'] },
      { code: '2089-1', description: 'Cholesterol in LDL [Mass/volume] in Serum or Plasma', component: 'LDL', terms: ['ldl', 'ldl cholesterol'] },
      { code: '6690-2', description: 'Leukocytes [#/volume] in Blood by Automated count', component: 'WBC', terms: ['wbc', 'white blood cell count'] },
    ];

    for (const item of loincData) {
      this.loincMap.set(item.code, {
        code: item.code,
        description: item.description,
        component: item.component,
      });

      // Index all terms
      for (const term of item.terms) {
        const normalized = this.normalizeTerm(term);
        const existing = this.termIndex.get(normalized) || [];
        existing[2] = item.code;
        this.termIndex.set(normalized, existing);
      }
    }

    logger.debug(`Loaded ${loincData.length} LOINC codes`);
  }

  /**
   * Build term index
   */
  private buildTermIndex(): void {
    // Already built during loading
    logger.debug(`Term index built with ${this.termIndex.size} entries`);
  }

  /**
   * Get statistics
   */
  getStats(): {
    snomedCount: number;
    icd10Count: number;
    loincCount: number;
    indexedTerms: number;
  } {
    return {
      snomedCount: this.snomedMap.size,
      icd10Count: this.icd10Map.size,
      loincCount: this.loincMap.size,
      indexedTerms: this.termIndex.size,
    };
  }
}

// Singleton instance
export const medicalOntology = new MedicalOntology();

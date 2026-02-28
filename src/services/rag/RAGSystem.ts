import { clinicalLLM, Embedding } from '../llm';
import { logger } from '../../utils/logger';

export interface RAGDocument {
  id: string;
  title: string;
  content: string;
  source: 'CLINICAL_GUIDELINE' | 'MEDICAL_TEXTBOOK' | 'RESEARCH_PAPER' | 'HOSPITAL_PROTOCOL';
  credibility: number;
  lastVerified: Date;
  embedding?: Embedding;
  metadata?: Record<string, any>;
}

export interface RAGQuery {
  query: string;
  topK: number;
  filters?: {
    source?: string[];
    minCredibility?: number;
  };
}

export interface RAGResult {
  documents: RAGDocument[];
  relevanceScores: number[];
  totalResults: number;
}

export interface RAGValidation {
  statement: string;
  supportingDocuments: RAGDocument[];
  relevanceScore: number;
  verified: boolean;
}

/**
 * Retrieval-Augmented Generation System
 * Validates AI outputs against hospital-approved medical sources
 */
export class RAGSystem {
  private documents: Map<string, RAGDocument> = new Map();
  private vectorStore: Map<string, number[]> = new Map();
  private isInitialized: boolean = false;

  constructor() {
    logger.info('RAG System initializing...');
  }

  /**
   * Initialize RAG system with documents
   */
  async initialize(documents: RAGDocument[]): Promise<void> {
    try {
      logger.info(`Initializing RAG system with ${documents.length} documents`);

      for (const doc of documents) {
        // Generate embedding if not provided
        if (!doc.embedding) {
          doc.embedding = await clinicalLLM.embed(doc.content);
        }

        this.documents.set(doc.id, doc);
        this.vectorStore.set(doc.id, doc.embedding.vector);
      }

      this.isInitialized = true;
      logger.info('RAG System initialized successfully');
    } catch (error) {
      logger.error('RAG System initialization failed', error);
      throw new Error('Failed to initialize RAG system');
    }
  }

  /**
   * Query RAG system for relevant documents
   */
  async query(ragQuery: RAGQuery): Promise<RAGResult> {
    if (!this.isInitialized) {
      throw new Error('RAG System not initialized');
    }

    try {
      logger.debug('RAG query', { query: ragQuery.query, topK: ragQuery.topK });

      // Generate query embedding
      const queryEmbedding = await clinicalLLM.embed(ragQuery.query);

      // Calculate similarity scores
      const scores: Array<{ id: string; score: number }> = [];

      for (const [id, vector] of this.vectorStore.entries()) {
        const doc = this.documents.get(id);
        
        // Apply filters
        if (ragQuery.filters) {
          if (ragQuery.filters.source && !ragQuery.filters.source.includes(doc!.source)) {
            continue;
          }
          if (ragQuery.filters.minCredibility && doc!.credibility < ragQuery.filters.minCredibility) {
            continue;
          }
        }

        const score = this.cosineSimilarity(queryEmbedding.vector, vector);
        scores.push({ id, score });
      }

      // Sort by score and take top K
      scores.sort((a, b) => b.score - a.score);
      const topResults = scores.slice(0, ragQuery.topK);

      const documents = topResults.map((r) => this.documents.get(r.id)!);
      const relevanceScores = topResults.map((r) => r.score);

      logger.info('RAG query completed', { resultsCount: documents.length });

      return {
        documents,
        relevanceScores,
        totalResults: scores.length,
      };
    } catch (error) {
      logger.error('RAG query failed', error);
      throw new Error('Failed to query RAG system');
    }
  }

  /**
   * Validate a medical statement against RAG documents
   */
  async validateStatement(statement: string): Promise<RAGValidation> {
    try {
      logger.debug('Validating statement', { statementLength: statement.length });

      const result = await this.query({
        query: statement,
        topK: 5,
        filters: { minCredibility: 0.7 },
      });

      // Consider verified if top result has high relevance
      const topScore = result.relevanceScores[0] || 0;
      const verified = topScore > 0.75;

      return {
        statement,
        supportingDocuments: result.documents,
        relevanceScore: topScore,
        verified,
      };
    } catch (error) {
      logger.error('Statement validation failed', error);
      throw new Error('Failed to validate statement');
    }
  }

  /**
   * Add a new document to RAG system
   */
  async addDocument(doc: RAGDocument): Promise<void> {
    try {
      // Validate document
      if (!this.isHospitalApproved(doc)) {
        throw new Error('Document must be from hospital-approved source');
      }

      // Generate embedding
      if (!doc.embedding) {
        doc.embedding = await clinicalLLM.embed(doc.content);
      }

      this.documents.set(doc.id, doc);
      this.vectorStore.set(doc.id, doc.embedding.vector);

      logger.info('Document added to RAG system', { id: doc.id, source: doc.source });
    } catch (error) {
      logger.error('Failed to add document', error);
      throw error;
    }
  }

  /**
   * Remove a document from RAG system
   */
  removeDocument(id: string): boolean {
    const removed = this.documents.delete(id) && this.vectorStore.delete(id);
    
    if (removed) {
      logger.info('Document removed from RAG system', { id });
    }

    return removed;
  }

  /**
   * Get document by ID
   */
  getDocument(id: string): RAGDocument | undefined {
    return this.documents.get(id);
  }

  /**
   * Get all documents
   */
  getAllDocuments(): RAGDocument[] {
    return Array.from(this.documents.values());
  }

  /**
   * Get documents by source
   */
  getDocumentsBySource(source: RAGDocument['source']): RAGDocument[] {
    return Array.from(this.documents.values()).filter((doc) => doc.source === source);
  }

  /**
   * Update document credibility
   */
  updateCredibility(id: string, credibility: number): void {
    const doc = this.documents.get(id);
    
    if (doc) {
      doc.credibility = Math.max(0, Math.min(1, credibility));
      logger.info('Document credibility updated', { id, credibility: doc.credibility });
    }
  }

  /**
   * Check if document is from hospital-approved source
   */
  private isHospitalApproved(doc: RAGDocument): boolean {
    const approvedSources: RAGDocument['source'][] = [
      'CLINICAL_GUIDELINE',
      'MEDICAL_TEXTBOOK',
      'RESEARCH_PAPER',
      'HOSPITAL_PROTOCOL',
    ];

    return approvedSources.includes(doc.source) && doc.credibility >= 0.5;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Get RAG system statistics
   */
  getStats(): {
    totalDocuments: number;
    documentsBySource: Record<string, number>;
    averageCredibility: number;
    isInitialized: boolean;
  } {
    const docs = Array.from(this.documents.values());
    const documentsBySource: Record<string, number> = {};

    for (const doc of docs) {
      documentsBySource[doc.source] = (documentsBySource[doc.source] || 0) + 1;
    }

    const averageCredibility =
      docs.length > 0 ? docs.reduce((sum, doc) => sum + doc.credibility, 0) / docs.length : 0;

    return {
      totalDocuments: docs.length,
      documentsBySource,
      averageCredibility,
      isInitialized: this.isInitialized,
    };
  }
}

// Singleton instance
export const ragSystem = new RAGSystem();

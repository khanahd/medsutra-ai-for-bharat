import { logger } from '../../utils/logger';

export interface LLMConfig {
  apiKey: string;
  model: string;
  endpoint: string;
  timeout: number;
  maxRetries: number;
}

export interface Embedding {
  vector: number[];
  dimension: number;
  model: string;
}

export interface Classification {
  label: string;
  confidence: number;
  alternatives: Array<{ label: string; confidence: number }>;
}

export interface ModelMetadata {
  modelId: string;
  version: string;
  trainingDatasets: string[];
  demographicComposition: {
    ageDistribution: Record<string, number>;
    genderDistribution: Record<string, number>;
    ethnicityDistribution: Record<string, number>;
    regionDistribution: Record<string, number>;
  };
  performanceMetrics: {
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
    demographicParity: Record<string, number>;
  };
  lastUpdated: Date;
}

/**
 * Clinical LLM Service
 * Integrates with fine-tuned medical LLM for clinical text processing
 */
export class ClinicalLLM {
  private config: LLMConfig;
  private metadata: ModelMetadata;

  constructor(config?: Partial<LLMConfig>) {
    this.config = {
      apiKey: config?.apiKey || process.env.LLM_API_KEY || '',
      model: config?.model || process.env.LLM_MODEL || 'gpt-4',
      endpoint: config?.endpoint || process.env.LLM_ENDPOINT || 'https://api.openai.com/v1',
      timeout: config?.timeout || parseInt(process.env.REQUEST_TIMEOUT_MS || '30000'),
      maxRetries: config?.maxRetries || 3,
    };

    if (!this.config.apiKey) {
      logger.warn('LLM API key not configured. LLM features will be disabled.');
    }

    // Initialize metadata (would be loaded from model registry in production)
    this.metadata = this.initializeMetadata();

    logger.info(`Clinical LLM initialized with model: ${this.config.model}`);
  }

  /**
   * Initialize model metadata
   */
  private initializeMetadata(): ModelMetadata {
    return {
      modelId: this.config.model,
      version: '1.0.0',
      trainingDatasets: ['MIMIC-III', 'MIMIC-IV', 'ICMR-India'],
      demographicComposition: {
        ageDistribution: { '0-18': 0.15, '19-40': 0.30, '41-65': 0.35, '65+': 0.20 },
        genderDistribution: { male: 0.48, female: 0.50, other: 0.02 },
        ethnicityDistribution: { indian: 0.70, other: 0.30 },
        regionDistribution: { north: 0.25, south: 0.25, east: 0.25, west: 0.25 },
      },
      performanceMetrics: {
        accuracy: 0.92,
        precision: 0.90,
        recall: 0.89,
        f1Score: 0.895,
        demographicParity: { overall: 0.95 },
      },
      lastUpdated: new Date(),
    };
  }

  /**
   * Generate text using the clinical LLM
   */
  async generateText(prompt: string, context: string[] = []): Promise<string> {
    const startTime = Date.now();

    try {
      logger.debug('Generating text with LLM', { promptLength: prompt.length, contextCount: context.length });

      // Check cache first
      const { textGenerationCache } = await import('./LLMCache');
      const cached = textGenerationCache.get(prompt, context);
      if (cached) {
        logger.debug('Using cached LLM response');
        return cached;
      }

      // Build full prompt with context
      const fullPrompt = this.buildPrompt(prompt, context);

      // Call LLM API (OpenAI-compatible)
      const response = await this.callLLMAPI({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: 'You are a clinical AI assistant trained on medical data. Provide accurate, evidence-based medical information.',
          },
          {
            role: 'user',
            content: fullPrompt,
          },
        ],
        temperature: 0.3, // Lower temperature for more deterministic medical responses
        max_tokens: 2000,
      });

      const generatedText = response.choices[0]?.message?.content || '';
      const elapsed = Date.now() - startTime;

      // Cache the response
      textGenerationCache.set(prompt, generatedText, context);

      // Log performance
      const { llmMonitor } = await import('./LLMMonitor');
      llmMonitor.logOperation({
        timestamp: new Date(),
        operation: 'generate',
        latencyMs: elapsed,
        success: true,
        tokensUsed: response.usage?.total_tokens,
      });

      logger.info('Text generation completed', { elapsed, outputLength: generatedText.length });

      return generatedText;
    } catch (error) {
      const elapsed = Date.now() - startTime;
      
      // Log failure
      const { llmMonitor } = await import('./LLMMonitor');
      llmMonitor.logOperation({
        timestamp: new Date(),
        operation: 'generate',
        latencyMs: elapsed,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      logger.error('Text generation failed', error);
      throw new Error('Failed to generate text with LLM');
    }
  }

  /**
   * Generate embeddings for text
   */
  async embed(text: string): Promise<Embedding> {
    try {
      logger.debug('Generating embedding', { textLength: text.length });

      const response = await this.callLLMAPI(
        {
          model: 'text-embedding-ada-002', // Or your embedding model
          input: text,
        },
        '/embeddings'
      );

      const vector = response.data[0]?.embedding || [];

      return {
        vector,
        dimension: vector.length,
        model: 'text-embedding-ada-002',
      };
    } catch (error) {
      logger.error('Embedding generation failed', error);
      throw new Error('Failed to generate embedding');
    }
  }

  /**
   * Classify text into predefined labels
   */
  async classify(text: string, labels: string[]): Promise<Classification> {
    try {
      logger.debug('Classifying text', { textLength: text.length, labelCount: labels.length });

      const prompt = `Classify the following medical text into one of these categories: ${labels.join(', ')}\n\nText: ${text}\n\nProvide the classification and confidence score.`;

      const response = await this.generateText(prompt);

      // Parse response (simplified - would use structured output in production)
      const label = labels[0]; // Placeholder
      const confidence = 0.85; // Placeholder

      return {
        label,
        confidence,
        alternatives: labels.slice(1).map((l) => ({ label: l, confidence: 0.1 })),
      };
    } catch (error) {
      logger.error('Classification failed', error);
      throw new Error('Failed to classify text');
    }
  }

  /**
   * Extract structured data from text using a schema
   */
  async extractStructured(text: string, schema: Record<string, any>): Promise<Record<string, any>> {
    try {
      logger.debug('Extracting structured data', { textLength: text.length });

      const prompt = `Extract the following information from the medical text according to this schema:\n${JSON.stringify(schema, null, 2)}\n\nText: ${text}\n\nProvide the extracted data in JSON format.`;

      const response = await this.generateText(prompt);

      // Parse JSON response
      const extracted = JSON.parse(response);

      return extracted;
    } catch (error) {
      logger.error('Structured extraction failed', error);
      throw new Error('Failed to extract structured data');
    }
  }

  /**
   * Get model metadata
   */
  getMetadata(): ModelMetadata {
    return { ...this.metadata };
  }

  /**
   * Update model metadata (for tracking performance)
   */
  updateMetadata(updates: Partial<ModelMetadata>): void {
    this.metadata = {
      ...this.metadata,
      ...updates,
      lastUpdated: new Date(),
    };
    logger.info('Model metadata updated');
  }

  /**
   * Build full prompt with context
   */
  private buildPrompt(prompt: string, context: string[]): string {
    if (context.length === 0) {
      return prompt;
    }

    return `Context:\n${context.join('\n\n')}\n\nQuery: ${prompt}`;
  }

  /**
   * Call LLM API with retry logic
   */
  private async callLLMAPI(payload: any, endpoint: string = '/chat/completions'): Promise<any> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const url = `${this.config.endpoint}${endpoint}`;

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(this.config.timeout),
        });

        if (!response.ok) {
          throw new Error(`LLM API error: ${response.status} ${response.statusText}`);
        }

        return await response.json();
      } catch (error) {
        lastError = error as Error;
        logger.warn(`LLM API call failed (attempt ${attempt}/${this.config.maxRetries})`, error);

        if (attempt < this.config.maxRetries) {
          // Exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('LLM API call failed after retries');
  }

  /**
   * Health check for LLM service
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.generateText('Health check', []);
      return true;
    } catch {
      return false;
    }
  }
}

// Singleton instance
export const clinicalLLM = new ClinicalLLM();

/**
 * Google Provider Implementation
 * Supports Gemini embedding API
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { EmbeddingProvider, ModelInfo, GoogleConfig } from '../core/types';
import { logger } from '../utils/logger';

export class GoogleProvider implements EmbeddingProvider {
  private client: GoogleGenerativeAI;
  private model: string;
  private dimensions: number = 768; // Default for embedding-001

  constructor(config: GoogleConfig) {
    this.client = new GoogleGenerativeAI(config.apiKey);
    this.model = config.model;

    // Set expected dimensions based on model
    if (config.model === 'embedding-001') {
      this.dimensions = 768;
    } else if (config.model === 'text-embedding-004') {
      this.dimensions = 768;
    }
  }

  get name(): string {
    return `google-${this.model}`;
  }

  async embed(text: string): Promise<number[]> {
    const startTime = Date.now();

    try {
      const model = this.client.getGenerativeModel({ model: `models/${this.model}` });
      const result = await model.embedContent(text);
      const embedding = result.embedding.values;

      if (!embedding || !Array.isArray(embedding)) {
        throw new Error('Invalid embedding response from Google API');
      }

      // Update dimensions based on actual response
      this.dimensions = embedding.length;

      logger.debug(`Google embed: ${text.substring(0, 50)}... (${Date.now() - startTime}ms)`);

      return embedding;
    } catch (error) {
      logger.error(`Google embedding failed for model ${this.model}:`, error);
      throw error;
    }
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const startTime = Date.now();

    try {
      const model = this.client.getGenerativeModel({ model: `models/${this.model}` });
      
      // Google API supports batch embedding via embedContentBatch
      const results = await Promise.all(
        texts.map(text => model.embedContent(text))
      );

      const embeddings = results.map(result => {
        const embedding = result.embedding.values;
        if (!embedding || !Array.isArray(embedding)) {
          throw new Error('Invalid embedding in batch response from Google API');
        }
        return embedding;
      });

      logger.debug(`Google batch embed: ${texts.length} texts (${Date.now() - startTime}ms)`);

      return embeddings;
    } catch (error) {
      logger.error(`Google batch embedding failed for model ${this.model}:`, error);
      throw error;
    }
  }

  getModelInfo(): ModelInfo {
    return {
      name: this.model,
      dimensions: this.dimensions,
      maxTokens: 2048, // Gemini embedding limit
      provider: 'google',
    };
  }
}

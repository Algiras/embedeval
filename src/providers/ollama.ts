/**
 * Ollama Provider Implementation
 */

import { EmbeddingProvider, ModelInfo, OllamaConfig } from '../core/types';
import { logger } from '../utils/logger';

export class OllamaProvider implements EmbeddingProvider {
  private baseUrl: string;
  private model: string;
  private dimensions: number = 768; // Default, will be updated after first call

  constructor(config: OllamaConfig) {
    this.baseUrl = config.baseUrl;
    this.model = config.model;
  }

  get name(): string {
    return `ollama-${this.model}`;
  }

  async embed(text: string): Promise<number[]> {
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${this.baseUrl}/api/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          prompt: text,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const embedding = data.embedding;

      if (!embedding || !Array.isArray(embedding)) {
        throw new Error('Invalid embedding response from Ollama');
      }

      // Update dimensions based on actual response
      this.dimensions = embedding.length;

      logger.debug(`Ollama embed: ${text.substring(0, 50)}... (${Date.now() - startTime}ms)`);
      
      return embedding;
    } catch (error) {
      logger.error(`Ollama embedding failed for model ${this.model}:`, error);
      throw error;
    }
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    // Ollama doesn't have a native batch API, so we parallelize individual calls
    const batchSize = 5; // Limit concurrent requests
    const results: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(text => this.embed(text))
      );
      results.push(...batchResults);
    }

    return results;
  }

  getModelInfo(): ModelInfo {
    return {
      name: this.model,
      dimensions: this.dimensions,
      maxTokens: 8192, // Ollama default
      provider: 'ollama',
    };
  }
}

/**
 * OpenAI Provider Implementation
 * Supports custom routes (OpenRouter, etc.) via baseUrl parameter
 */

import { EmbeddingProvider, ModelInfo, OpenAIConfig } from '../core/types';
import { logger } from '../utils/logger';

export class OpenAIProvider implements EmbeddingProvider {
  private apiKey: string;
  private baseUrl: string;
  private model: string;
  private organization?: string;
  private dimensions: number = 1536; // Default for text-embedding-3-small

  constructor(config: OpenAIConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.openai.com/v1';
    this.model = config.model;
    this.organization = config.organization;

    // Set expected dimensions based on model
    if (config.model.includes('3-large')) {
      this.dimensions = 3072;
    } else if (config.model.includes('3-small')) {
      this.dimensions = 1536;
    } else if (config.model.includes('ada-002')) {
      this.dimensions = 1536;
    }
  }

  get name(): string {
    return `openai-${this.model}`;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };

    if (this.organization) {
      headers['OpenAI-Organization'] = this.organization;
    }

    return headers;
  }

  async embed(text: string): Promise<number[]> {
    const startTime = Date.now();

    try {
      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          model: this.model,
          input: text,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as { error?: { message?: string } };
        const errorMessage = errorData.error?.message || `HTTP ${response.status}`;
        throw new Error(`OpenAI API error: ${errorMessage}`);
      }

      const data = await response.json() as { data?: Array<{ embedding?: number[] }> };
      const embedding = data.data?.[0]?.embedding;

      if (!embedding || !Array.isArray(embedding)) {
        throw new Error('Invalid embedding response from OpenAI API');
      }

      // Update dimensions based on actual response
      this.dimensions = embedding.length;

      logger.debug(`OpenAI embed: ${text.substring(0, 50)}... (${Date.now() - startTime}ms)`);

      return embedding;
    } catch (error) {
      logger.error(`OpenAI embedding failed for model ${this.model}:`, error);
      throw error;
    }
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const startTime = Date.now();

    try {
      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          model: this.model,
          input: texts,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as { error?: { message?: string } };
        const errorMessage = errorData.error?.message || `HTTP ${response.status}`;
        throw new Error(`OpenAI API error: ${errorMessage}`);
      }

      const data = await response.json() as { data?: Array<{ embedding?: number[] }> };
      const embeddings = data.data?.map((item: any) => item.embedding);

      if (!embeddings || !Array.isArray(embeddings)) {
        throw new Error('Invalid batch embedding response from OpenAI API');
      }

      logger.debug(`OpenAI batch embed: ${texts.length} texts (${Date.now() - startTime}ms)`);

      return embeddings;
    } catch (error) {
      logger.error(`OpenAI batch embedding failed for model ${this.model}:`, error);
      throw error;
    }
  }

  getModelInfo(): ModelInfo {
    return {
      name: this.model,
      dimensions: this.dimensions,
      maxTokens: 8191, // OpenAI embedding limit
      provider: 'openai',
    };
  }
}

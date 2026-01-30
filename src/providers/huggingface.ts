/**
 * Hugging Face Provider Implementation
 * Supports loading embedding models from Hugging Face Hub
 */

import { EmbeddingProvider, ModelInfo, HuggingFaceConfig } from '../core/types';
import { logger } from '../utils/logger';

export class HuggingFaceProvider implements EmbeddingProvider {
  private apiKey?: string;
  private model: string;
  private endpoint?: string;
  private dimensions: number = 768;
  private useInferenceAPI: boolean;

  constructor(config: HuggingFaceConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.endpoint = config.endpoint;
    this.useInferenceAPI = config.useInferenceAPI ?? true;
  }

  get name(): string {
    return `hf-${this.model.replace(/\//g, '-')}`;
  }

  async embed(text: string): Promise<number[]> {
    const startTime = Date.now();

    try {
      let embedding: number[];

      if (this.useInferenceAPI && this.apiKey) {
        // Use Hugging Face Inference API
        embedding = await this.embedViaAPI(text);
      } else if (this.endpoint) {
        // Use custom endpoint (e.g., local TGI, TEI, or HF Inference Endpoints)
        embedding = await this.embedViaEndpoint(text);
      } else {
        throw new Error('Hugging Face provider requires either apiKey (for Inference API) or endpoint (for custom deployment)');
      }

      this.dimensions = embedding.length;

      logger.debug(`HF embed: ${text.substring(0, 50)}... (${Date.now() - startTime}ms)`);

      return embedding;
    } catch (error) {
      logger.error(`Hugging Face embedding failed for model ${this.model}:`, error);
      throw error;
    }
  }

  private async embedViaAPI(text: string): Promise<number[]> {
    const response = await fetch(
      `https://api-inference.huggingface.co/pipeline/feature-extraction/${this.model}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: text,
          options: {
            wait_for_model: true,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Hugging Face API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    // Handle different response formats
    if (Array.isArray(data) && Array.isArray(data[0])) {
      return data[0]; // [[0.1, 0.2, ...]] format
    } else if (Array.isArray(data)) {
      return data; // [0.1, 0.2, ...] format
    } else {
      throw new Error('Unexpected response format from Hugging Face API');
    }
  }

  private async embedViaEndpoint(text: string): Promise<number[]> {
    const response = await fetch(`${this.endpoint}/embed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` }),
      },
      body: JSON.stringify({
        text,
        model: this.model,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Endpoint error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.embedding || data;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    // Hugging Face Inference API supports batching
    if (this.useInferenceAPI && this.apiKey) {
      const response = await fetch(
        `https://api-inference.huggingface.co/pipeline/feature-extraction/${this.model}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            inputs: texts,
            options: {
              wait_for_model: true,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Hugging Face API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      // Handle different response formats
      if (Array.isArray(data) && Array.isArray(data[0]) && Array.isArray(data[0][0])) {
        return data.map((item: any) => item[0]); // [[[...]], [[...]]] format
      } else if (Array.isArray(data) && Array.isArray(data[0])) {
        return data; // [[...], [...]] format
      } else {
        throw new Error('Unexpected batch response format from Hugging Face API');
      }
    }

    // Fallback to individual calls
    return Promise.all(texts.map(text => this.embed(text)));
  }

  getModelInfo(): ModelInfo {
    return {
      name: this.model,
      dimensions: this.dimensions,
      maxTokens: 512, // HF models vary, this is a safe default
      provider: 'huggingface',
    };
  }
}

/**
 * Search Hugging Face Hub for embedding models
 */
export async function searchHuggingFaceModels(
  query: string = 'sentence-transformers',
  limit: number = 20,
  apiKey?: string
): Promise<HuggingFaceModel[]> {
  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };
  
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  // Search for models with embeddings tag
  const response = await fetch(
    `https://huggingface.co/api/models?search=${encodeURIComponent(query)}&filter=embeddings&limit=${limit}&sort=downloads&direction=-1`,
    { headers }
  );

  if (!response.ok) {
    throw new Error(`Failed to search Hugging Face: ${response.status}`);
  }

  const models = await response.json();
  
  return models.map((model: any) => ({
    id: model.id,
    name: model.modelId || model.id,
    description: model.description || '',
    downloads: model.downloads || 0,
    likes: model.likes || 0,
    tags: model.tags || [],
    pipeline_tag: model.pipeline_tag,
  }));
}

/**
 * Get detailed info about a specific model
 */
export async function getHuggingFaceModelInfo(
  modelId: string,
  apiKey?: string
): Promise<HuggingFaceModelDetails> {
  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };
  
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const response = await fetch(
    `https://huggingface.co/api/models/${modelId}`,
    { headers }
  );

  if (!response.ok) {
    throw new Error(`Failed to get model info: ${response.status}`);
  }

  const model = await response.json();
  
  return {
    id: model.id,
    name: model.modelId || model.id,
    description: model.description || '',
    downloads: model.downloads || 0,
    likes: model.likes || 0,
    tags: model.tags || [],
    pipeline_tag: model.pipeline_tag,
    config: model.config,
    siblings: model.siblings?.map((s: any) => s.rfilename) || [],
  };
}

export interface HuggingFaceModel {
  id: string;
  name: string;
  description: string;
  downloads: number;
  likes: number;
  tags: string[];
  pipeline_tag?: string;
}

export interface HuggingFaceModelDetails extends HuggingFaceModel {
  config?: any;
  siblings: string[];
}

/**
 * Provider implementations for embedding services
 */

import { EmbeddingProvider, ModelInfo, ProviderConfig } from '../core/types';
import { OllamaProvider } from './ollama';
import { OpenAIProvider } from './openai';
import { GoogleProvider } from './google';
import { HuggingFaceProvider } from './huggingface';
import { logger } from '../utils/logger';

export { OllamaProvider, OpenAIProvider, GoogleProvider, HuggingFaceProvider };

/**
 * Factory function to create provider instances
 */
export function createProvider(config: ProviderConfig): EmbeddingProvider {
  switch (config.type) {
    case 'ollama':
      return new OllamaProvider(config);
    case 'openai':
      return new OpenAIProvider(config);
    case 'google':
      return new GoogleProvider(config);
    case 'huggingface':
      return new HuggingFaceProvider(config);
    default:
      throw new Error(`Unknown provider type: ${(config as any).type}`);
  }
}

/**
 * Test provider connectivity
 */
export async function testProvider(config: ProviderConfig): Promise<{
  success: boolean;
  error?: string;
  modelInfo?: ModelInfo;
}> {
  try {
    const provider = createProvider(config);
    const modelInfo = provider.getModelInfo();
    
    // Test embedding a simple string
    const testEmbedding = await provider.embed('test');
    
    if (!testEmbedding || testEmbedding.length === 0) {
      throw new Error('Provider returned empty embedding');
    }

    logger.info(`Provider test successful: ${modelInfo.provider}/${modelInfo.name}`);
    
    return {
      success: true,
      modelInfo,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Provider test failed:`, error);
    
    return {
      success: false,
      error: errorMessage,
    };
  }
}

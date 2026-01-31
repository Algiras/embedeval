/**
 * Health Check - Validate API keys by making test requests
 */

import { ProviderName } from './types.js';
import { logger } from '../utils/logger.js';

export interface HealthCheckResult {
  provider: ProviderName;
  healthy: boolean;
  latency?: number;
  error?: string;
  details?: {
    models?: number;
    plan?: string;
    quota?: string;
  };
}

/**
 * Validate API key by making a test request
 */
export async function validateApiKey(
  provider: ProviderName,
  apiKey: string
): Promise<HealthCheckResult> {
  const startTime = Date.now();
  
  const validators: Record<ProviderName, () => Promise<HealthCheckResult>> = {
    gemini: async () => {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
        );
        const latency = Date.now() - startTime;
        
        if (!response.ok) {
          const error = await response.text();
          return {
            provider: 'gemini',
            healthy: false,
            latency,
            error: response.status === 401 ? 'Invalid API key' : `HTTP ${response.status}: ${error}`,
          };
        }
        
        const data = await response.json() as { models?: unknown[] };
        return {
          provider: 'gemini',
          healthy: true,
          latency,
          details: {
            models: data.models?.length || 0,
          },
        };
      } catch (err) {
        return {
          provider: 'gemini',
          healthy: false,
          latency: Date.now() - startTime,
          error: err instanceof Error ? err.message : 'Connection failed',
        };
      }
    },

    openai: async () => {
      try {
        const response = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        const latency = Date.now() - startTime;
        
        if (!response.ok) {
          return {
            provider: 'openai',
            healthy: false,
            latency,
            error: response.status === 401 ? 'Invalid API key' : `HTTP ${response.status}`,
          };
        }
        
        const data = await response.json() as { data?: unknown[] };
        return {
          provider: 'openai',
          healthy: true,
          latency,
          details: {
            models: data.data?.length || 0,
          },
        };
      } catch (err) {
        return {
          provider: 'openai',
          healthy: false,
          latency: Date.now() - startTime,
          error: err instanceof Error ? err.message : 'Connection failed',
        };
      }
    },

    openrouter: async () => {
      try {
        // First check models endpoint
        const modelsResponse = await fetch('https://openrouter.ai/api/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        
        // Then check auth/key endpoint for account info
        const authResponse = await fetch('https://openrouter.ai/api/v1/auth/key', {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        
        const latency = Date.now() - startTime;
        
        if (!modelsResponse.ok) {
          return {
            provider: 'openrouter',
            healthy: false,
            latency,
            error: modelsResponse.status === 401 ? 'Invalid API key' : `HTTP ${modelsResponse.status}`,
          };
        }
        
        let details: HealthCheckResult['details'] = {};
        const modelsData = await modelsResponse.json() as { data?: unknown[] };
        details.models = modelsData.data?.length || 0;
        
        if (authResponse.ok) {
          const authData = await authResponse.json() as { data?: { label?: string; limit?: number; usage?: number } };
          if (authData.data) {
            details.plan = authData.data.label || 'Unknown';
            if (authData.data.limit) {
              const used = authData.data.usage || 0;
              details.quota = `$${used.toFixed(2)} / $${authData.data.limit.toFixed(2)}`;
            }
          }
        }
        
        return {
          provider: 'openrouter',
          healthy: true,
          latency,
          details,
        };
      } catch (err) {
        return {
          provider: 'openrouter',
          healthy: false,
          latency: Date.now() - startTime,
          error: err instanceof Error ? err.message : 'Connection failed',
        };
      }
    },

    anthropic: async () => {
      try {
        // Anthropic doesn't have a simple models endpoint, so we check with a minimal message
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'hi' }],
          }),
        });
        const latency = Date.now() - startTime;
        
        if (response.status === 401) {
          return {
            provider: 'anthropic',
            healthy: false,
            latency,
            error: 'Invalid API key',
          };
        }
        
        // 200 = valid, 429 = rate limited (but key is valid), 400 = bad request (key might be valid)
        const isHealthy = response.status === 200 || response.status === 429;
        
        return {
          provider: 'anthropic',
          healthy: isHealthy,
          latency,
          error: isHealthy ? undefined : `HTTP ${response.status}`,
        };
      } catch (err) {
        return {
          provider: 'anthropic',
          healthy: false,
          latency: Date.now() - startTime,
          error: err instanceof Error ? err.message : 'Connection failed',
        };
      }
    },

    ollama: async () => {
      try {
        // For Ollama, the "key" is actually the host URL
        const host = apiKey || 'http://localhost:11434';
        const response = await fetch(`${host}/api/tags`);
        const latency = Date.now() - startTime;
        
        if (!response.ok) {
          return {
            provider: 'ollama',
            healthy: false,
            latency,
            error: `HTTP ${response.status}`,
          };
        }
        
        const data = await response.json() as { models?: unknown[] };
        return {
          provider: 'ollama',
          healthy: true,
          latency,
          details: {
            models: data.models?.length || 0,
          },
        };
      } catch (err) {
        return {
          provider: 'ollama',
          healthy: false,
          latency: Date.now() - startTime,
          error: err instanceof Error ? err.message : 'Ollama not running or unreachable',
        };
      }
    },
  };

  const validator = validators[provider];
  if (!validator) {
    logger.debug(`No validator for ${provider}`);
    return {
      provider,
      healthy: false,
      error: 'No health check available for this provider',
    };
  }

  return validator();
}

/**
 * Check if an API key is valid (simple boolean check)
 */
export async function isKeyValid(provider: ProviderName, apiKey: string): Promise<boolean> {
  const result = await validateApiKey(provider, apiKey);
  return result.healthy;
}

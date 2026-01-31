/**
 * Auth Integration - Connect auth system with LLM providers
 * 
 * This module provides helpers to get API keys from the credential store
 * and integrate with the existing LLM provider system.
 */

import { getCredential, ProviderName } from '../auth/index.js';
import { logger } from './logger.js';

/**
 * Get API key for a provider, checking credential store first then env vars
 */
export async function getApiKey(provider: ProviderName): Promise<string | null> {
  // Try credential store first
  const credential = await getCredential(provider);
  
  if (credential) {
    logger.debug(`Using ${provider} key from credential store`);
    return credential.apiKey;
  }

  // Fall back to environment variables
  const envVars: Record<ProviderName, string> = {
    gemini: 'GEMINI_API_KEY',
    openai: 'OPENAI_API_KEY',
    openrouter: 'OPENROUTER_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
    ollama: 'OLLAMA_HOST',
  };

  const envVar = envVars[provider];
  const value = process.env[envVar];
  
  if (value) {
    logger.debug(`Using ${provider} key from ${envVar}`);
    return value;
  }

  return null;
}

/**
 * Get the best available provider in priority order
 */
export async function getBestAvailableProvider(): Promise<ProviderName | null> {
  const priority: ProviderName[] = ['gemini', 'openai', 'openrouter', 'anthropic', 'ollama'];
  
  for (const provider of priority) {
    const key = await getApiKey(provider);
    if (key) {
      return provider;
    }
  }
  
  return null;
}

/**
 * Check if any LLM provider is configured
 */
export async function hasConfiguredProvider(): Promise<boolean> {
  const provider = await getBestAvailableProvider();
  return provider !== null;
}

/**
 * Get all configured providers
 */
export async function getConfiguredProviders(): Promise<ProviderName[]> {
  const providers: ProviderName[] = ['gemini', 'openai', 'openrouter', 'anthropic', 'ollama'];
  const configured: ProviderName[] = [];
  
  for (const provider of providers) {
    const key = await getApiKey(provider);
    if (key) {
      configured.push(provider);
    }
  }
  
  return configured;
}

/**
 * Create provider configuration from credential store
 */
export async function getProviderConfig(provider: ProviderName): Promise<{
  apiKey: string;
  baseUrl?: string;
} | null> {
  const apiKey = await getApiKey(provider);
  
  if (!apiKey) {
    return null;
  }

  // Provider-specific base URLs
  const baseUrls: Partial<Record<ProviderName, string>> = {
    openrouter: 'https://openrouter.ai/api/v1',
    ollama: apiKey.startsWith('http') ? apiKey : 'http://localhost:11434/v1',
  };

  return {
    apiKey: provider === 'ollama' ? '' : apiKey,  // Ollama doesn't need API key
    baseUrl: baseUrls[provider],
  };
}

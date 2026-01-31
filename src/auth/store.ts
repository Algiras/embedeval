/**
 * Credential Store - Abstract interface for secure credential storage
 * 
 * Priority:
 * 1. System Keychain (via keytar) - Most secure
 * 2. Encrypted file - Good fallback
 * 3. Plain file with warning - Last resort
 */

import { Credential, CredentialStore, ProviderName } from './types.js';
import { KeychainStore } from './keychain-store.js';
import { FileStore } from './file-store.js';
import { logger } from '../utils/logger.js';
import { refreshOAuthToken } from './flows/pkce-flow.js';

let _store: CredentialStore | null = null;

/**
 * Get the credential store, initializing on first use
 * Tries keychain first, falls back to file store
 */
export async function getStore(): Promise<CredentialStore> {
  if (_store) {
    return _store;
  }

  // Try keychain first (most secure)
  try {
    const keychainStore = new KeychainStore();
    const available = await keychainStore.isAvailable();
    if (available) {
      logger.debug('Using system keychain for credential storage');
      _store = keychainStore;
      return _store;
    }
  } catch (err) {
    logger.debug('Keychain not available:', err);
  }

  // Fall back to encrypted file store
  logger.debug('Using file-based credential storage');
  _store = new FileStore();
  return _store;
}

/**
 * Check if credential is expired (with 5-minute buffer)
 */
function isCredentialExpired(credential: Credential): boolean {
  if (!credential.expiresAt) {
    return false;
  }
  
  const expiresAt = new Date(credential.expiresAt);
  const now = new Date();
  // Add 5-minute buffer to refresh before actual expiration
  const bufferMs = 5 * 60 * 1000;
  
  return now.getTime() >= (expiresAt.getTime() - bufferMs);
}

/**
 * Get credential for a provider
 * Checks store first, then environment variables
 * Automatically refreshes expired OAuth tokens
 */
export async function getCredential(provider: ProviderName): Promise<Credential | null> {
  const store = await getStore();
  
  // Check store first
  const stored = await store.get(provider);
  if (stored) {
    // Check if credential is expired and can be refreshed
    if (isCredentialExpired(stored) && stored.refreshToken) {
      logger.debug(`Token for ${provider} is expired, attempting refresh...`);
      
      try {
        const refreshed = await refreshOAuthToken(provider, stored.refreshToken);
        await store.set(refreshed);
        logger.info(`Successfully refreshed token for ${provider}`);
        return refreshed;
      } catch (err) {
        logger.error(`Failed to refresh token for ${provider}:`, err);
        // Return the expired credential - let the caller handle the failure
        // This allows them to prompt for re-authentication if needed
        return stored;
      }
    }
    
    return stored;
  }

  // Fall back to environment variable
  const envCred = getCredentialFromEnv(provider);
  return envCred;
}

/**
 * Get credential from environment variables
 */
export function getCredentialFromEnv(provider: ProviderName): Credential | null {
  const envVars: Record<ProviderName, string> = {
    gemini: 'GEMINI_API_KEY',
    openai: 'OPENAI_API_KEY',
    openrouter: 'OPENROUTER_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
    ollama: 'OLLAMA_HOST',
  };

  const envVar = envVars[provider];
  const value = process.env[envVar];

  if (!value) {
    return null;
  }

  return {
    provider,
    apiKey: value,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Save credential to store
 */
export async function saveCredential(credential: Credential): Promise<void> {
  const store = await getStore();
  await store.set(credential);
}

/**
 * Delete credential from store
 */
export async function deleteCredential(provider: ProviderName): Promise<void> {
  const store = await getStore();
  await store.delete(provider);
}

/**
 * List all stored credentials
 */
export async function listCredentials(): Promise<Credential[]> {
  const store = await getStore();
  return store.list();
}

/**
 * Clear all credentials from store
 */
export async function clearCredentials(): Promise<void> {
  const store = await getStore();
  await store.clear();
}

export { KeychainStore, FileStore };

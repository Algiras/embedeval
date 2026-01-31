/**
 * Keychain Store - System keychain credential storage using keytar
 * 
 * Uses the OS secure credential store:
 * - macOS: Keychain
 * - Windows: Credential Vault
 * - Linux: libsecret (GNOME Keyring, etc.)
 */

import { Credential, CredentialStore, ProviderName } from './types.js';
import { logger } from '../utils/logger.js';

const SERVICE_NAME = 'embedeval';

export class KeychainStore implements CredentialStore {
  private keytar: typeof import('keytar') | null = null;
  private _available: boolean | null = null;

  /**
   * Check if keytar is available
   */
  async isAvailable(): Promise<boolean> {
    if (this._available !== null) {
      return this._available;
    }

    try {
      // Dynamic import to allow graceful degradation
      this.keytar = await import('keytar');
      // Test if it actually works
      await this.keytar.findCredentials(SERVICE_NAME);
      this._available = true;
    } catch (err) {
      logger.debug('Keytar not available:', err);
      this._available = false;
    }

    return this._available;
  }

  private async ensureKeytar(): Promise<typeof import('keytar')> {
    if (!this.keytar) {
      const available = await this.isAvailable();
      if (!available || !this.keytar) {
        throw new Error('Keytar is not available on this system');
      }
    }
    return this.keytar;
  }

  async get(provider: ProviderName): Promise<Credential | null> {
    const keytar = await this.ensureKeytar();
    
    try {
      const value = await keytar.getPassword(SERVICE_NAME, provider);
      if (!value) {
        return null;
      }
      return JSON.parse(value) as Credential;
    } catch (err) {
      logger.error(`Failed to get credential for ${provider}:`, err);
      return null;
    }
  }

  async set(credential: Credential): Promise<void> {
    const keytar = await this.ensureKeytar();
    
    try {
      const value = JSON.stringify(credential);
      await keytar.setPassword(SERVICE_NAME, credential.provider, value);
      logger.debug(`Saved credential for ${credential.provider} to keychain`);
    } catch (err) {
      logger.error(`Failed to save credential for ${credential.provider}:`, err);
      throw err;
    }
  }

  async delete(provider: ProviderName): Promise<void> {
    const keytar = await this.ensureKeytar();
    
    try {
      await keytar.deletePassword(SERVICE_NAME, provider);
      logger.debug(`Deleted credential for ${provider} from keychain`);
    } catch (err) {
      logger.debug(`Failed to delete credential for ${provider}:`, err);
    }
  }

  async list(): Promise<Credential[]> {
    const keytar = await this.ensureKeytar();
    
    try {
      const credentials = await keytar.findCredentials(SERVICE_NAME);
      return credentials
        .map(cred => {
          try {
            return JSON.parse(cred.password) as Credential;
          } catch {
            return null;
          }
        })
        .filter((c): c is Credential => c !== null);
    } catch (err) {
      logger.error('Failed to list credentials:', err);
      return [];
    }
  }

  async clear(): Promise<void> {
    const credentials = await this.list();
    for (const cred of credentials) {
      await this.delete(cred.provider);
    }
  }
}

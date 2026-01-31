/**
 * File Store - File-based credential storage with optional encryption
 * 
 * Stores credentials in ~/.embedeval/credentials.json
 * Attempts to encrypt using machine-specific key
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { Credential, CredentialStore, ProviderName } from './types.js';
import { logger } from '../utils/logger.js';

const CONFIG_DIR = path.join(os.homedir(), '.embedeval');
const CREDENTIALS_FILE = path.join(CONFIG_DIR, 'credentials.json');
const ENCRYPTION_ALGO = 'aes-256-gcm';

interface EncryptedData {
  encrypted: true;
  data: string;
  iv: string;
  tag: string;
}

interface PlainData {
  encrypted: false;
  credentials: Record<string, Credential>;
}

type StoredData = EncryptedData | PlainData;

export class FileStore implements CredentialStore {
  private encryptionKey: Buffer | null = null;

  constructor() {
    this.ensureConfigDir();
    this.initEncryptionKey();
  }

  private ensureConfigDir(): void {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { mode: 0o700, recursive: true });
    }
  }

  /**
   * Initialize encryption key from machine-specific data
   * Not cryptographically secure, but better than plaintext
   */
  private initEncryptionKey(): void {
    try {
      // Create a machine-specific key from hostname + user
      const machineId = `${os.hostname()}-${os.userInfo().username}-embedeval`;
      this.encryptionKey = crypto
        .createHash('sha256')
        .update(machineId)
        .digest();
    } catch (err) {
      logger.debug('Could not create encryption key:', err);
      this.encryptionKey = null;
    }
  }

  private encrypt(data: Record<string, Credential>): StoredData {
    if (!this.encryptionKey) {
      logger.warn('Storing credentials in plaintext (encryption unavailable)');
      return { encrypted: false, credentials: data };
    }

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGO, this.encryptionKey, iv);
    
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    const tag = cipher.getAuthTag();

    return {
      encrypted: true,
      data: encrypted,
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
    };
  }

  private decrypt(stored: StoredData): Record<string, Credential> {
    if (!stored.encrypted) {
      return stored.credentials;
    }

    if (!this.encryptionKey) {
      throw new Error('Cannot decrypt: encryption key not available');
    }

    const iv = Buffer.from(stored.iv, 'base64');
    const tag = Buffer.from(stored.tag, 'base64');
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGO, this.encryptionKey, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(stored.data, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  }

  private read(): Record<string, Credential> {
    try {
      if (!fs.existsSync(CREDENTIALS_FILE)) {
        return {};
      }

      const content = fs.readFileSync(CREDENTIALS_FILE, 'utf8');
      const stored = JSON.parse(content) as StoredData;
      return this.decrypt(stored);
    } catch (err) {
      logger.debug('Failed to read credentials file:', err);
      return {};
    }
  }

  private write(credentials: Record<string, Credential>): void {
    const stored = this.encrypt(credentials);
    fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(stored, null, 2), {
      mode: 0o600,
    });
  }

  async get(provider: ProviderName): Promise<Credential | null> {
    const credentials = this.read();
    return credentials[provider] || null;
  }

  async set(credential: Credential): Promise<void> {
    const credentials = this.read();
    credentials[credential.provider] = credential;
    this.write(credentials);
    logger.debug(`Saved credential for ${credential.provider} to file store`);
  }

  async delete(provider: ProviderName): Promise<void> {
    const credentials = this.read();
    delete credentials[provider];
    this.write(credentials);
    logger.debug(`Deleted credential for ${provider} from file store`);
  }

  async list(): Promise<Credential[]> {
    const credentials = this.read();
    return Object.values(credentials);
  }

  async clear(): Promise<void> {
    this.write({});
    logger.debug('Cleared all credentials from file store');
  }
}

/**
 * Binary Embedding Cache Manager
 * Stores embeddings in binary format with 10GB limit and LRU eviction
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { createHash } from 'crypto';
import { CacheMetadata } from '../core/types';
import { logger } from '../utils/logger';

export class EmbeddingCache {
  private cacheDir: string;
  private indexPath: string;
  private maxSize: number;
  private currentSize: number = 0;
  private index: Map<string, CacheMetadata> = new Map();

  constructor(
    maxSizeGB: number = 10,
    cacheDir?: string
  ) {
    this.maxSize = maxSizeGB * 1024 * 1024 * 1024; // Convert GB to bytes
    this.cacheDir = cacheDir || path.join(process.cwd(), '.embedeval', 'cache', 'embeddings');
    this.indexPath = path.join(this.cacheDir, 'index.json');
    
    fs.ensureDirSync(this.cacheDir);
    this.loadIndex();
  }

  /**
   * Generate cache key from text and model info
   */
  private generateKey(text: string, provider: string, model: string): string {
    const hash = createHash('sha256')
      .update(`${provider}:${model}:${text}`)
      .digest('hex');
    return hash;
  }

  /**
   * Load cache index from disk
   */
  private async loadIndex(): Promise<void> {
    try {
      if (await fs.pathExists(this.indexPath)) {
        const indexData = await fs.readJson(this.indexPath);
        this.index = new Map(Object.entries(indexData));
        this.currentSize = Array.from(this.index.values()).reduce((sum, meta) => sum + meta.size, 0);
        logger.info(`Loaded cache index: ${this.index.size} entries, ${this.formatBytes(this.currentSize)}`);
      }
    } catch (error) {
      logger.error('Failed to load cache index:', error);
      this.index = new Map();
      this.currentSize = 0;
    }
  }

  /**
   * Save cache index to disk
   */
  private async saveIndex(): Promise<void> {
    try {
      const indexData = Object.fromEntries(this.index);
      await fs.writeJson(this.indexPath, indexData);
    } catch (error) {
      logger.error('Failed to save cache index:', error);
    }
  }

  /**
   * Get embedding from cache
   */
  async get(text: string, provider: string, model: string): Promise<number[] | null> {
    const key = this.generateKey(text, provider, model);
    const metadata = this.index.get(key);

    if (!metadata) {
      return null;
    }

    try {
      const filePath = path.join(this.cacheDir, metadata.filePath);
      if (!(await fs.pathExists(filePath))) {
        // File missing, remove from index
        this.index.delete(key);
        this.currentSize -= metadata.size;
        await this.saveIndex();
        return null;
      }

      // Read binary file
      const buffer = await fs.readFile(filePath);
      const embedding = this.bufferToEmbedding(buffer);
      
      // Update access time (LRU)
      metadata.timestamp = new Date().toISOString();
      await this.saveIndex();
      
      logger.debug(`Cache hit for key ${key.substring(0, 8)}...`);
      return embedding;
    } catch (error) {
      logger.error(`Failed to read cache entry ${key}:`, error);
      return null;
    }
  }

  /**
   * Store embedding in cache
   */
  async set(
    text: string, 
    provider: string, 
    model: string, 
    embedding: number[]
  ): Promise<void> {
    const key = this.generateKey(text, provider, model);
    const size = embedding.length * 8; // 8 bytes per float64

    // Check if we need to evict
    while (this.currentSize + size > this.maxSize) {
      await this.evictLRU();
    }

    try {
      // Write binary file
      const fileName = `${key}.bin`;
      const filePath = path.join(this.cacheDir, fileName);
      const buffer = this.embeddingToBuffer(embedding);
      
      await fs.writeFile(filePath, buffer);

      // Update index
      const metadata: CacheMetadata = {
        key,
        size,
        timestamp: new Date().toISOString(),
        filePath: fileName,
      };

      this.index.set(key, metadata);
      this.currentSize += size;
      
      await this.saveIndex();
      logger.debug(`Cached embedding for key ${key.substring(0, 8)}... (${this.formatBytes(size)})`);
    } catch (error) {
      logger.error(`Failed to cache embedding for key ${key}:`, error);
    }
  }

  /**
   * Get multiple embeddings from cache (batch operation)
   */
  async getBatch(
    texts: string[],
    provider: string,
    model: string
  ): Promise<(number[] | null)[]> {
    return Promise.all(
      texts.map(text => this.get(text, provider, model))
    );
  }

  /**
   * Store multiple embeddings in cache (batch operation)
   */
  async setBatch(
    texts: string[],
    provider: string,
    model: string,
    embeddings: number[][]
  ): Promise<void> {
    for (let i = 0; i < texts.length; i++) {
      await this.set(texts[i], provider, model, embeddings[i]);
    }
  }

  /**
   * Evict least recently used entry
   */
  private async evictLRU(): Promise<void> {
    if (this.index.size === 0) return;

    // Find oldest entry
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, metadata] of this.index) {
      const entryTime = new Date(metadata.timestamp).getTime();
      if (entryTime < oldestTime) {
        oldestTime = entryTime;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      await this.deleteEntry(oldestKey);
    }
  }

  /**
   * Delete a cache entry
   */
  private async deleteEntry(key: string): Promise<void> {
    const metadata = this.index.get(key);
    if (!metadata) return;

    try {
      const filePath = path.join(this.cacheDir, metadata.filePath);
      if (await fs.pathExists(filePath)) {
        await fs.remove(filePath);
      }

      this.index.delete(key);
      this.currentSize -= metadata.size;
      
      logger.debug(`Evicted cache entry ${key.substring(0, 8)}... (${this.formatBytes(metadata.size)})`);
    } catch (error) {
      logger.error(`Failed to delete cache entry ${key}:`, error);
    }
  }

  /**
   * Convert embedding array to Buffer
   */
  private embeddingToBuffer(embedding: number[]): Buffer {
    const buffer = Buffer.allocUnsafe(embedding.length * 8);
    for (let i = 0; i < embedding.length; i++) {
      buffer.writeDoubleLE(embedding[i], i * 8);
    }
    return buffer;
  }

  /**
   * Convert Buffer to embedding array
   */
  private bufferToEmbedding(buffer: Buffer): number[] {
    const embedding: number[] = [];
    for (let i = 0; i < buffer.length; i += 8) {
      embedding.push(buffer.readDoubleLE(i));
    }
    return embedding;
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    entries: number;
    totalSize: number;
    maxSize: number;
    utilization: number;
  } {
    return {
      entries: this.index.size,
      totalSize: this.currentSize,
      maxSize: this.maxSize,
      utilization: this.currentSize / this.maxSize,
    };
  }

  /**
   * Clear entire cache
   */
  async clear(): Promise<void> {
    try {
      await fs.emptyDir(this.cacheDir);
      this.index = new Map();
      this.currentSize = 0;
      logger.info('Cache cleared');
    } catch (error) {
      logger.error('Failed to clear cache:', error);
    }
  }

  /**
   * Format bytes to human readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

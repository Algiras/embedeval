/**
 * Checkpoint Manager for per-query progress tracking
 * Saves and loads checkpoints to filesystem
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { Checkpoint, EvaluationResult } from '../core/types';
import { logger } from '../utils/logger';

export class CheckpointManager {
  private checkpointDir: string;

  constructor(private testId: string) {
    this.checkpointDir = path.join(process.cwd(), '.embedeval', 'runs', testId, 'checkpoints');
    fs.ensureDirSync(this.checkpointDir);
  }

  /**
   * Save progress after processing a query
   */
  async saveProgress(
    variantId: string,
    queryId: string,
    result: EvaluationResult
  ): Promise<void> {
    const checkpointPath = this.getCheckpointPath(variantId);
    
    try {
      // Load existing checkpoint or create new
      let checkpoint: Checkpoint;
      if (await fs.pathExists(checkpointPath)) {
        checkpoint = await fs.readJson(checkpointPath);
      } else {
        checkpoint = {
          testId: this.testId,
          variantId,
          queryIndex: 0,
          timestamp: new Date().toISOString(),
          completedQueries: [],
          partialResults: [],
          failedQueries: [],
        };
      }

      // Update checkpoint
      if (!checkpoint.completedQueries.includes(queryId)) {
        checkpoint.completedQueries.push(queryId);
        checkpoint.partialResults.push(result);
        checkpoint.timestamp = new Date().toISOString();
        
        // Save atomically
        const tempPath = `${checkpointPath}.tmp`;
        await fs.writeJson(tempPath, checkpoint, { spaces: 2 });
        await fs.move(tempPath, checkpointPath, { overwrite: true });
        
        logger.debug(`Checkpoint saved for variant ${variantId}, query ${queryId}`);
      }
    } catch (error) {
      logger.error(`Failed to save checkpoint for ${variantId}/${queryId}:`, error);
      throw error;
    }
  }

  /**
   * Mark a query as failed
   */
  async markFailed(variantId: string, queryId: string, error: string): Promise<void> {
    const checkpointPath = this.getCheckpointPath(variantId);
    
    try {
      let checkpoint: Checkpoint;
      if (await fs.pathExists(checkpointPath)) {
        checkpoint = await fs.readJson(checkpointPath);
      } else {
        checkpoint = {
          testId: this.testId,
          variantId,
          queryIndex: 0,
          timestamp: new Date().toISOString(),
          completedQueries: [],
          partialResults: [],
          failedQueries: [],
        };
      }

      if (!checkpoint.failedQueries.includes(queryId)) {
        checkpoint.failedQueries.push(queryId);
        checkpoint.timestamp = new Date().toISOString();
        
        await fs.writeJson(checkpointPath, checkpoint, { spaces: 2 });
        logger.debug(`Marked query ${queryId} as failed for variant ${variantId}`);
      }
    } catch (err) {
      logger.error(`Failed to mark query as failed:`, err);
    }
  }

  /**
   * Load checkpoint for a variant
   */
  async loadCheckpoint(variantId: string): Promise<Checkpoint | null> {
    const checkpointPath = this.getCheckpointPath(variantId);
    
    if (!(await fs.pathExists(checkpointPath))) {
      return null;
    }

    try {
      const checkpoint = await fs.readJson(checkpointPath);
      logger.info(`Loaded checkpoint for variant ${variantId}: ${checkpoint.completedQueries.length} completed, ${checkpoint.failedQueries.length} failed`);
      return checkpoint;
    } catch (error) {
      logger.error(`Failed to load checkpoint for ${variantId}:`, error);
      return null;
    }
  }

  /**
   * Get all completed query IDs for a variant
   */
  async getCompletedQueries(variantId: string): Promise<string[]> {
    const checkpoint = await this.loadCheckpoint(variantId);
    return checkpoint?.completedQueries || [];
  }

  /**
   * Get all failed query IDs for a variant
   */
  async getFailedQueries(variantId: string): Promise<string[]> {
    const checkpoint = await this.loadCheckpoint(variantId);
    return checkpoint?.failedQueries || [];
  }

  /**
   * Get all partial results for a variant
   */
  async getPartialResults(variantId: string): Promise<EvaluationResult[]> {
    const checkpoint = await this.loadCheckpoint(variantId);
    return checkpoint?.partialResults || [];
  }

  /**
   * Delete checkpoint for a variant
   */
  async deleteCheckpoint(variantId: string): Promise<void> {
    const checkpointPath = this.getCheckpointPath(variantId);
    if (await fs.pathExists(checkpointPath)) {
      await fs.remove(checkpointPath);
      logger.info(`Deleted checkpoint for variant ${variantId}`);
    }
  }

  /**
   * Get checkpoint file path
   */
  private getCheckpointPath(variantId: string): string {
    return path.join(this.checkpointDir, `${variantId}.json`);
  }

  /**
   * List all checkpoints for this test
   */
  async listCheckpoints(): Promise<string[]> {
    const files = await fs.readdir(this.checkpointDir);
    return files
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''));
  }

  /**
   * Get checkpoint statistics
   */
  async getStats(): Promise<{
    totalVariants: number;
    totalCompleted: number;
    totalFailed: number;
  }> {
    const variants = await this.listCheckpoints();
    let totalCompleted = 0;
    let totalFailed = 0;

    for (const variantId of variants) {
      const checkpoint = await this.loadCheckpoint(variantId);
      if (checkpoint) {
        totalCompleted += checkpoint.completedQueries.length;
        totalFailed += checkpoint.failedQueries.length;
      }
    }

    return {
      totalVariants: variants.length,
      totalCompleted,
      totalFailed,
    };
  }
}

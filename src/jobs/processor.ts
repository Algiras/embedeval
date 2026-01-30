/**
 * BullMQ Job Processor for EmbedEval
 * Handles queue management, workers, and per-query checkpointing
 */

import { Queue, Worker, Job, FlowProducer } from 'bullmq';
import IORedis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { 
  JobData, 
  JobResult, 
  Checkpoint, 
  EvaluationResult,
  ABVariant,
  TestCase,
  Document,
  ProviderConfig 
} from '../core/types';
import { CheckpointManager } from './checkpoint-manager';
import { logger } from '../utils/logger';

// Redis connection
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

export class JobProcessor {
  private queue: Queue;
  private workers: Map<string, Worker> = new Map();
  private checkpointManager: CheckpointManager;
  private flowProducer: FlowProducer;
  private activeJobs: Map<string, Job> = new Map();

  constructor(private testId: string) {
    this.queue = new Queue(`embedeval-${testId}`, { connection });
    this.flowProducer = new FlowProducer({ connection });
    this.checkpointManager = new CheckpointManager(testId);
  }

  /**
   * Add jobs for a variant to the queue
   */
  async addVariantJobs(
    variant: ABVariant,
    queries: TestCase[],
    documents: Document[],
    checkpointEnabled: boolean = true
  ): Promise<void> {
    logger.info(`Adding ${queries.length} jobs for variant ${variant.id}`);

    // Check for existing checkpoint
    const checkpoint = checkpointEnabled 
      ? await this.checkpointManager.loadCheckpoint(variant.id)
      : null;

    const completedQueries = checkpoint?.completedQueries || [];
    const remainingQueries = queries.filter(q => !completedQueries.includes(q.id));

    logger.info(`Resuming from checkpoint: ${completedQueries.length} completed, ${remainingQueries.length} remaining`);

    // Add jobs for remaining queries
    const jobs = remainingQueries.map(query => ({
      name: 'evaluate',
      data: {
        testId: this.testId,
        variantId: variant.id,
        query,
        documents,
        providerConfig: variant.provider,
        strategy: variant.strategy,
        checkpointEnabled,
      } as JobData,
      opts: {
        jobId: `${this.testId}-${variant.id}-${query.id}`,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    }));

    await this.queue.addBulk(jobs);
  }

  /**
   * Start workers for processing jobs
   */
  async startWorkers(
    processor: (job: Job<JobData>) => Promise<JobResult>,
    concurrency: number = 5
  ): Promise<void> {
    logger.info(`Starting ${concurrency} workers for test ${this.testId}`);

    const worker = new Worker<JobData, JobResult>(
      `embedeval-${this.testId}`,
      async (job) => {
        logger.debug(`Processing job ${job.id} for query ${job.data.query.id}`);
        this.activeJobs.set(job.id!, job);
        
        try {
          const result = await processor(job);
          
          // Save checkpoint after successful processing
          if (job.data.checkpointEnabled && result.success) {
            await this.checkpointManager.saveProgress(
              job.data.variantId,
              job.data.query.id,
              result.result!
            );
          }
          
          return result;
        } finally {
          this.activeJobs.delete(job.id!);
        }
      },
      {
        connection,
        concurrency,
        limiter: {
          max: 100,
          duration: 1000,
        },
      }
    );

    // Handle job completion
    worker.on('completed', (job, result) => {
      if (result.success) {
        logger.debug(`Job ${job.id} completed successfully`);
      } else {
        logger.warn(`Job ${job.id} failed: ${result.error}`);
      }
    });

    // Handle job failure
    worker.on('failed', (job, err) => {
      logger.error(`Job ${job?.id} failed with error:`, err);
    });

    this.workers.set('default', worker);
  }

  /**
   * Wait for all jobs to complete
   */
  async waitForCompletion(
    onProgress?: (completed: number, total: number, failed: number) => void
  ): Promise<{ completed: number; failed: number }> {
    return new Promise((resolve, reject) => {
      const checkProgress = async () => {
        try {
          const jobCounts = await this.queue.getJobCounts();
          const completed = jobCounts.completed;
          const failed = jobCounts.failed;
          const total = completed + failed + jobCounts.waiting + jobCounts.active + jobCounts.delayed;

          onProgress?.(completed, total, failed);

          if (jobCounts.waiting === 0 && jobCounts.active === 0 && jobCounts.delayed === 0) {
            resolve({ completed, failed });
          } else {
            setTimeout(checkProgress, 1000);
          }
        } catch (error) {
          reject(error);
        }
      };

      checkProgress();
    });
  }

  /**
   * Get all completed jobs for a variant
   */
  async getCompletedJobs(variantId: string): Promise<EvaluationResult[]> {
    const jobs = await this.queue.getJobs(['completed']);
    const variantJobs = jobs.filter(job => job.data.variantId === variantId);
    
    const results: EvaluationResult[] = [];
    for (const job of variantJobs) {
      const result = await job.returnvalue;
      if (result?.success && result.result) {
        results.push(result.result);
      }
    }

    // Also load from checkpoint
    const checkpoint = await this.checkpointManager.loadCheckpoint(variantId);
    if (checkpoint) {
      const checkpointResults = checkpoint.partialResults.filter(
        pr => !results.find(r => r.testCaseId === pr.testCaseId)
      );
      results.push(...checkpointResults);
    }

    return results.sort((a, b) => a.testCaseId.localeCompare(b.testCaseId));
  }

  /**
   * Get failed job IDs for a variant
   */
  async getFailedQueries(variantId: string): Promise<string[]> {
    const jobs = await this.queue.getJobs(['failed']);
    return jobs
      .filter(job => job.data.variantId === variantId)
      .map(job => job.data.query.id);
  }

  /**
   * Pause the queue
   */
  async pause(): Promise<void> {
    await this.queue.pause();
    logger.info('Queue paused');
  }

  /**
   * Resume the queue
   */
  async resume(): Promise<void> {
    await this.queue.resume();
    logger.info('Queue resumed');
  }

  /**
   * Clean up resources
   */
  async close(): Promise<void> {
    logger.info('Closing job processor...');
    
    // Close all workers
    for (const [name, worker] of this.workers) {
      await worker.close();
      logger.debug(`Worker ${name} closed`);
    }
    
    // Close queue
    await this.queue.close();
    
    // Close flow producer
    await this.flowProducer.close();
    
    logger.info('Job processor closed');
  }

  /**
   * Get queue status
   */
  async getStatus(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    return this.queue.getJobCounts();
  }
}

export { connection };

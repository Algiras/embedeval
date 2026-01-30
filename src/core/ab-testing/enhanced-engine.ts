/**
 * Enhanced A/B Testing Engine with Strategy Support
 */

import { Job } from 'bullmq';
import * as fs from 'fs-extra';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  ABTestConfig,
  ABTestResult,
  ABVariantResult,
  EvaluationResult,
  JobData,
  JobResult,
  TestCase,
  Document,
} from '../types';
import { JobProcessor } from '../../jobs/processor';
import { CheckpointManager } from '../../jobs/checkpoint-manager';
import { createProvider } from '../../providers';
import { EmbeddingCache } from '../../utils/cache';
import { calculateMetricsAtMultipleK } from '../evaluation/metrics';
import { calculatePercentile, calculateMean } from '../../utils/statistics';
import { logger } from '../../utils/logger';
import { StrategyExecutor, PREDEFINED_STRATEGIES } from '../../strategies/registry';
import { StrategyContext } from '../../strategies/types';

export class EnhancedABTestingEngine {
  private testId: string;
  private processor: JobProcessor;
  private _cache: EmbeddingCache;
  private checkpointManager: CheckpointManager;
  private strategyExecutor: StrategyExecutor;

  constructor(
    private config: ABTestConfig,
    cacheDir?: string
  ) {
    this.testId = config.id || uuidv4();
    this.processor = new JobProcessor(this.testId);
    this._cache = new EmbeddingCache(10, cacheDir);
    this.checkpointManager = new CheckpointManager(this.testId);
    this.strategyExecutor = new StrategyExecutor();
  }

  async run(
    testCases: TestCase[],
    documents: Document[],
    onProgress?: (variantId: string, completed: number, total: number) => void
  ): Promise<ABTestResult> {
    logger.info(`Starting A/B test: ${this.config.name}`);
    logger.info(`Test ID: ${this.testId}`);
    logger.info(`Variants: ${this.config.variants.length}`);
    logger.info(`Queries: ${testCases.length}`);

    const variantResults: ABVariantResult[] = [];

    for (const variant of this.config.variants) {
      logger.info(`\nProcessing variant: ${variant.name} (${variant.id})`);
      logger.info(`Strategy: ${variant.strategy}`);

      await this.processor.addVariantJobs(
        variant,
        testCases,
        documents,
        true
      );

      await this.processor.startWorkers(
        (job) => this.processJobWithStrategy(job),
        5
      );

      await this.processor.waitForCompletion((completed, total, failed) => {
        onProgress?.(variant.id, completed, total);
        logger.debug(`${variant.name}: ${completed}/${total} completed (${failed} failed)`);
      });

      const results = await this.processor.getCompletedJobs(variant.id);
      const failedQueries = await this.processor.getFailedQueries(variant.id);

      const variantResult = this.calculateVariantResult(
        variant,
        results,
        failedQueries
      );

      variantResults.push(variantResult);
      logger.info(`Variant ${variant.name} completed: ${results.length} successful, ${failedQueries.length} failed`);
    }

    const comparisons = this.calculateComparisons(variantResults);
    const efficiency = this.calculateEfficiency(variantResults);

    const result: ABTestResult = {
      testId: this.testId,
      testName: this.config.name,
      timestamp: new Date().toISOString(),
      variants: variantResults,
      comparisons,
      efficiency,
    };

    await this.saveResults(result);

    logger.info(`\nA/B test completed: ${this.testId}`);
    
    return result;
  }

  private async processJobWithStrategy(job: Job<JobData>): Promise<JobResult> {
    const { variantId, query, documents, providerConfig, strategy } = job.data;

    try {
      const startTime = Date.now();

      // Get strategy configuration
      const strategyConfig = PREDEFINED_STRATEGIES[strategy] || {
        name: strategy,
        description: 'Custom strategy',
        stages: [{ type: 'embedding', name: 'embedding', config: {}, enabled: true }],
      };

      // Create provider
      const provider = createProvider(providerConfig);

      // Build initial context
      const context: StrategyContext = {
        query: query.query,
        queryId: query.id,
        testCase: query,
        originalDocuments: documents,
        stageTimings: new Map(),
        stageMetadata: new Map(),
      };

      // Execute strategy
      const result = await this.strategyExecutor.execute(
        strategyConfig,
        context,
        provider
      );

      // Calculate metrics
      const metrics = calculateMetricsAtMultipleK(
        result.retrievedDocs,
        query.relevantDocs,
        query.relevanceScores,
        [5, 10]
      );

      // Build evaluation result
      const evaluationResult: EvaluationResult = {
        testCaseId: query.id,
        query: query.query,
        retrievedDocs: result.retrievedDocs,
        metrics: {
          ndcg: metrics['ndcg@10'],
          ndcg5: metrics['ndcg@5'],
          ndcg10: metrics['ndcg@10'],
          recall: metrics['recall@10'],
          recall5: metrics['recall@5'],
          recall10: metrics['recall@10'],
          mrr: metrics['mrr@10'],
          mrr10: metrics['mrr@10'],
          map: metrics['map@10'],
          map10: metrics['map@10'],
          hitRate: metrics['hitRate@10'],
          hitRate10: metrics['hitRate@10'],
        },
        usage: {
          tokens: { input: 0, total: 0 },
          cost: { input: 0, total: 0, currency: 'USD' },
          latency: { 
            total: Date.now() - startTime,
            embedding: result.metrics.stageTimings['embedding'] || 0,
          },
        },
        timestamp: new Date().toISOString(),
      };

      return {
        success: true,
        result: evaluationResult,
        queryId: query.id,
        variantId,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Job failed for query ${query.id}:`, error);
      await this.checkpointManager.markFailed(variantId, query.id, errorMessage);

      return {
        success: false,
        error: errorMessage,
        queryId: query.id,
        variantId,
      };
    }
  }

  private calculateVariantResult(
    variant: any,
    results: EvaluationResult[],
    failedQueries: string[]
  ): ABVariantResult {
    const metrics: Record<string, number> = {};
    const metricNames = ['ndcg', 'ndcg5', 'ndcg10', 'recall', 'recall5', 'recall10', 'mrr', 'mrr10', 'map', 'map10', 'hitRate', 'hitRate10'];

    for (const metricName of metricNames) {
      const values = results.map(r => r.metrics[metricName as keyof typeof r.metrics] || 0);
      metrics[metricName] = calculateMean(values);
    }

    const latencies = results.map(r => r.usage.latency.total);
    const totalTokens = results.reduce((sum, r) => sum + r.usage.tokens.input, 0);

    return {
      variantId: variant.id,
      variantName: variant.name,
      provider: variant.provider.type,
      model: variant.provider.model,
      strategy: variant.strategy,
      metrics,
      usage: {
        totalTokens,
        totalCost: 0,
        avgLatency: calculateMean(latencies),
        p50Latency: calculatePercentile(latencies, 50),
        p95Latency: calculatePercentile(latencies, 95),
        p99Latency: calculatePercentile(latencies, 99),
      },
      perQueryResults: results,
      failedQueries,
    };
  }

  private calculateComparisons(_variantResults: ABVariantResult[]): any[] {
    return [];
  }

  private calculateEfficiency(variantResults: ABVariantResult[]): any {
    const bestQuality = variantResults.reduce((best, current) =>
      current.metrics.ndcg > best.metrics.ndcg ? current : best
    );

    const cheapest = variantResults.find(v => v.provider === 'ollama') || variantResults[0];

    const fastest = variantResults.reduce((fastest, current) =>
      current.usage.avgLatency < fastest.usage.avgLatency ? current : fastest
    );

    return {
      bestQuality: bestQuality.variantId,
      cheapest: cheapest.variantId,
      fastest: fastest.variantId,
      bestValue: variantResults[0].variantId,
      paretoFrontier: variantResults.map(v => v.variantId),
    };
  }

  private async saveResults(result: ABTestResult): Promise<void> {
    const outputDir = path.join(process.cwd(), '.embedeval', 'runs', this.testId, 'results');
    await fs.ensureDir(outputDir);
    const jsonPath = path.join(outputDir, 'metrics.json');
    await fs.writeJson(jsonPath, result, { spaces: 2 });
    logger.info(`Results saved to: ${jsonPath}`);
  }

  getTestId(): string {
    return this.testId;
  }

  async close(): Promise<void> {
    await this.processor.close();
    logger.info('A/B testing engine closed');
  }
}

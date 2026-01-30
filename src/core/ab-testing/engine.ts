/**
 * A/B Testing Engine
 * Orchestrates evaluation across multiple variants with parallel processing
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
  RetrievedDoc,
  UsageMetrics,
} from '../types';
import { JobProcessor } from '../../jobs/processor';
import { CheckpointManager } from '../../jobs/checkpoint-manager';
import { createProvider } from '../../providers';
import { EmbeddingCache } from '../../utils/cache';
import { calculateMetricsAtMultipleK } from '../evaluation/metrics';
import { calculatePercentile, calculateMean } from '../../utils/statistics';
import { logger } from '../../utils/logger';

export class ABTestingEngine {
  private testId: string;
  private processor: JobProcessor;
  private cache: EmbeddingCache;
  private checkpointManager: CheckpointManager;

  constructor(
    private config: ABTestConfig,
    cacheDir?: string
  ) {
    this.testId = config.id || uuidv4();
    this.processor = new JobProcessor(this.testId);
    this.cache = new EmbeddingCache(10, cacheDir);
    this.checkpointManager = new CheckpointManager(this.testId);
  }

  /**
   * Run the A/B test
   */
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

    // Process each variant
    for (const variant of this.config.variants) {
      logger.info(`\nProcessing variant: ${variant.name} (${variant.id})`);

      // Add jobs to queue
      await this.processor.addVariantJobs(
        variant,
        testCases,
        documents,
        true // Enable checkpointing
      );

      // Start workers
      await this.processor.startWorkers(
        (job) => this.processJob(job),
        5 // Concurrency
      );

      // Wait for completion with progress updates
      await this.processor.waitForCompletion((completed, total, failed) => {
        onProgress?.(variant.id, completed, total);
        logger.debug(`${variant.name}: ${completed}/${total} completed (${failed} failed)`);
      });

      // Collect results
      const results = await this.processor.getCompletedJobs(variant.id);
      const failedQueries = await this.processor.getFailedQueries(variant.id);

      // Calculate variant metrics
      const variantResult = this.calculateVariantResult(
        variant,
        results,
        failedQueries
      );

      variantResults.push(variantResult);
      logger.info(`Variant ${variant.name} completed: ${results.length} successful, ${failedQueries.length} failed`);
    }

    // Calculate comparisons and efficiency
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

    // Save results
    await this.saveResults(result);

    logger.info(`\nA/B test completed: ${this.testId}`);
    
    return result;
  }

  /**
   * Process a single evaluation job
   */
  private async processJob(job: Job<JobData>): Promise<JobResult> {
    const { variantId, query, documents, providerConfig } = job.data;

    try {
      const startTime = Date.now();

      // Create provider
      const provider = createProvider(providerConfig);
      const modelInfo = provider.getModelInfo();

      // Check cache for query embedding
      let queryEmbedding = await this.cache.get(
        query.query,
        modelInfo.provider,
        modelInfo.name
      );

      // Generate embedding if not cached
      if (!queryEmbedding) {
        queryEmbedding = await provider.embed(query.query);
        await this.cache.set(query.query, modelInfo.provider, modelInfo.name, queryEmbedding);
      }

      // Check cache for document embeddings
      const docTexts = documents.map(d => d.content);
      const cachedEmbeddings = await this.cache.getBatch(
        docTexts,
        modelInfo.provider,
        modelInfo.name
      );

      // Generate missing document embeddings
      const missingIndices: number[] = [];
      const docEmbeddings: number[][] = [];

      for (let i = 0; i < documents.length; i++) {
        if (cachedEmbeddings[i]) {
          docEmbeddings.push(cachedEmbeddings[i]!);
        } else {
          missingIndices.push(i);
          docEmbeddings.push([]); // Placeholder
        }
      }

      if (missingIndices.length > 0) {
        const missingTexts = missingIndices.map(i => docTexts[i]);
        const newEmbeddings = await provider.embedBatch(missingTexts);

        for (let i = 0; i < missingIndices.length; i++) {
          const docIndex = missingIndices[i];
          docEmbeddings[docIndex] = newEmbeddings[i];
          
          // Cache the new embedding
          await this.cache.set(
            docTexts[docIndex],
            modelInfo.provider,
            modelInfo.name,
            newEmbeddings[i]
          );
        }
      }

      // Calculate cosine similarity and rank documents
      const similarities = docEmbeddings.map((emb, index) => ({
        doc: documents[index],
        score: this.cosineSimilarity(queryEmbedding, emb),
      }));

      // Sort by score descending
      similarities.sort((a, b) => b.score - a.score);

      // Create retrieved docs with relevance info
      const retrievedDocs: RetrievedDoc[] = similarities.map((sim, index) => ({
        id: sim.doc.id,
        content: sim.doc.content,
        score: sim.score,
        rank: index + 1,
        isRelevant: query.relevantDocs.includes(sim.doc.id),
      }));

      // Calculate metrics
      const metrics = calculateMetricsAtMultipleK(
        retrievedDocs,
        query.relevantDocs,
        query.relevanceScores,
        [5, 10]
      );

      // Calculate usage metrics
      const latency = Date.now() - startTime;
      const usage: UsageMetrics = {
        tokens: {
          input: this.estimateTokens(query.query) + docTexts.reduce((sum, t) => sum + this.estimateTokens(t), 0),
          total: 0, // Will be updated with actual usage if available
        },
        cost: {
          input: 0, // Will be calculated based on pricing
          total: 0,
          currency: 'USD',
        },
        latency: {
          total: latency,
          embedding: latency,
        },
      };

      const result: EvaluationResult = {
        testCaseId: query.id,
        query: query.query,
        retrievedDocs: retrievedDocs.slice(0, 10), // Top 10 for storage
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
        usage,
        timestamp: new Date().toISOString(),
      };

      return {
        success: true,
        result,
        queryId: query.id,
        variantId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Job failed for query ${query.id}:`, error);

      // Mark as failed in checkpoint
      await this.checkpointManager.markFailed(variantId, query.id, errorMessage);

      return {
        success: false,
        error: errorMessage,
        queryId: query.id,
        variantId,
      };
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Estimate token count (rough approximation: 1 token ≈ 4 characters)
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Calculate aggregate metrics for a variant
   */
  private calculateVariantResult(
    variant: any,
    results: EvaluationResult[],
    failedQueries: string[]
  ): ABVariantResult {
    // Calculate average metrics
    const metrics: Record<string, number> = {};
    const metricNames = ['ndcg', 'ndcg5', 'ndcg10', 'recall', 'recall5', 'recall10', 'mrr', 'mrr10', 'map', 'map10', 'hitRate', 'hitRate10'];

    for (const metricName of metricNames) {
      const values = results.map(r => r.metrics[metricName as keyof typeof r.metrics] || 0);
      metrics[metricName] = calculateMean(values);
    }

    // Calculate usage stats
    const latencies = results.map(r => r.usage.latency.total);
    const totalTokens = results.reduce((sum, r) => sum + r.usage.tokens.input, 0);

    return {
      variantId: variant.id,
      variantName: variant.name,
      provider: variant.provider.type,
      model: variant.provider.model,
      metrics,
      usage: {
        totalTokens,
        totalCost: 0, // Will be calculated based on pricing
        avgLatency: calculateMean(latencies),
        p50Latency: calculatePercentile(latencies, 50),
        p95Latency: calculatePercentile(latencies, 95),
        p99Latency: calculatePercentile(latencies, 99),
      },
      perQueryResults: results,
      failedQueries,
    };
  }

  /**
   * Calculate statistical comparisons between variants
   */
  private calculateComparisons(_variantResults: ABVariantResult[]): any[] {
    // TODO: Implement statistical comparison (paired t-test, Wilcoxon)
    // For now, return basic comparison
    return [];
  }

  /**
   * Calculate efficiency analysis
   */
  private calculateEfficiency(variantResults: ABVariantResult[]): any {
    // Find best quality (highest NDCG)
    const bestQuality = variantResults.reduce((best, current) =>
      current.metrics.ndcg > best.metrics.ndcg ? current : best
    );

    // Find cheapest (lowest cost - for now, assume local is cheapest)
    const cheapest = variantResults.find(v => v.provider === 'ollama') || variantResults[0];

    // Find fastest (lowest latency)
    const fastest = variantResults.reduce((fastest, current) =>
      current.usage.avgLatency < fastest.usage.avgLatency ? current : fastest
    );

    // Best value (quality/cost ratio)
    const bestValue = variantResults[0]; // Simplified for now

    return {
      bestQuality: bestQuality.variantId,
      cheapest: cheapest.variantId,
      fastest: fastest.variantId,
      bestValue: bestValue.variantId,
      paretoFrontier: variantResults.map(v => v.variantId),
    };
  }

  /**
   * Save results to filesystem
   */
  private async saveResults(result: ABTestResult): Promise<void> {
    const outputDir = path.join(process.cwd(), '.embedeval', 'runs', this.testId, 'results');
    await fs.ensureDir(outputDir);

    // Save JSON results
    const jsonPath = path.join(outputDir, 'metrics.json');
    await fs.writeJson(jsonPath, result, { spaces: 2 });

    logger.info(`Results saved to: ${jsonPath}`);
  }

  /**
   * Get test ID
   */
  getTestId(): string {
    return this.testId;
  }

  /**
   * Clean up resources
   */
  async close(): Promise<void> {
    await this.processor.close();
    logger.info('A/B testing engine closed');
  }
}

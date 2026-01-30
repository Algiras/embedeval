/**
 * Knowledge Base for Self-Evolving Embedding Researcher
 * 
 * Stores and retrieves learnings from experiments, including:
 * - Experiment history
 * - Model performance profiles
 * - Strategy performance profiles
 * - Failure patterns
 * - Best practices
 * - Strategy lineage (evolution history)
 * 
 * @module evolution/knowledge-base
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  ExperimentRecord,
  ModelProfile,
  StrategyProfile,
  FailurePattern,
  BestPractice,
  StrategyGenome,
  ABTestResult,
} from '../core/types';
import { logger } from '../utils/logger';

/**
 * Knowledge Base Schema
 */
interface KnowledgeBaseData {
  version: string;
  createdAt: string;
  updatedAt: string;
  
  experiments: ExperimentRecord[];
  modelProfiles: Record<string, ModelProfile>;
  strategyProfiles: Record<string, StrategyProfile>;
  failurePatterns: FailurePattern[];
  bestPractices: BestPractice[];
  strategyLineage: StrategyGenome[];
  
  // Aggregate statistics
  stats: {
    totalExperiments: number;
    totalQueries: number;
    modelsEvaluated: number;
    strategiesEvaluated: number;
    avgImprovement: number;
  };
}

/**
 * Query options for knowledge base
 */
interface QueryOptions {
  domain?: string;
  metric?: string;
  minScore?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Knowledge Base for storing and querying experiment learnings
 */
export class KnowledgeBase {
  private data: KnowledgeBaseData;
  private dataPath: string;
  private dirty: boolean = false;
  private autoSaveInterval?: NodeJS.Timeout;

  constructor(basePath: string = '.embedeval/knowledge') {
    this.dataPath = path.resolve(basePath, 'knowledge-base.json');
    this.data = this.initializeData();
  }

  /**
   * Initialize or load knowledge base
   */
  private initializeData(): KnowledgeBaseData {
    if (fs.existsSync(this.dataPath)) {
      try {
        const loaded = fs.readJsonSync(this.dataPath);
        logger.info(`Loaded knowledge base with ${loaded.experiments?.length || 0} experiments`);
        return loaded;
      } catch (error) {
        logger.warn('Failed to load knowledge base, creating new one');
      }
    }
    
    return {
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      experiments: [],
      modelProfiles: {},
      strategyProfiles: {},
      failurePatterns: [],
      bestPractices: [],
      strategyLineage: [],
      stats: {
        totalExperiments: 0,
        totalQueries: 0,
        modelsEvaluated: 0,
        strategiesEvaluated: 0,
        avgImprovement: 0,
      },
    };
  }

  /**
   * Initialize the knowledge base (create directories, load data)
   */
  async initialize(): Promise<void> {
    await fs.ensureDir(path.dirname(this.dataPath));
    
    // Start auto-save every 30 seconds if dirty
    this.autoSaveInterval = setInterval(() => {
      if (this.dirty) {
        this.save().catch(err => logger.error('Auto-save failed:', err));
      }
    }, 30000);
    
    logger.info('Knowledge base initialized');
  }

  /**
   * Save knowledge base to disk
   */
  async save(): Promise<void> {
    this.data.updatedAt = new Date().toISOString();
    await fs.writeJson(this.dataPath, this.data, { spaces: 2 });
    this.dirty = false;
    logger.debug('Knowledge base saved');
  }

  /**
   * Close knowledge base (save and cleanup)
   */
  async close(): Promise<void> {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }
    if (this.dirty) {
      await this.save();
    }
    logger.info('Knowledge base closed');
  }

  // ============================================================================
  // Experiment Records
  // ============================================================================

  /**
   * Record a completed experiment
   */
  async recordExperiment(result: ABTestResult, metadata?: Partial<ExperimentRecord>): Promise<ExperimentRecord> {
    const record: ExperimentRecord = {
      id: result.testId,
      name: result.testName,
      hypothesis: metadata?.hypothesis,
      timestamp: result.timestamp,
      duration: metadata?.duration || 0,
      corpus: metadata?.corpus || 'unknown',
      queryCount: result.variants[0]?.perQueryResults?.length || 0,
      variants: result.variants.map(v => ({
        name: v.variantName,
        strategy: v.strategy || 'baseline',
        provider: v.provider,
        model: v.model,
      })),
      results: {},
      outcome: 'completed',
      learnings: metadata?.learnings || [],
      tags: metadata?.tags || [],
    };

    // Extract metrics per variant
    for (const variant of result.variants) {
      record.results[variant.variantName] = variant.metrics;
    }

    // Determine winner
    if (result.efficiency?.bestQuality) {
      const winner = result.variants.find(v => v.variantId === result.efficiency.bestQuality);
      record.winner = winner?.variantName;
    }

    this.data.experiments.push(record);
    this.data.stats.totalExperiments++;
    this.data.stats.totalQueries += record.queryCount;
    
    // Update model and strategy profiles
    for (const variant of result.variants) {
      await this.updateModelProfile(variant);
      await this.updateStrategyProfile(variant);
    }

    this.dirty = true;
    logger.info(`Recorded experiment: ${record.name}`);
    
    return record;
  }

  /**
   * Get experiments by filter
   */
  getExperiments(options?: QueryOptions): ExperimentRecord[] {
    let results = [...this.data.experiments];

    if (options?.domain) {
      results = results.filter(e => e.tags.includes(options.domain!));
    }

    if (options?.sortBy) {
      results.sort((a, b) => {
        const aVal = (a as any)[options.sortBy!];
        const bVal = (b as any)[options.sortBy!];
        return options.sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
      });
    }

    if (options?.limit) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  /**
   * Get recent experiments
   */
  getRecentExperiments(limit: number = 10): ExperimentRecord[] {
    return [...this.data.experiments]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  // ============================================================================
  // Model Profiles
  // ============================================================================

  /**
   * Update model performance profile from evaluation results
   */
  private async updateModelProfile(variant: any): Promise<void> {
    const modelId = `${variant.provider}:${variant.model}`;
    
    const existing = this.data.modelProfiles[modelId] || {
      modelId,
      provider: variant.provider,
      dimensions: 0,
      avgLatency: 0,
      p95Latency: 0,
      costPer1kTokens: 0,
      strengthDomains: [],
      weaknessDomains: [],
      performanceByMetric: {},
      experimentCount: 0,
      lastUpdated: new Date().toISOString(),
    };

    // Update with running average
    const n = existing.experimentCount;
    existing.avgLatency = (existing.avgLatency * n + variant.usage.avgLatency) / (n + 1);
    existing.p95Latency = (existing.p95Latency * n + variant.usage.p95Latency) / (n + 1);
    
    // Update performance by metric
    for (const [metric, value] of Object.entries(variant.metrics)) {
      const current = existing.performanceByMetric[metric] || 0;
      existing.performanceByMetric[metric] = (current * n + (value as number)) / (n + 1);
    }
    
    existing.experimentCount++;
    existing.lastUpdated = new Date().toISOString();
    
    this.data.modelProfiles[modelId] = existing;
    this.data.stats.modelsEvaluated = Object.keys(this.data.modelProfiles).length;
  }

  /**
   * Get model profile
   */
  getModelProfile(modelId: string): ModelProfile | undefined {
    return this.data.modelProfiles[modelId];
  }

  /**
   * Get all model profiles
   */
  getAllModelProfiles(): ModelProfile[] {
    return Object.values(this.data.modelProfiles);
  }

  /**
   * Get best models for a metric
   */
  getBestModels(metric: string, limit: number = 5): ModelProfile[] {
    return Object.values(this.data.modelProfiles)
      .filter(m => m.performanceByMetric[metric] !== undefined)
      .sort((a, b) => (b.performanceByMetric[metric] || 0) - (a.performanceByMetric[metric] || 0))
      .slice(0, limit);
  }

  // ============================================================================
  // Strategy Profiles
  // ============================================================================

  /**
   * Update strategy performance profile
   */
  private async updateStrategyProfile(variant: any): Promise<void> {
    const strategyName = variant.strategy || 'baseline';
    
    const existing = this.data.strategyProfiles[strategyName] || {
      strategyName,
      avgNdcg: 0,
      avgRecall: 0,
      avgLatency: 0,
      avgCost: 0,
      bestForContexts: [],
      worstForContexts: [],
      experimentCount: 0,
      lastUpdated: new Date().toISOString(),
    };

    const n = existing.experimentCount;
    existing.avgNdcg = (existing.avgNdcg * n + (variant.metrics.ndcg10 || 0)) / (n + 1);
    existing.avgRecall = (existing.avgRecall * n + (variant.metrics.recall10 || 0)) / (n + 1);
    existing.avgLatency = (existing.avgLatency * n + variant.usage.avgLatency) / (n + 1);
    existing.avgCost = (existing.avgCost * n + variant.usage.totalCost) / (n + 1);
    existing.experimentCount++;
    existing.lastUpdated = new Date().toISOString();
    
    this.data.strategyProfiles[strategyName] = existing;
    this.data.stats.strategiesEvaluated = Object.keys(this.data.strategyProfiles).length;
  }

  /**
   * Get strategy profile
   */
  getStrategyProfile(strategyName: string): StrategyProfile | undefined {
    return this.data.strategyProfiles[strategyName];
  }

  /**
   * Get best strategies for a context
   */
  getBestStrategies(options?: { metric?: string; limit?: number }): StrategyProfile[] {
    const metric = options?.metric || 'avgNdcg';
    const limit = options?.limit || 5;
    
    return Object.values(this.data.strategyProfiles)
      .sort((a, b) => (b as any)[metric] - (a as any)[metric])
      .slice(0, limit);
  }

  // ============================================================================
  // Failure Patterns
  // ============================================================================

  /**
   * Record a failure pattern
   */
  async recordFailurePattern(pattern: Omit<FailurePattern, 'id' | 'createdAt' | 'lastSeen'>): Promise<FailurePattern> {
    // Check if similar pattern exists
    const existing = this.data.failurePatterns.find(p => p.pattern === pattern.pattern);
    
    if (existing) {
      existing.frequency++;
      existing.examples = [...existing.examples, ...pattern.examples].slice(-10);  // Keep last 10
      existing.lastSeen = new Date().toISOString();
      this.dirty = true;
      return existing;
    }

    const newPattern: FailurePattern = {
      ...pattern,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
    };

    this.data.failurePatterns.push(newPattern);
    this.dirty = true;
    
    logger.info(`Recorded failure pattern: ${pattern.pattern}`);
    return newPattern;
  }

  /**
   * Get failure patterns
   */
  getFailurePatterns(options?: { minFrequency?: number; limit?: number }): FailurePattern[] {
    let results = [...this.data.failurePatterns];
    
    if (options?.minFrequency) {
      results = results.filter(p => p.frequency >= options.minFrequency!);
    }
    
    results.sort((a, b) => b.frequency - a.frequency);
    
    if (options?.limit) {
      results = results.slice(0, options.limit);
    }
    
    return results;
  }

  // ============================================================================
  // Best Practices
  // ============================================================================

  /**
   * Record a best practice
   */
  async recordBestPractice(practice: Omit<BestPractice, 'id' | 'createdAt'>): Promise<BestPractice> {
    const newPractice: BestPractice = {
      ...practice,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
    };

    this.data.bestPractices.push(newPractice);
    this.dirty = true;
    
    logger.info(`Recorded best practice: ${practice.title}`);
    return newPractice;
  }

  /**
   * Get best practices
   */
  getBestPractices(context?: string): BestPractice[] {
    if (context) {
      return this.data.bestPractices.filter(p => 
        p.context.toLowerCase().includes(context.toLowerCase())
      );
    }
    return [...this.data.bestPractices];
  }

  // ============================================================================
  // Strategy Lineage (Evolution History)
  // ============================================================================

  /**
   * Record a strategy genome
   */
  async recordGenome(genome: StrategyGenome): Promise<void> {
    this.data.strategyLineage.push(genome);
    this.dirty = true;
  }

  /**
   * Get strategy lineage
   */
  getStrategyLineage(options?: { generation?: number; limit?: number }): StrategyGenome[] {
    let results = [...this.data.strategyLineage];
    
    if (options?.generation !== undefined) {
      results = results.filter(g => g.generation === options.generation);
    }
    
    results.sort((a, b) => (b.fitness || 0) - (a.fitness || 0));
    
    if (options?.limit) {
      results = results.slice(0, options.limit);
    }
    
    return results;
  }

  /**
   * Get best genomes
   */
  getBestGenomes(limit: number = 5): StrategyGenome[] {
    return [...this.data.strategyLineage]
      .filter(g => g.fitness !== undefined)
      .sort((a, b) => (b.fitness || 0) - (a.fitness || 0))
      .slice(0, limit);
  }

  // ============================================================================
  // Insights & Recommendations
  // ============================================================================

  /**
   * Generate insights from knowledge base
   */
  generateInsights(): string[] {
    const insights: string[] = [];
    
    // Best performing model
    const bestModels = this.getBestModels('ndcg10', 1);
    if (bestModels.length > 0) {
      insights.push(`Best performing model: ${bestModels[0].modelId} (avg NDCG: ${bestModels[0].performanceByMetric.ndcg10?.toFixed(3)})`);
    }
    
    // Best strategy
    const bestStrategies = this.getBestStrategies({ limit: 1 });
    if (bestStrategies.length > 0) {
      insights.push(`Best performing strategy: ${bestStrategies[0].strategyName} (avg NDCG: ${bestStrategies[0].avgNdcg.toFixed(3)})`);
    }
    
    // Common failure patterns
    const topPatterns = this.getFailurePatterns({ limit: 3 });
    for (const pattern of topPatterns) {
      insights.push(`Common failure: ${pattern.pattern} (${pattern.frequency} occurrences) - Fix: ${pattern.suggestedFix}`);
    }
    
    // Statistics
    insights.push(`Total experiments: ${this.data.stats.totalExperiments}`);
    insights.push(`Models evaluated: ${this.data.stats.modelsEvaluated}`);
    insights.push(`Strategies evaluated: ${this.data.stats.strategiesEvaluated}`);
    
    return insights;
  }

  /**
   * Get recommendations for a context
   */
  getRecommendations(context: {
    domain?: string;
    documentLength?: 'short' | 'long';
    queryType?: string;
    constraint?: 'quality' | 'speed' | 'cost';
  }): string[] {
    const recommendations: string[] = [];
    
    // Strategy recommendations based on context
    if (context.documentLength === 'long') {
      const chunkingStrategies = Object.values(this.data.strategyProfiles)
        .filter(s => s.strategyName.includes('chunk'));
      if (chunkingStrategies.length > 0) {
        const best = chunkingStrategies.sort((a, b) => b.avgNdcg - a.avgNdcg)[0];
        recommendations.push(`For long documents, try ${best.strategyName} (avg NDCG: ${best.avgNdcg.toFixed(3)})`);
      }
    }
    
    // Model recommendations based on constraint
    if (context.constraint === 'speed') {
      const fastModels = Object.values(this.data.modelProfiles)
        .sort((a, b) => a.avgLatency - b.avgLatency)
        .slice(0, 3);
      if (fastModels.length > 0) {
        recommendations.push(`Fastest models: ${fastModels.map(m => `${m.modelId} (${m.avgLatency.toFixed(0)}ms)`).join(', ')}`);
      }
    }
    
    if (context.constraint === 'quality') {
      const bestModels = this.getBestModels('ndcg10', 3);
      if (bestModels.length > 0) {
        recommendations.push(`Highest quality models: ${bestModels.map(m => `${m.modelId} (NDCG: ${m.performanceByMetric.ndcg10?.toFixed(3)})`).join(', ')}`);
      }
    }
    
    // Best practices for context
    const practices = this.getBestPractices(context.domain);
    for (const practice of practices.slice(0, 3)) {
      recommendations.push(`${practice.title}: ${practice.recommendation}`);
    }
    
    return recommendations;
  }

  // ============================================================================
  // Statistics
  // ============================================================================

  /**
   * Get knowledge base statistics
   */
  getStats(): typeof this.data.stats & { 
    totalPatterns: number; 
    totalPractices: number;
    totalGenomes: number;
  } {
    return {
      ...this.data.stats,
      totalPatterns: this.data.failurePatterns.length,
      totalPractices: this.data.bestPractices.length,
      totalGenomes: this.data.strategyLineage.length,
    };
  }
}

// Export singleton for convenience
let defaultKnowledgeBase: KnowledgeBase | null = null;

export function getKnowledgeBase(basePath?: string): KnowledgeBase {
  if (!defaultKnowledgeBase) {
    defaultKnowledgeBase = new KnowledgeBase(basePath);
  }
  return defaultKnowledgeBase;
}

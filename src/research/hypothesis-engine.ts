/**
 * Hypothesis Engine for Self-Evolving Embedding Researcher
 * 
 * Automatically generates experiment hypotheses based on:
 * - Current evaluation results
 * - Failure patterns
 * - Knowledge base learnings
 * - Best practices
 * 
 * @module research/hypothesis-engine
 */

import { v4 as uuidv4 } from 'uuid';
import {
  Hypothesis,
  ABTestResult,
  FailurePattern,
  StrategyProfile,
  ModelProfile,
  EvaluationResult,
} from '../core/types';
import { KnowledgeBase } from '../evolution/knowledge-base';
import { logger } from '../utils/logger';

/**
 * Hypothesis generation rules
 */
interface HypothesisRule {
  id: string;
  name: string;
  description: string;
  condition: (context: HypothesisContext) => boolean;
  generate: (context: HypothesisContext) => Hypothesis | null;
  priority: number;
}

/**
 * Context for hypothesis generation
 */
interface HypothesisContext {
  currentResults?: ABTestResult;
  failurePatterns: FailurePattern[];
  strategyProfiles: StrategyProfile[];
  modelProfiles: ModelProfile[];
  currentStrategy: string;
  currentModel: string;
  queryAnalysis?: {
    avgQueryLength: number;
    avgDocLength: number;
    numQueries: number;
    failureRate: number;
    lowPerformingQueries: EvaluationResult[];
  };
}

/**
 * Built-in hypothesis rules
 */
const HYPOTHESIS_RULES: HypothesisRule[] = [
  // Rule 1: Long document chunking
  {
    id: 'long-doc-chunking',
    name: 'Long Document Chunking',
    description: 'Suggest chunking for long documents',
    priority: 90,
    condition: (ctx) => {
      if (!ctx.queryAnalysis) return false;
      return ctx.queryAnalysis.avgDocLength > 1000 && 
             !ctx.currentStrategy.includes('chunk');
    },
    generate: (ctx) => ({
      id: uuidv4(),
      statement: 'Semantic chunking will improve retrieval for long documents',
      rationale: `Average document length is ${ctx.queryAnalysis?.avgDocLength} tokens. Chunking helps find relevant sections within long documents.`,
      baselineStrategy: ctx.currentStrategy,
      challengerStrategy: 'semantic-chunks',
      expectedImprovement: 0.05,
      confidence: 0.7,
      conditions: { documentLength: 'long' },
      status: 'proposed',
      priority: 90,
      createdAt: new Date().toISOString(),
    }),
  },

  // Rule 2: Hybrid BM25 for keyword failures
  {
    id: 'keyword-hybrid',
    name: 'Hybrid BM25 for Keywords',
    description: 'Suggest hybrid retrieval when exact matches fail',
    priority: 85,
    condition: (ctx) => {
      const keywordPattern = ctx.failurePatterns.find(p => 
        p.pattern.includes('keyword') || p.pattern.includes('exact_match')
      );
      return !!keywordPattern && keywordPattern.frequency >= 3;
    },
    generate: (ctx) => ({
      id: uuidv4(),
      statement: 'Hybrid BM25+Embedding will improve exact keyword matching',
      rationale: 'Detected keyword matching failures. BM25 captures exact matches that embeddings may miss.',
      baselineStrategy: ctx.currentStrategy,
      challengerStrategy: 'hybrid-bm25',
      expectedImprovement: 0.08,
      confidence: 0.75,
      status: 'proposed',
      priority: 85,
      createdAt: new Date().toISOString(),
    }),
  },

  // Rule 3: MMR for diversity
  {
    id: 'diversity-mmr',
    name: 'MMR for Diversity',
    description: 'Suggest MMR when results lack diversity',
    priority: 70,
    condition: (ctx) => {
      const diversityPattern = ctx.failurePatterns.find(p => 
        p.pattern.includes('diversity') || p.pattern.includes('redundant')
      );
      return !!diversityPattern;
    },
    generate: (ctx) => ({
      id: uuidv4(),
      statement: 'MMR reranking will improve result diversity',
      rationale: 'Detected redundant or similar results. MMR balances relevance with diversity.',
      baselineStrategy: ctx.currentStrategy,
      challengerStrategy: 'mmr-diversity',
      expectedImprovement: 0.03,
      confidence: 0.6,
      status: 'proposed',
      priority: 70,
      createdAt: new Date().toISOString(),
    }),
  },

  // Rule 4: Model upgrade
  {
    id: 'model-upgrade',
    name: 'Better Model Available',
    description: 'Suggest upgrading to a better performing model',
    priority: 80,
    condition: (ctx) => {
      const currentProfile = ctx.modelProfiles.find(m => m.modelId === ctx.currentModel);
      if (!currentProfile) return false;
      
      const betterModels = ctx.modelProfiles.filter(m => 
        m.modelId !== ctx.currentModel &&
        (m.performanceByMetric.ndcg10 || 0) > (currentProfile.performanceByMetric.ndcg10 || 0) * 1.05
      );
      
      return betterModels.length > 0;
    },
    generate: (ctx) => {
      const currentProfile = ctx.modelProfiles.find(m => m.modelId === ctx.currentModel);
      const betterModels = ctx.modelProfiles
        .filter(m => m.modelId !== ctx.currentModel)
        .sort((a, b) => (b.performanceByMetric.ndcg10 || 0) - (a.performanceByMetric.ndcg10 || 0));
      
      if (betterModels.length === 0) return null;
      
      const suggested = betterModels[0];
      const improvement = ((suggested.performanceByMetric.ndcg10 || 0) - 
                          (currentProfile?.performanceByMetric.ndcg10 || 0)) / 
                         (currentProfile?.performanceByMetric.ndcg10 || 1);
      
      return {
        id: uuidv4(),
        statement: `Upgrading to ${suggested.modelId} may improve retrieval quality`,
        rationale: `${suggested.modelId} shows ${(improvement * 100).toFixed(1)}% better NDCG in historical tests.`,
        baselineStrategy: ctx.currentStrategy,
        challengerStrategy: ctx.currentStrategy,  // Same strategy, different model
        expectedImprovement: improvement,
        confidence: 0.65,
        status: 'proposed',
        priority: 80,
        createdAt: new Date().toISOString(),
      };
    },
  },

  // Rule 5: High failure rate
  {
    id: 'high-failure-rate',
    name: 'High Failure Rate Investigation',
    description: 'Suggest investigation when failure rate is high',
    priority: 95,
    condition: (ctx) => {
      return ctx.queryAnalysis !== undefined && ctx.queryAnalysis.failureRate > 0.3;
    },
    generate: (ctx) => ({
      id: uuidv4(),
      statement: 'Full pipeline strategy may address high failure rate',
      rationale: `Current failure rate is ${(ctx.queryAnalysis!.failureRate * 100).toFixed(1)}%. A comprehensive approach combining chunking, hybrid retrieval, and reranking may help.`,
      baselineStrategy: ctx.currentStrategy,
      challengerStrategy: 'full-pipeline',
      expectedImprovement: 0.15,
      confidence: 0.5,
      status: 'proposed',
      priority: 95,
      createdAt: new Date().toISOString(),
    }),
  },

  // Rule 6: LLM reranking for precision
  {
    id: 'precision-reranking',
    name: 'LLM Reranking for Precision',
    description: 'Suggest LLM reranking when precision matters',
    priority: 75,
    condition: (ctx) => {
      // If current recall is high but precision/MRR is low
      if (!ctx.currentResults) return false;
      const baseline = ctx.currentResults.variants[0]?.metrics;
      if (!baseline) return false;
      
      return (baseline.recall10 || 0) > 0.7 && (baseline.mrr10 || 0) < 0.5;
    },
    generate: (ctx) => ({
      id: uuidv4(),
      statement: 'LLM reranking will improve precision while maintaining recall',
      rationale: 'High recall but low MRR suggests relevant docs are found but not ranked optimally. LLM reranking can improve top-k quality.',
      baselineStrategy: ctx.currentStrategy,
      challengerStrategy: 'llm-reranked',
      expectedImprovement: 0.1,
      confidence: 0.7,
      status: 'proposed',
      priority: 75,
      createdAt: new Date().toISOString(),
    }),
  },

  // Rule 7: Cost optimization
  {
    id: 'cost-optimization',
    name: 'Cost Optimization',
    description: 'Suggest cheaper alternatives when quality is sufficient',
    priority: 60,
    condition: (ctx) => {
      if (!ctx.currentResults) return false;
      const baseline = ctx.currentResults.variants[0];
      if (!baseline) return false;
      
      // If quality is good (>0.75 NDCG) and using expensive provider
      return (baseline.metrics.ndcg10 || 0) > 0.75 && 
             (baseline.provider === 'openai' || baseline.provider === 'google');
    },
    generate: (ctx) => {
      const cheaperModels = ctx.modelProfiles.filter(m => 
        m.provider === 'ollama' || m.provider === 'huggingface'
      ).sort((a, b) => (b.performanceByMetric.ndcg10 || 0) - (a.performanceByMetric.ndcg10 || 0));
      
      if (cheaperModels.length === 0) return null;
      
      return {
        id: uuidv4(),
        statement: `Local model ${cheaperModels[0].modelId} may provide similar quality at lower cost`,
        rationale: 'Current quality exceeds threshold. Consider cheaper local alternatives.',
        baselineStrategy: ctx.currentStrategy,
        challengerStrategy: ctx.currentStrategy,
        expectedImprovement: -0.02,  // Slight quality drop acceptable
        confidence: 0.5,
        status: 'proposed',
        priority: 60,
        createdAt: new Date().toISOString(),
      };
    },
  },
];

/**
 * Hypothesis Engine - Generates experiment proposals
 */
export class HypothesisEngine {
  private rules: HypothesisRule[];
  private kb: KnowledgeBase;

  constructor(knowledgeBase: KnowledgeBase, customRules?: HypothesisRule[]) {
    this.kb = knowledgeBase;
    this.rules = [...HYPOTHESIS_RULES, ...(customRules || [])];
    this.rules.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Generate hypotheses based on current state
   */
  async generateHypotheses(options: {
    currentResults?: ABTestResult;
    currentStrategy?: string;
    currentModel?: string;
    queryAnalysis?: HypothesisContext['queryAnalysis'];
    maxHypotheses?: number;
  }): Promise<Hypothesis[]> {
    logger.info('Generating hypotheses...');
    
    // Build context
    const context: HypothesisContext = {
      currentResults: options.currentResults,
      failurePatterns: this.kb.getFailurePatterns({ minFrequency: 2 }),
      strategyProfiles: this.kb.getBestStrategies({ limit: 20 }),
      modelProfiles: this.kb.getAllModelProfiles(),
      currentStrategy: options.currentStrategy || 'baseline',
      currentModel: options.currentModel || 'unknown',
      queryAnalysis: options.queryAnalysis,
    };

    // Check for past experiments to avoid repeats
    const recentExperiments = this.kb.getRecentExperiments(20);
    const recentHypotheses = new Set(recentExperiments.map(e => e.hypothesis).filter(Boolean));

    const hypotheses: Hypothesis[] = [];
    const maxHypotheses = options.maxHypotheses || 5;

    // Apply rules in priority order
    for (const rule of this.rules) {
      if (hypotheses.length >= maxHypotheses) break;

      try {
        if (rule.condition(context)) {
          const hypothesis = rule.generate(context);
          
          if (hypothesis && !this.isDuplicate(hypothesis, recentHypotheses)) {
            hypotheses.push(hypothesis);
            logger.info(`Generated hypothesis: ${hypothesis.statement}`);
          }
        }
      } catch (error) {
        logger.warn(`Rule ${rule.id} failed:`, error);
      }
    }

    // Sort by priority
    hypotheses.sort((a, b) => b.priority - a.priority);

    logger.info(`Generated ${hypotheses.length} hypotheses`);
    return hypotheses;
  }

  /**
   * Check if hypothesis is duplicate of recent ones
   */
  private isDuplicate(hypothesis: Hypothesis, recent: Set<string | undefined>): boolean {
    // Check exact match
    if (recent.has(hypothesis.statement)) return true;
    
    // Check similar (same baseline -> challenger)
    for (const existing of recent) {
      if (!existing) continue;
      if (existing.includes(hypothesis.challengerStrategy as string)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Analyze query results to find patterns
   */
  analyzeQueryResults(results: EvaluationResult[]): HypothesisContext['queryAnalysis'] {
    if (results.length === 0) {
      return undefined;
    }

    const queryLengths = results.map(r => r.query.length);
    const avgQueryLength = queryLengths.reduce((a, b) => a + b, 0) / results.length;
    
    // Estimate doc length from retrieved docs
    const docLengths = results.flatMap(r => 
      r.retrievedDocs.map(d => d.content.length)
    );
    const avgDocLength = docLengths.length > 0 
      ? docLengths.reduce((a, b) => a + b, 0) / docLengths.length 
      : 0;

    // Find low performing queries (NDCG < 0.5)
    const lowPerformingQueries = results.filter(r => (r.metrics.ndcg10 || 0) < 0.5);
    const failureRate = lowPerformingQueries.length / results.length;

    return {
      avgQueryLength,
      avgDocLength,
      numQueries: results.length,
      failureRate,
      lowPerformingQueries,
    };
  }

  /**
   * Detect failure patterns from results
   */
  async detectFailurePatterns(results: EvaluationResult[]): Promise<FailurePattern[]> {
    const patterns: FailurePattern[] = [];
    
    // Pattern 1: Long query failures
    const longQueryFailures = results.filter(r => 
      r.query.length > 100 && (r.metrics.ndcg10 || 0) < 0.5
    );
    if (longQueryFailures.length >= 3) {
      const pattern = await this.kb.recordFailurePattern({
        pattern: 'long_query_failure',
        description: 'Queries longer than 100 characters perform poorly',
        frequency: longQueryFailures.length,
        examples: longQueryFailures.slice(0, 3).map(r => ({
          queryId: r.testCaseId,
          query: r.query,
          expectedDocs: [],
          retrievedDocs: r.retrievedDocs.map(d => d.id),
          metrics: r.metrics as Record<string, number>,
        })),
        suggestedFix: 'Try query chunking or summarization',
      });
      patterns.push(pattern);
    }

    // Pattern 2: Zero recall queries
    const zeroRecallQueries = results.filter(r => (r.metrics.recall10 || 0) === 0);
    if (zeroRecallQueries.length >= 2) {
      const pattern = await this.kb.recordFailurePattern({
        pattern: 'zero_recall',
        description: 'Some queries return no relevant results',
        frequency: zeroRecallQueries.length,
        examples: zeroRecallQueries.slice(0, 3).map(r => ({
          queryId: r.testCaseId,
          query: r.query,
          expectedDocs: [],
          retrievedDocs: r.retrievedDocs.map(d => d.id),
          metrics: r.metrics as Record<string, number>,
        })),
        suggestedFix: 'Consider hybrid retrieval or query expansion',
      });
      patterns.push(pattern);
    }

    // Pattern 3: High recall, low precision
    const highRecallLowPrecision = results.filter(r => 
      (r.metrics.recall10 || 0) > 0.8 && (r.metrics.ndcg10 || 0) < 0.5
    );
    if (highRecallLowPrecision.length >= 3) {
      const pattern = await this.kb.recordFailurePattern({
        pattern: 'ranking_issue',
        description: 'Relevant docs found but poorly ranked',
        frequency: highRecallLowPrecision.length,
        examples: highRecallLowPrecision.slice(0, 3).map(r => ({
          queryId: r.testCaseId,
          query: r.query,
          expectedDocs: [],
          retrievedDocs: r.retrievedDocs.map(d => d.id),
          metrics: r.metrics as Record<string, number>,
        })),
        suggestedFix: 'Add reranking stage (LLM or cross-encoder)',
      });
      patterns.push(pattern);
    }

    return patterns;
  }

  /**
   * Prioritize hypotheses for testing
   */
  prioritizeHypotheses(hypotheses: Hypothesis[]): Hypothesis[] {
    return hypotheses.sort((a, b) => {
      // Primary: priority score
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      
      // Secondary: expected improvement
      if (a.expectedImprovement !== b.expectedImprovement) {
        return b.expectedImprovement - a.expectedImprovement;
      }
      
      // Tertiary: confidence
      return b.confidence - a.confidence;
    });
  }

  /**
   * Get next hypothesis to test
   */
  async getNextHypothesis(options: {
    currentResults?: ABTestResult;
    currentStrategy?: string;
    currentModel?: string;
  }): Promise<Hypothesis | null> {
    const hypotheses = await this.generateHypotheses(options);
    const prioritized = this.prioritizeHypotheses(hypotheses);
    return prioritized[0] || null;
  }

  /**
   * Record hypothesis result
   */
  async recordHypothesisResult(
    hypothesis: Hypothesis,
    result: ABTestResult
  ): Promise<void> {
    // Determine if hypothesis was confirmed
    const baseline = result.variants.find(v => 
      v.strategy === hypothesis.baselineStrategy
    );
    const challenger = result.variants.find(v => 
      v.strategy === hypothesis.challengerStrategy
    );

    if (!baseline || !challenger) {
      logger.warn('Could not find baseline or challenger in results');
      return;
    }

    const improvement = ((challenger.metrics.ndcg10 || 0) - (baseline.metrics.ndcg10 || 0)) / 
                       (baseline.metrics.ndcg10 || 1);

    // Find statistical comparison
    const comparison = result.comparisons.find(c => 
      c.baselineVariant === baseline.variantId && 
      c.challengerVariant === challenger.variantId
    );

    hypothesis.status = improvement >= hypothesis.expectedImprovement * 0.8 
      ? 'confirmed' 
      : improvement > 0 
        ? 'inconclusive' 
        : 'rejected';
    
    hypothesis.testedAt = new Date().toISOString();
    hypothesis.result = {
      actualImprovement: improvement,
      pValue: comparison?.statistics.pairedTTest.pValue || 1,
      significant: comparison?.statistics.pairedTTest.isSignificant || false,
    };

    // Record as best practice if confirmed with high significance
    if (hypothesis.status === 'confirmed' && hypothesis.result.significant) {
      await this.kb.recordBestPractice({
        title: `Use ${hypothesis.challengerStrategy} instead of ${hypothesis.baselineStrategy}`,
        description: hypothesis.statement,
        context: hypothesis.conditions?.domain || 'general',
        recommendation: hypothesis.rationale,
        evidence: [{
          experimentId: result.testId,
          improvement: improvement,
        }],
        confidence: hypothesis.result.significant ? 0.9 : 0.6,
      });
    }

    logger.info(`Hypothesis ${hypothesis.status}: ${hypothesis.statement} (actual improvement: ${(improvement * 100).toFixed(1)}%)`);
  }
}

/**
 * Create hypothesis engine with default knowledge base
 */
export function createHypothesisEngine(kbPath?: string): HypothesisEngine {
  const kb = new KnowledgeBase(kbPath);
  return new HypothesisEngine(kb);
}

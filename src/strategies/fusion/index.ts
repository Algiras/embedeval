/**
 * Fusion Strategies for Combining Multiple Retrieval Methods
 */

import { RetrievedDoc } from '../../core/types';
import { StrategyContext, StrategyStage } from '../types';

export interface ReciprocalRankFusionConfig {
  k: number;           // RRF constant (default: 60)
  topK: number;        // Number of results to return
}

/**
 * Reciprocal Rank Fusion (RRF)
 * Combines multiple ranked lists using: score = sum(1 / (k + rank))
 */
export class ReciprocalRankFusionStage implements StrategyStage {
  name = 'rrf-fusion';
  type = 'fusion' as const;

  constructor(private config: ReciprocalRankFusionConfig) {}

  async execute(context: StrategyContext): Promise<StrategyContext> {
    const startTime = Date.now();
    const k = this.config.k ?? 60;
    
    // Collect all result lists
    const resultLists: RetrievedDoc[][] = [];
    
    if (context.retrievedDocs && context.retrievedDocs.length > 0) {
      resultLists.push(context.retrievedDocs);
    }
    
    if (context.bm25Results && context.bm25Results.length > 0) {
      resultLists.push(context.bm25Results);
    }

    if (resultLists.length === 0) {
      throw new Error('No results to fuse');
    }

    // Calculate RRF scores
    const rrfScores: Map<string, { score: number; doc: RetrievedDoc }> = new Map();

    for (const results of resultLists) {
      for (const doc of results) {
        const rrfScore = 1 / (k + doc.rank);
        
        if (rrfScores.has(doc.id)) {
          const existing = rrfScores.get(doc.id)!;
          existing.score += rrfScore;
        } else {
          rrfScores.set(doc.id, {
            score: rrfScore,
            doc: { ...doc },
          });
        }
      }
    }

    // Sort by RRF score
    const fused = Array.from(rrfScores.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, this.config.topK)
      .map((item, index) => ({
        ...item.doc,
        score: item.score,
        rank: index + 1,
      }));

    const duration = Date.now() - startTime;
    context.fusedResults = fused;
    context.stageTimings.set('fusion', duration);
    context.stageMetadata.set('fusion', {
      method: 'rrf',
      k,
      numLists: resultLists.length,
      numResults: fused.length,
    });

    return context;
  }
}

export interface WeightedFusionConfig {
  weights: number[];   // Weights for each result list (must sum to 1)
  topK: number;
}

/**
 * Weighted Fusion
 * Combines scores using weighted sum
 */
export class WeightedFusionStage implements StrategyStage {
  name = 'weighted-fusion';
  type = 'fusion' as const;

  constructor(private config: WeightedFusionConfig) {}

  async execute(context: StrategyContext): Promise<StrategyContext> {
    const startTime = Date.now();
    
    // Collect all result lists
    const resultLists: RetrievedDoc[][] = [];
    
    if (context.retrievedDocs && context.retrievedDocs.length > 0) {
      resultLists.push(context.retrievedDocs);
    }
    
    if (context.bm25Results && context.bm25Results.length > 0) {
      resultLists.push(context.bm25Results);
    }

    if (resultLists.length === 0) {
      throw new Error('No results to fuse');
    }

    if (this.config.weights.length !== resultLists.length) {
      throw new Error(`Number of weights (${this.config.weights.length}) must match number of result lists (${resultLists.length})`);
    }

    // Normalize scores within each list to [0, 1]
    const normalizedLists = resultLists.map(list => {
      const maxScore = Math.max(...list.map(d => d.score));
      const minScore = Math.min(...list.map(d => d.score));
      const range = maxScore - minScore;
      
      return list.map(doc => ({
        ...doc,
        normalizedScore: range === 0 ? 1 : (doc.score - minScore) / range,
      }));
    });

    // Calculate weighted scores
    const weightedScores: Map<string, { score: number; doc: RetrievedDoc }> = new Map();

    for (let i = 0; i < normalizedLists.length; i++) {
      const weight = this.config.weights[i];
      
      for (const doc of normalizedLists[i]) {
        const weightedScore = (doc as any).normalizedScore * weight;
        
        if (weightedScores.has(doc.id)) {
          const existing = weightedScores.get(doc.id)!;
          existing.score += weightedScore;
        } else {
          weightedScores.set(doc.id, {
            score: weightedScore,
            doc: { ...doc },
          });
        }
      }
    }

    // Sort by weighted score
    const fused = Array.from(weightedScores.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, this.config.topK)
      .map((item, index) => ({
        ...item.doc,
        score: item.score,
        rank: index + 1,
      }));

    const duration = Date.now() - startTime;
    context.fusedResults = fused;
    context.stageTimings.set('fusion', duration);
    context.stageMetadata.set('fusion', {
      method: 'weighted',
      weights: this.config.weights,
      numResults: fused.length,
    });

    return context;
  }
}

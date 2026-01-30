/**
 * Evaluation Metrics Implementation
 * NDCG, Recall, MRR, MAP
 */

import { RetrievedDoc } from '../../types';

/**
 * Calculate DCG (Discounted Cumulative Gain)
 */
function calculateDCG(relevances: number[]): number {
  return relevances.reduce((dcg, rel, index) => {
    const rank = index + 1;
    return dcg + rel / Math.log2(rank + 1);
  }, 0);
}

/**
 * Calculate NDCG@K (Normalized Discounted Cumulative Gain)
 */
export function calculateNDCG(
  retrievedDocs: RetrievedDoc[],
  relevantDocIds: string[],
  relevanceScores?: number[],
  k: number = 10
): number {
  const topK = retrievedDocs.slice(0, k);
  
  // Create relevance array (1 if relevant, 0 if not)
  const relevances = topK.map(doc => {
    const index = relevantDocIds.indexOf(doc.id);
    if (index === -1) return 0;
    return relevanceScores ? relevanceScores[index] : 1;
  });

  // Calculate DCG
  const dcg = calculateDCG(relevances);

  // Calculate ideal DCG (relevances sorted by relevance)
  const idealRelevances = [...relevances].sort((a, b) => b - a);
  const idcg = calculateDCG(idealRelevances);

  // Return NDCG
  return idcg === 0 ? 0 : dcg / idcg;
}

/**
 * Calculate Recall@K
 */
export function calculateRecall(
  retrievedDocs: RetrievedDoc[],
  relevantDocIds: string[],
  k: number = 10
): number {
  if (relevantDocIds.length === 0) return 0;

  const topK = retrievedDocs.slice(0, k);
  const retrievedRelevant = topK.filter(doc => doc.isRelevant).length;

  return retrievedRelevant / relevantDocIds.length;
}

/**
 * Calculate MRR@K (Mean Reciprocal Rank)
 */
export function calculateMRR(
  retrievedDocs: RetrievedDoc[],
  k: number = 10
): number {
  const topK = retrievedDocs.slice(0, k);
  
  // Find first relevant document
  for (let i = 0; i < topK.length; i++) {
    if (topK[i].isRelevant) {
      return 1 / (i + 1);
    }
  }

  return 0;
}

/**
 * Calculate MAP@K (Mean Average Precision)
 */
export function calculateMAP(
  retrievedDocs: RetrievedDoc[],
  relevantDocIds: string[],
  k: number = 10
): number {
  if (relevantDocIds.length === 0) return 0;

  const topK = retrievedDocs.slice(0, k);
  let relevantCount = 0;
  let precisionSum = 0;

  for (let i = 0; i < topK.length; i++) {
    if (topK[i].isRelevant) {
      relevantCount++;
      precisionSum += relevantCount / (i + 1);
    }
  }

  return relevantCount === 0 ? 0 : precisionSum / relevantDocIds.length;
}

/**
 * Calculate Hit Rate@K
 */
export function calculateHitRate(
  retrievedDocs: RetrievedDoc[],
  k: number = 10
): number {
  const topK = retrievedDocs.slice(0, k);
  const hasRelevant = topK.some(doc => doc.isRelevant);
  return hasRelevant ? 1 : 0;
}

/**
 * Calculate all metrics at once
 */
export function calculateAllMetrics(
  retrievedDocs: RetrievedDoc[],
  relevantDocIds: string[],
  relevanceScores?: number[],
  k: number = 10
): {
  ndcg: number;
  recall: number;
  mrr: number;
  map: number;
  hitRate: number;
} {
  return {
    ndcg: calculateNDCG(retrievedDocs, relevantDocIds, relevanceScores, k),
    recall: calculateRecall(retrievedDocs, relevantDocIds, k),
    mrr: calculateMRR(retrievedDocs, k),
    map: calculateMAP(retrievedDocs, relevantDocIds, k),
    hitRate: calculateHitRate(retrievedDocs, k),
  };
}

/**
 * Calculate metrics for multiple K values
 */
export function calculateMetricsAtMultipleK(
  retrievedDocs: RetrievedDoc[],
  relevantDocIds: string[],
  relevanceScores?: number[],
  kValues: number[] = [5, 10]
): Record<string, number> {
  const metrics: Record<string, number> = {};

  for (const k of kValues) {
    const kMetrics = calculateAllMetrics(retrievedDocs, relevantDocIds, relevanceScores, k);
    
    metrics[`ndcg@${k}`] = kMetrics.ndcg;
    metrics[`recall@${k}`] = kMetrics.recall;
    metrics[`mrr@${k}`] = kMetrics.mrr;
    metrics[`map@${k}`] = kMetrics.map;
    metrics[`hitRate@${k}`] = kMetrics.hitRate;
  }

  return metrics;
}

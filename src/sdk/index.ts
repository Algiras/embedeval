/**
 * EmbedEval SDK - Programmatic API for Agent Self-Evaluation
 * 
 * Use this SDK to evaluate LLM responses programmatically without CLI.
 * Designed for agents to self-evaluate in real-time.
 * 
 * @example
 * ```typescript
 * import { evaluate, preflight, selfAssess } from 'embedeval';
 * 
 * // Quick preflight check before sending response
 * const check = await preflight(response, query);
 * if (!check.passed) {
 *   // Revise response
 * }
 * 
 * // Full evaluation with custom evals
 * const result = await evaluate(response, {
 *   query,
 *   context,
 *   evals: ['coherence', 'factual', 'helpful']
 * });
 * 
 * // Self-assessment for price/speed/quality
 * const assessment = await selfAssess(traceHistory);
 * ```
 */

export * from './evaluate';
export * from './preflight';
export * from './collector';
export * from './confidence';
export * from './suggestions';
export * from './types';

// Re-export metrics
export {
  generateSelfAssessment,
  calculateSpeedMetrics,
  calculateQualityMetrics,
  compareModels,
  detectDrift,
  recommendModel,
  MODEL_PRICING,
} from '../evals/metrics';

// Re-export providers
export {
  createJudge,
  createProviders,
  getBestProvider,
  listProviders,
  benchmarkProviders,
} from '../utils/llm-providers';

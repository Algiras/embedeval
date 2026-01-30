/**
 * Research Module - Research Automation for Embedding Evaluation
 * 
 * This module provides tools for automated research:
 * - Synthetic query generation
 * - Hypothesis generation and testing
 * - Failure analysis
 * 
 * @module research
 */

// Synthetic Data Generation
export { 
  SyntheticQueryGenerator,
  generateSyntheticQueries,
} from './synthetic-data';

// Hypothesis Engine
export {
  HypothesisEngine,
  createHypothesisEngine,
} from './hypothesis-engine';

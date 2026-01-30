/**
 * Evolution Module - Self-Evolving Embedding Researcher
 * 
 * This module provides genetic algorithm-based optimization
 * for finding the best embedding retrieval strategies.
 * 
 * @module evolution
 */

// Knowledge Base
export { KnowledgeBase, getKnowledgeBase } from './knowledge-base';

// Strategy Genome
export {
  GENE_DEFINITIONS,
  createRandomGenome,
  createGenomeFromStrategy,
  mutate,
  crossover,
  genomeToStrategy,
  geneticDistance,
  calculateDiversity,
} from './strategy-genome';

// Evolution Engine
export { EvolutionEngine, runEvolution } from './evolution-engine';

// Scheduler
export { EvolutionScheduler, startEvolutionScheduler } from './scheduler';
export type { SchedulerConfig } from './scheduler';

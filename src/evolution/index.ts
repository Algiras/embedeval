/**
 * Evolution Module - Self-Evolving Embedding Researcher
 * 
 * This module provides genetic algorithm-based optimization
 * for finding the best embedding retrieval strategies.
 * 
 * Features:
 * - Genetic algorithm with embedding model as evolvable gene
 * - Multi-objective fitness (correctness, speed, cost)
 * - LLM-as-a-judge semantic evaluation
 * - GitHub Pages report generation
 * 
 * @module evolution
 */

// Knowledge Base
export { KnowledgeBase, getKnowledgeBase } from './knowledge-base';

// Strategy Genome
export {
  GENE_DEFINITIONS,
  EMBEDDING_MODELS,
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

// LLM Judge
export { LLMJudge, createLLMJudge } from './llm-judge';

// Report Generator
export { generateEvolutionReport, updateLandingPage } from './report-generator';
export type { ReportOptions, ReportData } from './report-generator';

// Scheduler
export { EvolutionScheduler, startEvolutionScheduler } from './scheduler';
export type { SchedulerConfig } from './scheduler';

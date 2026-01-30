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
 * - Advanced RAG architectures (hierarchical, graph, multi-hop)
 * - Data-adaptive strategies (different approaches for different query types)
 * - Strategy discovery from research papers
 * - Ensemble methods and fusion strategies
 * 
 * @module evolution
 */

// Knowledge Base
export { KnowledgeBase, getKnowledgeBase } from './knowledge-base';

// Strategy Genome (Basic)
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

// Advanced Genome (Research-backed strategies)
export {
  RAG_ARCHITECTURES,
  EMBEDDING_STRATEGIES,
  QUERY_STRATEGIES,
  RETRIEVAL_METHODS,
  RERANKING_METHODS,
  CHUNKING_STRATEGIES,
  POST_PROCESSING,
  AdvancedGenomeFactory,
  mutateAdvanced,
  crossoverAdvanced,
} from './advanced-genome';
export type {
  StrategyGenes,
  AdvancedStrategyGenome,
  DataTypeProfile,
  ConditionalStrategy,
} from './advanced-genome';

// Adaptive Evolution (Per-query-type optimization)
export {
  QueryClassifier,
  createAdaptiveGenome,
  AdaptiveEvolutionEngine,
} from './adaptive-evolution';
export type {
  AdaptiveGenome,
  AdaptiveEvolutionConfig,
} from './adaptive-evolution';

// Strategy Discovery (Research-based suggestions)
export {
  RESEARCH_PAPERS,
  StrategyDiscoveryEngine,
} from './strategy-discovery';
export type {
  FailurePattern,
  StrategySuggestion,
} from './strategy-discovery';

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

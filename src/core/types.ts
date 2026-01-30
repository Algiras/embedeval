/**
 * Core types and interfaces for EmbedEval
 */

// ============================================================================
// Provider Types
// ============================================================================

export interface ModelInfo {
  name: string;
  dimensions: number;
  maxTokens: number;
  provider: string;
}

export interface EmbeddingProvider {
  name: string;
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  getModelInfo(): ModelInfo;
}

export interface OllamaConfig {
  type: 'ollama';
  baseUrl: string;
  model: string;
}

export interface OpenAIConfig {
  type: 'openai';
  apiKey: string;
  baseUrl?: string;
  model: string;
  organization?: string;
}

export interface GoogleConfig {
  type: 'google';
  apiKey: string;
  model: string;
}

export interface HuggingFaceConfig {
  type: 'huggingface';
  model: string;
  apiKey?: string;
  endpoint?: string;
  useInferenceAPI?: boolean;
}

export type ProviderConfig = OllamaConfig | OpenAIConfig | GoogleConfig | HuggingFaceConfig;

// ============================================================================
// Dataset Types
// ============================================================================

export interface Document {
  id: string;
  content: string;
  metadata?: Record<string, any>;
}

export interface TestCase {
  id: string;
  query: string;
  relevantDocs: string[];
  relevanceScores?: number[];
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface Dataset {
  id: string;
  name: string;
  testCases: TestCase[];
  documents: Document[];
  createdAt: string;
}

// ============================================================================
// Evaluation Types
// ============================================================================

export interface RetrievedDoc {
  id: string;
  content: string;
  score: number;
  rank: number;
  isRelevant: boolean;
}

export interface UsageMetrics {
  tokens: {
    input: number;
    total: number;
  };
  cost: {
    input: number;
    total: number;
    currency: string;
  };
  latency: {
    total: number;
    embedding: number;
  };
}

export interface EvaluationResult {
  testCaseId: string;
  query: string;
  retrievedDocs: RetrievedDoc[];
  metrics: {
    ndcg?: number;
    ndcg5?: number;
    ndcg10?: number;
    recall?: number;
    recall5?: number;
    recall10?: number;
    mrr?: number;
    mrr10?: number;
    map?: number;
    map10?: number;
    hitRate?: number;
    hitRate10?: number;
  };
  usage: UsageMetrics;
  timestamp: string;
}

// ============================================================================
// A/B Testing Types
// ============================================================================

export interface ABVariant {
  id: string;
  name: string;
  provider: ProviderConfig;
  strategy: string;
  description?: string;
}

export interface ABTestConfig {
  id: string;
  name: string;
  description?: string;
  variants: ABVariant[];
  dataset: string;
  corpus?: string;
  metrics: string[];
  gates?: GateConfig;
  output: {
    json?: string;
    dashboard?: string;
    sideBySide?: string;
    csv?: string;
  };
}

export interface ABVariantResult {
  variantId: string;
  variantName: string;
  provider: string;
  model: string;
  strategy?: string;
  metrics: Record<string, number>;
  usage: {
    totalTokens: number;
    totalCost: number;
    avgLatency: number;
    p50Latency: number;
    p95Latency: number;
    p99Latency: number;
  };
  perQueryResults: EvaluationResult[];
  failedQueries: string[];
}

export interface StatisticalResult {
  metric: string;
  pairedTTest: {
    tStatistic: number;
    pValue: number;
    isSignificant: boolean;
    confidenceInterval: [number, number];
  };
  wilcoxon?: {
    wStatistic: number;
    pValue: number;
    isSignificant: boolean;
  };
  effectSize: number;
  interpretation: string;
}

export interface MetricComparison {
  metric: string;
  baselineVariant: string;
  challengerVariant: string;
  baselineValue: number;
  challengerValue: number;
  improvement: number;
  statistics: StatisticalResult;
}

export interface EfficiencyAnalysis {
  bestQuality: string;
  cheapest: string;
  fastest: string;
  bestValue: string;
  paretoFrontier: string[];
}

export interface ABTestResult {
  testId: string;
  testName: string;
  timestamp: string;
  variants: ABVariantResult[];
  comparisons: MetricComparison[];
  efficiency: EfficiencyAnalysis;
}

// ============================================================================
// Pipeline Types
// ============================================================================

export interface PipelineContext {
  query: string;
  documents: Document[];
  embeddings?: Map<string, number[]>;
  scores?: Map<string, number>;
  retrievedDocs?: RetrievedDoc[];
  rerankedDocs?: RetrievedDoc[];
}

export interface PipelineStage {
  name: string;
  execute(context: PipelineContext): Promise<PipelineContext>;
}

export interface Pipeline {
  name: string;
  stages: PipelineStage[];
  run(context: PipelineContext): Promise<PipelineContext>;
}

export interface RetrievalStrategy {
  name: string;
  description: string;
  buildPipeline(provider: EmbeddingProvider, documents: Document[]): Pipeline;
}

// ============================================================================
// Human Evaluation Types
// ============================================================================

export interface QueryNote {
  queryId: string;
  timestamp: string;
  type: 'observation' | 'issue' | 'category';
  content: string;
  tags: string[];
  variantId?: string;
  docId?: string;
}

export interface HumanFeedback {
  queryId: string;
  docId: string;
  rating: number;
  notes?: string;
  timestamp: string;
  evaluator?: string;
}

export interface HumanEvalSession {
  id: string;
  testId: string;
  datasetId: string;
  variantId: string;
  startTime: string;
  endTime?: string;
  completedQueries: string[];
  feedbacks: HumanFeedback[];
  notes: QueryNote[];
}

// ============================================================================
// Checkpoint & Job Types
// ============================================================================

export interface Checkpoint {
  testId: string;
  variantId: string;
  queryIndex: number;
  timestamp: string;
  completedQueries: string[];
  partialResults: EvaluationResult[];
  failedQueries: string[];
}

export interface JobData {
  testId: string;
  variantId: string;
  query: TestCase;
  documents: Document[];
  providerConfig: ProviderConfig;
  strategy: string;
  checkpointEnabled: boolean;
}

export interface JobResult {
  success: boolean;
  result?: EvaluationResult;
  error?: string;
  queryId: string;
  variantId: string;
}

// ============================================================================
// Cache Types
// ============================================================================

export interface CacheEntry {
  key: string;
  embedding: number[];
  timestamp: string;
  model: string;
  provider: string;
}

export interface CacheIndex {
  entries: Map<string, CacheMetadata>;
  totalSize: number;
  maxSize: number;
}

export interface CacheMetadata {
  key: string;
  size: number;
  timestamp: string;
  filePath: string;
}

// ============================================================================
// Manifest Types
// ============================================================================

export interface RunManifest {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
  config: ABTestConfig;
  progress: {
    totalQueries: number;
    completedQueries: number;
    failedVariants: string[];
  };
  paths: {
    config: string;
    results: string;
    checkpoints: string;
    notes: string;
    cache: string;
  };
}

export interface GlobalManifest {
  version: string;
  activeRuns: RunManifest[];
  completedRuns: string[];
  cacheStats: {
    totalSize: number;
    numEmbeddings: number;
    oldestEntry: string;
  };
}

// ============================================================================
// Gate/Threshold Types
// ============================================================================

export interface MetricGate {
  min?: number;
  max?: number;
  improvement?: number;  // Minimum improvement vs baseline
}

export interface GateConfig {
  enabled: boolean;
  failOnViolation: boolean;
  metrics: Record<string, MetricGate>;
  latency?: {
    maxMs?: number;
    p95MaxMs?: number;
  };
  cost?: {
    maxTotal?: number;
    maxPerQuery?: number;
  };
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface EvalConfig {
  providers: ProviderConfig[];
  strategies: Array<{
    name: string;
    pipeline: string[];
  }>;
  metrics: string[];
  dataset: string;
  corpus?: string;
  output: {
    json?: string;
    dashboard?: string;
    sideBySide?: string;
    csv?: string;
  };
  gates?: GateConfig;
  humanEval?: {
    enabled: boolean;
    storagePath: string;
  };
  cache?: {
    maxSizeGB: number;
    checkpointInterval: number;
  };
}

// ============================================================================
// Dashboard Types
// ============================================================================

export interface SideBySideView {
  query: string;
  queryId: string;
  variants: Array<{
    variantId: string;
    variantName: string;
    topDocs: RetrievedDoc[];
    metrics: Record<string, number>;
  }>;
  analysis: {
    overlap: number;
    rankCorrelation: number;
    bestVariant: string;
  };
}

export interface DashboardData {
  testName: string;
  timestamp: string;
  variants: ABVariantResult[];
  comparisons: MetricComparison[];
  sideBySide: SideBySideView[];
  efficiency: EfficiencyAnalysis;
}

// ============================================================================
// Evolution Types (Self-Evolving Embedding Researcher)
// ============================================================================

/**
 * Strategy Genome - Represents a strategy as an evolvable configuration
 */
export interface StrategyGenome {
  id: string;
  name: string;
  genes: {
    // Chunking genes
    chunkingMethod: 'none' | 'fixed' | 'semantic' | 'sliding';
    chunkSize?: number;        // 128-1024
    chunkOverlap?: number;     // 0-50%
    
    // Retrieval genes
    retrievalMethod: 'cosine' | 'bm25' | 'hybrid';
    retrievalK: number;        // 10-100
    hybridWeights?: [number, number];  // [embedding, bm25]
    
    // Reranking genes
    rerankingMethod: 'none' | 'llm' | 'mmr' | 'cross-encoder';
    rerankingTopK?: number;    // 5-20
    mmrLambda?: number;        // 0-1 (diversity vs relevance)
  };
  
  // Evolution metadata
  fitness?: number;
  generation: number;
  parents?: [string, string];
  mutations?: string[];
  createdAt: string;
}

/**
 * Evolution Configuration
 */
export interface EvolutionConfig {
  populationSize: number;
  generations: number;
  mutationRate: number;
  crossoverRate: number;
  selectionMethod: 'tournament' | 'elitist' | 'roulette';
  tournamentSize?: number;
  eliteCount?: number;
  fitnessMetric: string;
  fitnessWeights?: Record<string, number>;
  constraints?: {
    maxLatencyMs?: number;
    maxCostPerQuery?: number;
  };
  autoDeployEnabled: boolean;
  autoDeployThreshold: number;
}

/**
 * Evolution Result
 */
export interface EvolutionResult {
  evolutionId: string;
  generations: GenerationResult[];
  bestGenome: StrategyGenome;
  improvementOverBaseline: number;
  totalEvaluations: number;
  deployed: boolean;
  timestamp: string;
}

export interface GenerationResult {
  generation: number;
  population: StrategyGenome[];
  bestFitness: number;
  avgFitness: number;
  diversity: number;
}

// ============================================================================
// Hypothesis Types (Research Automation)
// ============================================================================

/**
 * Experiment Hypothesis
 */
export interface Hypothesis {
  id: string;
  statement: string;
  rationale: string;
  baselineStrategy: string;
  challengerStrategy: string | StrategyGenome;
  expectedImprovement: number;
  confidence: number;
  conditions?: {
    documentLength?: 'short' | 'medium' | 'long';
    queryType?: string;
    domain?: string;
  };
  status: 'proposed' | 'testing' | 'confirmed' | 'rejected' | 'inconclusive';
  priority: number;
  createdAt: string;
  testedAt?: string;
  result?: {
    actualImprovement: number;
    pValue: number;
    significant: boolean;
  };
}

// ============================================================================
// Knowledge Base Types
// ============================================================================

/**
 * Experiment Record for Knowledge Base
 */
export interface ExperimentRecord {
  id: string;
  name: string;
  hypothesis?: string;
  timestamp: string;
  duration: number;
  corpus: string;
  queryCount: number;
  variants: Array<{
    name: string;
    strategy: string;
    provider: string;
    model: string;
  }>;
  results: Record<string, Record<string, number>>;  // variant -> metric -> value
  winner?: string;
  outcome: 'confirmed' | 'rejected' | 'inconclusive' | 'completed';
  learnings: string[];
  tags: string[];
}

/**
 * Model Performance Profile
 */
export interface ModelProfile {
  modelId: string;
  provider: string;
  dimensions: number;
  avgLatency: number;
  p95Latency: number;
  costPer1kTokens: number;
  strengthDomains: string[];
  weaknessDomains: string[];
  performanceByMetric: Record<string, number>;
  experimentCount: number;
  lastUpdated: string;
}

/**
 * Strategy Performance Profile
 */
export interface StrategyProfile {
  strategyName: string;
  avgNdcg: number;
  avgRecall: number;
  avgLatency: number;
  avgCost: number;
  bestForContexts: string[];
  worstForContexts: string[];
  experimentCount: number;
  lastUpdated: string;
}

/**
 * Failure Pattern
 */
export interface FailurePattern {
  id: string;
  pattern: string;
  description: string;
  frequency: number;
  examples: Array<{
    queryId: string;
    query: string;
    expectedDocs: string[];
    retrievedDocs: string[];
    metrics: Record<string, number>;
  }>;
  suggestedFix: string;
  fixSuccessRate?: number;
  detectionRule?: string;
  createdAt: string;
  lastSeen: string;
}

/**
 * Best Practice (Learned)
 */
export interface BestPractice {
  id: string;
  title: string;
  description: string;
  context: string;
  recommendation: string;
  evidence: Array<{
    experimentId: string;
    improvement: number;
  }>;
  confidence: number;
  createdAt: string;
}

// ============================================================================
// Synthetic Data Types
// ============================================================================

/**
 * Synthetic Query Generation Config
 */
export interface SyntheticQueryConfig {
  corpusPath: string;
  provider: ProviderConfig;
  llmModel: string;
  numQueries: number;
  queryTypes: ('factual' | 'conceptual' | 'comparison' | 'procedural')[];
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed';
  includeNegatives: boolean;
  outputPath: string;
}

/**
 * Generated Query with metadata
 */
export interface SyntheticQuery {
  id: string;
  query: string;
  sourceDocId: string;
  relevantDocs: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  queryType: string;
  reasoning: string;
  generatedAt: string;
}

// ============================================================================
// Agent Response Types
// ============================================================================

/**
 * Structured response for AI agents
 */
export interface AgentResponse<T = any> {
  status: 'success' | 'error' | 'partial';
  data?: T;
  summary: string;
  interpretation?: string;
  recommendations?: string[];
  nextActions?: string[];
  error?: {
    code: string;
    message: string;
    suggestion: string;
  };
  metadata?: {
    duration: number;
    timestamp: string;
    version: string;
  };
}

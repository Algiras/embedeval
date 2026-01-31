/**
 * Shared Types for EmbedEval
 * 
 * These types are shared between core, SDK, and MCP modules.
 * Keep this file as the single source of truth for common interfaces.
 */

// ==================== BASIC BUILDING BLOCKS ====================

/**
 * Retrieved document from a RAG system
 */
export interface RetrievedDocument {
  id: string;
  content: string;
  score?: number;
}

/**
 * Context for trace (RAG, tool calls, etc.)
 */
export interface TraceContext {
  retrievedDocs?: RetrievedDocument[];
  queryEmbedding?: number[];
  [key: string]: unknown;
}

/**
 * Tool call made by an agent
 */
export interface ToolCall {
  tool: string;
  input: unknown;
  output: unknown;
  latency?: number;
}

/**
 * Metadata for a trace
 */
export interface TraceMetadata {
  provider?: string;
  model?: string;
  latency?: number;
  tokens?: {
    input: number;
    output: number;
  };
  cost?: number;
  version?: string;
  sessionId?: string;
  [key: string]: unknown;
}

// ==================== TRACE MODEL ====================

/**
 * A trace represents a single LLM interaction to evaluate
 */
export interface Trace {
  id: string;
  timestamp: string;
  
  // Input/Output
  query: string;
  response: string;
  
  // Context (for RAG systems)
  context?: TraceContext;
  
  // Tool calls (for agents)
  toolCalls?: ToolCall[];
  
  // Metadata
  metadata?: TraceMetadata;
  
  // Evaluation results (populated later)
  evalResults?: EvalResult[];
}

// ==================== ANNOTATION MODEL ====================

/**
 * A human annotation for a trace
 */
export interface Annotation {
  id: string;
  traceId: string;
  annotator: string;
  timestamp: string;
  
  // Binary judgment only (Hamel principle)
  label: 'pass' | 'fail';
  
  // Error analysis
  failureCategory?: string;
  firstFailure?: string;
  notes: string;
  
  // Metadata
  duration: number;
  source: 'manual' | 'llm-judge';
}

// ==================== FAILURE TAXONOMY ====================

/**
 * A category in the failure taxonomy
 */
export interface FailureCategory {
  id: string;
  name: string;
  description: string;
  count: number;
  examples: string[];
  parent?: string;
}

/**
 * The full failure taxonomy
 */
export interface FailureTaxonomy {
  version: string;
  lastUpdated: string;
  annotator: string;
  
  categories: FailureCategory[];
  
  stats: {
    totalAnnotated: number;
    totalPassed: number;
    totalFailed: number;
    passRate: number;
  };
}

// ==================== EVALUATION MODEL ====================

/**
 * Configuration for an assertion eval
 */
export interface AssertionConfig {
  check: string;
}

/**
 * Configuration for a regex eval
 */
export interface RegexConfig {
  pattern: string;
  shouldMatch: boolean;
  flags?: string;
}

/**
 * Configuration for a code eval
 */
export interface CodeConfig {
  function: string;
}

/**
 * Configuration for an LLM-as-judge eval
 */
export interface LLMJudgeConfig {
  model: string;
  prompt: string;
  temperature: number;
  binary?: boolean;
}

/**
 * Union of all eval config types
 */
export type EvalTypeConfig = 
  | AssertionConfig 
  | RegexConfig 
  | CodeConfig 
  | LLMJudgeConfig;

/**
 * Full eval configuration
 */
export interface EvalConfig {
  id: string;
  name: string;
  description?: string;
  type: 'assertion' | 'regex' | 'code' | 'llm-judge';
  priority: 'cheap' | 'expensive';
  config: EvalTypeConfig;
}

/**
 * Result of running an eval
 */
export interface EvalResult {
  evalId: string;
  passed: boolean;
  explanation?: string;
  latency?: number;
  failureCategory?: string;
}

// ==================== SDK-SPECIFIC TYPES ====================

/**
 * Options for evaluate() function
 */
export interface EvaluateOptions {
  /** User's query/input */
  query: string;
  
  /** Retrieved context (for RAG evaluation) */
  context?: TraceContext;
  
  /** Evals to run (names or configs) */
  evals?: Array<string | EvalConfig>;
  
  /** Model for LLM-as-judge evals */
  model?: string;
  
  /** Stop on first failure */
  stopOnFail?: boolean;
  
  /** Additional metadata */
  metadata?: TraceMetadata;
}

/**
 * Result from evaluate() function
 */
export interface EvaluateResult {
  /** Overall pass/fail */
  passed: boolean;
  
  /** Pass rate as percentage */
  passRate: number;
  
  /** Individual eval results */
  results: EvalResult[];
  
  /** Total latency in ms */
  latency: number;
  
  /** Trace ID for this evaluation */
  traceId: string;
  
  /** Summary stats */
  summary: {
    total: number;
    passed: number;
    failed: number;
    passRate: number;
  };
  
  /** Failure categories (if any) */
  failureCategories?: string[];
  
  /** Suggestions for improvement */
  suggestions?: string[];
}

/**
 * Options for preflight() check
 */
export interface PreflightOptions {
  /** Checks to run (default: coherent, safe, complete) */
  checks?: Array<'coherent' | 'safe' | 'complete' | 'relevant' | 'factual'>;
  
  /** Model for checks (default: gemini-2.5-flash-lite for speed) */
  model?: string;
  
  /** Temperature (default: 0.0) */
  temperature?: number;
  
  /** Timeout in ms (default: 5000) */
  timeout?: number;
  
  /** Additional context */
  context?: string;
}

/**
 * Result from preflight() check
 */
export interface PreflightResult {
  /** Overall pass/fail */
  passed: boolean;
  
  /** Individual check results */
  checks: {
    name: string;
    passed: boolean;
    reason?: string;
  }[];
  
  /** Total latency in ms */
  latency: number;
  
  /** Confidence score (0-1) */
  confidence: number;
  
  /** Should agent retry with different approach? */
  shouldRetry: boolean;
  
  /** Suggested revision approach */
  revisionHint?: string;
  
  /** Which checks failed */
  failedChecks: string[];
}

/**
 * Options for confidence() scoring
 */
export interface ConfidenceOptions {
  /** Query for context */
  query?: string;
  
  /** Retrieved context */
  context?: string;
  
  /** Model for scoring */
  model?: string;
  
  /** Method: 'llm' | 'embedding' | 'hybrid' */
  method?: 'llm' | 'embedding' | 'hybrid';
  
  /** Thresholds for action determination */
  thresholds?: {
    send: number;
    revise: number;
    escalate: number;
    clarify: number;
  };
}

/**
 * Result from confidence() scoring
 */
export interface ConfidenceResult {
  /** Overall confidence (0-1) */
  score: number;
  
  /** Confidence breakdown by aspect */
  breakdown: {
    relevance: number;
    completeness: number;
    accuracy: number;
    clarity: number;
  };
  
  /** Suggested action based on confidence */
  action: 'send' | 'revise' | 'escalate' | 'clarify';
  
  /** Reason for action */
  reason: string;
  
  /** Explanation from LLM (if used) */
  explanation?: string;
}

/**
 * Input for trace collection
 */
export interface CollectInput {
  id?: string;
  query: string;
  response: string;
  context?: TraceContext;
  toolCalls?: ToolCall[];
  metadata?: TraceMetadata;
}

/**
 * Trace collector options
 */
export interface CollectorOptions {
  /** Auto-save traces to file */
  outputFile?: string;
  
  /** Max traces to keep in memory */
  maxTraces?: number;
  
  /** Auto-evaluate each trace */
  autoEvaluate?: boolean;
  
  /** Evals to run on each trace */
  evals?: EvalConfig[];
  
  /** Callback when trace is collected */
  onTrace?: (trace: Trace, results?: EvaluateResult) => void;
}

/**
 * Stats from trace collection
 */
export interface CollectorStats {
  totalTraces: number;
  totalEvaluated: number;
  passed: number;
  failed: number;
  passRate: number;
  failureCategories: Record<string, number>;
}

/**
 * Improvement suggestion
 */
export interface Suggestion {
  /** Category of issue */
  category: string;
  
  /** Severity: low, medium, high */
  severity: 'low' | 'medium' | 'high';
  
  /** Human-readable description */
  description: string;
  
  /** Actionable fix */
  action: string;
  
  /** Example of good response */
  example?: string;
  
  /** Related failure traces */
  relatedTraceIds?: string[];
}

/**
 * Self-assessment options
 */
export interface SelfAssessOptions {
  /** Model used for evaluation */
  model?: string;
  
  /** Baseline for drift detection */
  baseline?: {
    passRate: number;
    avgLatency: number;
    avgCost: number;
  };
  
  /** Include suggestions */
  includeSuggestions?: boolean;
  
  /** Compare to another model's results */
  compareWith?: {
    model: string;
    results: EvalResult[];
  };
}

// ==================== UI STATE ====================

/**
 * UI state for interactive annotation
 */
export interface UIState {
  currentIndex: number;
  traces: Trace[];
  annotations: Map<string, Annotation>;
  taxonomy: FailureTaxonomy;
  mode: 'view' | 'annotate';
  filter?: {
    category?: string;
    status?: 'all' | 'annotated' | 'unannotated' | 'pass' | 'fail';
  };
}

// ==================== COMMANDS ====================

export interface CollectOptions {
  source: string;
  output: string;
  filter?: string;
}

export interface AnnotateOptions {
  traces: string;
  annotator: string;
  resume?: boolean;
}

export interface ViewOptions {
  traces: string;
  annotations?: string;
}

export interface EvalOptions {
  traces: string;
  evals: string;
  output: string;
}

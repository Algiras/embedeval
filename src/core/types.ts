/**
 * Core type definitions for Hamel Husain-style evaluation CLI
 * Binary evals, trace-centric, error-analysis-first
 */

// ==================== TRACE MODEL ====================

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
  metadata: TraceMetadata;
  
  // Evaluation results (populated later)
  evalResults?: EvalResult[];
}

export interface TraceContext {
  retrievedDocs: RetrievedDocument[];
  queryEmbedding?: number[];
}

export interface RetrievedDocument {
  id: string;
  content: string;
  score: number;
}

export interface ToolCall {
  tool: string;
  input: unknown;
  output: unknown;
  latency: number;
}

export interface TraceMetadata {
  provider: string;
  model: string;
  latency: number;
  tokens?: {
    input: number;
    output: number;
  };
  cost?: number;
  version?: string;
  sessionId?: string;
}

// ==================== ANNOTATION MODEL ====================

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

export interface FailureCategory {
  id: string;
  name: string;
  description: string;
  count: number;
  examples: string[];
  parent?: string;
}

// ==================== EVALUATION MODEL ====================

export interface EvalConfig {
  id: string;
  name: string;
  description: string;
  type: 'assertion' | 'regex' | 'code' | 'llm-judge';
  priority: 'cheap' | 'expensive';
  config: EvalTypeConfig;
}

export type EvalTypeConfig = 
  | AssertionConfig 
  | RegexConfig 
  | CodeConfig 
  | LLMJudgeConfig;

export interface AssertionConfig {
  check: string;
}

export interface RegexConfig {
  pattern: string;
  shouldMatch: boolean;
  flags?: string;
}

export interface CodeConfig {
  function: string;
}

export interface LLMJudgeConfig {
  model: string;
  prompt: string;
  temperature: number;
  binary: true;
}

export interface EvalResult {
  evalId: string;
  passed: boolean;
  explanation?: string;
  latency: number;
}

// ==================== UI STATE ====================

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

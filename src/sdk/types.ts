/**
 * SDK Types for Agent Self-Evaluation
 * 
 * Re-exports from shared types for SDK usage
 */

export {
  // Core types
  Trace,
  EvalConfig,
  EvalResult,
  TraceContext,
  TraceMetadata,
  ToolCall,
  RetrievedDocument,
  
  // SDK-specific types
  EvaluateOptions,
  EvaluateResult,
  PreflightOptions,
  PreflightResult,
  ConfidenceOptions,
  ConfidenceResult,
  CollectInput,
  CollectorOptions,
  CollectorStats,
  Suggestion,
  SelfAssessOptions,
} from '../shared/types';

// SDK-specific eval config (more flexible than core)
export interface SDKEvalConfig {
  id: string;
  name: string;
  description?: string;
  type: 'assertion' | 'regex' | 'code' | 'llm-judge';
  priority: 'cheap' | 'expensive';
  config: {
    // LLM Judge
    model?: string;
    prompt?: string;
    temperature?: number;
    binary?: boolean;
    // Code
    function?: string;
    // Regex
    pattern?: string;
    shouldMatch?: boolean;
    flags?: string;
    // Assertion
    check?: string;
  };
}

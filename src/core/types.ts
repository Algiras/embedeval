/**
 * Core type definitions for Hamel Husain-style evaluation CLI
 * Binary evals, trace-centric, error-analysis-first
 * 
 * Re-exports from shared types for backward compatibility
 */

export {
  // Basic building blocks
  RetrievedDocument,
  TraceContext,
  ToolCall,
  TraceMetadata,
  
  // Trace model
  Trace,
  
  // Annotation model
  Annotation,
  
  // Failure taxonomy
  FailureCategory,
  FailureTaxonomy,
  
  // Evaluation model
  AssertionConfig,
  RegexConfig,
  CodeConfig,
  LLMJudgeConfig,
  EvalTypeConfig,
  EvalConfig,
  EvalResult,
  
  // UI state
  UIState,
  
  // Commands
  CollectOptions,
  AnnotateOptions,
  ViewOptions,
  EvalOptions,
} from '../shared/types';

/**
 * Enhanced Strategy System with Composable Stages
 */

import { Document, RetrievedDoc, TestCase, EmbeddingProvider } from '../../core/types';

export interface StrategyContext {
  query: string;
  queryId: string;
  testCase: TestCase;
  originalDocuments: Document[];
  
  // Chunking stage outputs
  chunks?: Chunk[];
  
  // Embedding stage outputs
  queryEmbedding?: number[];
  documentEmbeddings?: Map<string, number[]>;
  
  // Retrieval stage outputs
  retrievedDocs?: RetrievedDoc[];
  bm25Results?: RetrievedDoc[];
  
  // Fusion stage outputs
  fusedResults?: RetrievedDoc[];
  
  // Re-ranking stage outputs
  rerankedDocs?: RetrievedDoc[];
  
  // Final output
  finalResults?: RetrievedDoc[];
  
  // Metadata
  stageTimings: Map<string, number>;
  stageMetadata: Map<string, any>;
}

export interface Chunk {
  id: string;
  content: string;
  parentDocId: string;
  startIndex: number;
  endIndex: number;
  metadata?: Record<string, any>;
}

export interface StageConfig {
  name: string;
  type: 'chunking' | 'embedding' | 'retrieval' | 'bm25' | 'fusion' | 'reranking';
  config: Record<string, any>;
  enabled?: boolean;
}

export interface StrategyStage {
  name: string;
  type: StageConfig['type'];
  execute(context: StrategyContext, provider?: EmbeddingProvider): Promise<StrategyContext>;
}

export interface Strategy {
  name: string;
  description: string;
  stages: StageConfig[];
}

export interface StrategyResult {
  context: StrategyContext;
  retrievedDocs: RetrievedDoc[];
  metrics: {
    totalTime: number;
    stageTimings: Record<string, number>;
  };
}

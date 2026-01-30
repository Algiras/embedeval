/**
 * Strategy Registry and Executor
 * Manages all available strategies and executes them
 */

import { EmbeddingProvider } from '../core/types';
import { 
  Strategy, 
  StrategyContext, 
  StrategyResult, 
  StageConfig,
  StrategyStage 
} from './types';
import { logger } from '../utils/logger';

// Import all stages
import { 
  FixedSizeChunkingStage, 
  SemanticChunkingStage, 
  SlidingWindowChunkingStage 
} from './chunking';
import { BM25RetrievalStage } from './retrieval/bm25';
import { ReciprocalRankFusionStage, WeightedFusionStage } from './fusion';
import { LLMRerankingStage, MMRRerankingStage } from './reranking';

export class StrategyRegistry {
  private static stages = new Map<string, new (config: any) => StrategyStage>([
    // Chunking stages
    ['chunking:fixed', FixedSizeChunkingStage],
    ['chunking:semantic', SemanticChunkingStage],
    ['chunking:sliding', SlidingWindowChunkingStage],
    
    // Retrieval stages
    ['bm25', BM25RetrievalStage],
    
    // Fusion stages
    ['fusion:rrf', ReciprocalRankFusionStage],
    ['fusion:weighted', WeightedFusionStage],
    
    // Re-ranking stages
    ['reranking:llm', LLMRerankingStage],
    ['reranking:mmr', MMRRerankingStage],
  ]);

  static register(name: string, stage: new (config: any) => StrategyStage): void {
    this.stages.set(name, stage);
  }

  static createStage(config: StageConfig): StrategyStage {
    const StageClass = this.stages.get(`${config.type}:${config.name}`) || 
                      this.stages.get(config.type);
    
    if (!StageClass) {
      throw new Error(`Unknown stage: ${config.type}:${config.name}`);
    }

    return new StageClass(config.config);
  }

  static listAvailable(): string[] {
    return Array.from(this.stages.keys());
  }
}

export class StrategyExecutor {
  async execute(
    strategy: Strategy,
    context: StrategyContext,
    provider?: EmbeddingProvider
  ): Promise<StrategyResult> {
    const startTime = Date.now();
    
    logger.info(`Executing strategy: ${strategy.name}`);
    logger.info(`Stages: ${strategy.stages.map(s => s.name || s.type).join(' → ')}`);

    let currentContext = context;

    for (const stageConfig of strategy.stages) {
      if (stageConfig.enabled === false) {
        logger.debug(`Skipping disabled stage: ${stageConfig.name || stageConfig.type}`);
        continue;
      }

      try {
        const stage = StrategyRegistry.createStage(stageConfig);
        logger.debug(`Executing stage: ${stage.name}`);
        
        currentContext = await stage.execute(currentContext, provider);
        
        logger.debug(`Stage ${stage.name} completed in ${currentContext.stageTimings.get(stage.name)}ms`);
      } catch (error) {
        logger.error(`Stage ${stageConfig.name || stageConfig.type} failed:`, error);
        throw error;
      }
    }

    // Determine final results
    let finalResults = currentContext.rerankedDocs || 
                      currentContext.fusedResults || 
                      currentContext.retrievedDocs || 
                      [];

    // Mark relevance
    finalResults = finalResults.map(doc => ({
      ...doc,
      isRelevant: context.testCase.relevantDocs.includes(doc.id),
    }));

    currentContext.finalResults = finalResults;

    const totalTime = Date.now() - startTime;
    
    return {
      context: currentContext,
      retrievedDocs: finalResults,
      metrics: {
        totalTime,
        stageTimings: Object.fromEntries(currentContext.stageTimings),
      },
    };
  }
}

// Predefined strategies
export const PREDEFINED_STRATEGIES: Record<string, Strategy> = {
  'baseline': {
    name: 'baseline',
    description: 'Simple embedding retrieval without chunking',
    stages: [
      { type: 'embedding', name: 'embedding', config: {}, enabled: true },
      { type: 'retrieval', name: 'retrieval', config: { k: 10, metric: 'cosine' }, enabled: true },
    ],
  },
  
  'fixed-chunks': {
    name: 'fixed-chunks',
    description: 'Fixed-size chunking with embedding retrieval',
    stages: [
      { type: 'chunking', name: 'fixed', config: { size: 512, overlap: 50 }, enabled: true },
      { type: 'embedding', name: 'embedding', config: {}, enabled: true },
      { type: 'retrieval', name: 'retrieval', config: { k: 10, metric: 'cosine' }, enabled: true },
    ],
  },
  
  'semantic-chunks': {
    name: 'semantic-chunks',
    description: 'Semantic chunking with embedding retrieval',
    stages: [
      { type: 'chunking', name: 'semantic', config: { maxSize: 512, similarityThreshold: 0.7 }, enabled: true },
      { type: 'embedding', name: 'embedding', config: {}, enabled: true },
      { type: 'retrieval', name: 'retrieval', config: { k: 10, metric: 'cosine' }, enabled: true },
    ],
  },
  
  'hybrid-bm25': {
    name: 'hybrid-bm25',
    description: 'BM25 + Embeddings with Reciprocal Rank Fusion',
    stages: [
      { type: 'bm25', name: 'bm25', config: { k: 100, k1: 1.2, b: 0.75 }, enabled: true },
      { type: 'embedding', name: 'embedding', config: {}, enabled: true },
      { type: 'retrieval', name: 'retrieval', config: { k: 100, metric: 'cosine' }, enabled: true },
      { type: 'fusion', name: 'rrf', config: { k: 60, topK: 10 }, enabled: true },
    ],
  },
  
  'llm-reranked': {
    name: 'llm-reranked',
    description: 'Embedding retrieval with LLM re-ranking',
    stages: [
      { type: 'embedding', name: 'embedding', config: {}, enabled: true },
      { type: 'retrieval', name: 'retrieval', config: { k: 50, metric: 'cosine' }, enabled: true },
      { type: 'reranking', name: 'llm', config: { topK: 10 }, enabled: true },
    ],
  },
  
  'mmr-diversity': {
    name: 'mmr-diversity',
    description: 'Embedding retrieval with MMR for diversity',
    stages: [
      { type: 'embedding', name: 'embedding', config: {}, enabled: true },
      { type: 'retrieval', name: 'retrieval', config: { k: 50, metric: 'cosine' }, enabled: true },
      { type: 'reranking', name: 'mmr', config: { lambda: 0.5, topK: 10 }, enabled: true },
    ],
  },
  
  'full-pipeline': {
    name: 'full-pipeline',
    description: 'Complete pipeline: chunking → hybrid → LLM reranking',
    stages: [
      { type: 'chunking', name: 'semantic', config: { maxSize: 512, similarityThreshold: 0.7 }, enabled: true },
      { type: 'bm25', name: 'bm25', config: { k: 100 }, enabled: true },
      { type: 'embedding', name: 'embedding', config: {}, enabled: true },
      { type: 'retrieval', name: 'retrieval', config: { k: 100, metric: 'cosine' }, enabled: true },
      { type: 'fusion', name: 'rrf', config: { k: 60, topK: 20 }, enabled: true },
      { type: 'reranking', name: 'llm', config: { topK: 10 }, enabled: true },
    ],
  },
};

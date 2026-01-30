/**
 * Advanced Strategy Genome
 * 
 * Comprehensive genome supporting:
 * - Data-adaptive strategies (different approaches for different data types)
 * - Advanced RAG architectures (hierarchical, graph, multi-hop)
 * - Ensemble methods and fusion strategies
 * - Conditional pipeline routing
 * 
 * Research-backed strategies from:
 * - HyDE (Hypothetical Document Embeddings)
 * - Self-RAG (Self-Reflective RAG)
 * - RAPTOR (Recursive Abstractive Processing)
 * - GraphRAG (Knowledge Graph Enhanced)
 * - ColBERT (Late Interaction)
 * - SPLADE (Sparse-Dense Hybrid)
 * 
 * @module evolution/advanced-genome
 */

import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

// ============================================================================
// ARCHITECTURE DEFINITIONS
// ============================================================================

/**
 * RAG Architecture Types
 */
export const RAG_ARCHITECTURES = {
  // Basic architectures
  NAIVE: {
    id: 'naive',
    name: 'Naive RAG',
    description: 'Simple embed-retrieve-generate',
    stages: ['embed', 'retrieve', 'generate'],
    complexity: 1,
  },
  
  // Advanced architectures
  HIERARCHICAL: {
    id: 'hierarchical',
    name: 'Hierarchical RAG',
    description: 'Multi-level document representation (summary → chunk → sentence)',
    stages: ['summarize', 'embed_multi', 'retrieve_hierarchical', 'aggregate'],
    complexity: 3,
    paper: 'RAPTOR: Recursive Abstractive Processing for Tree-Organized Retrieval',
  },
  
  GRAPH_RAG: {
    id: 'graph_rag',
    name: 'Graph RAG',
    description: 'Knowledge graph enhanced retrieval with entity linking',
    stages: ['extract_entities', 'build_graph', 'traverse', 'retrieve', 'synthesize'],
    complexity: 4,
    paper: 'GraphRAG: Unlocking LLM discovery on narrative private data',
  },
  
  MULTI_HOP: {
    id: 'multi_hop',
    name: 'Multi-Hop RAG',
    description: 'Iterative retrieval with query decomposition',
    stages: ['decompose', 'retrieve_iterative', 'aggregate', 'synthesize'],
    complexity: 3,
    paper: 'IRCoT: Interleaving Retrieval with Chain-of-Thought',
  },
  
  SELF_RAG: {
    id: 'self_rag',
    name: 'Self-RAG',
    description: 'Self-reflective retrieval with relevance filtering',
    stages: ['retrieve', 'critique', 'filter', 'generate', 'verify'],
    complexity: 3,
    paper: 'Self-RAG: Learning to Retrieve, Generate, and Critique',
  },
  
  CORRECTIVE_RAG: {
    id: 'corrective_rag',
    name: 'Corrective RAG (CRAG)',
    description: 'Adaptive retrieval with web search fallback',
    stages: ['retrieve', 'evaluate', 'correct_or_search', 'generate'],
    complexity: 3,
    paper: 'Corrective Retrieval Augmented Generation',
  },
  
  ADAPTIVE: {
    id: 'adaptive',
    name: 'Adaptive RAG',
    description: 'Route queries to different strategies based on complexity',
    stages: ['classify', 'route', 'execute', 'merge'],
    complexity: 2,
    paper: 'Adaptive-RAG: Learning to Adapt Retrieval-Augmented LLMs',
  },
  
  AGENTIC: {
    id: 'agentic',
    name: 'Agentic RAG',
    description: 'LLM agent decides retrieval strategy dynamically',
    stages: ['plan', 'tool_select', 'execute_tools', 'synthesize'],
    complexity: 4,
  },
};

/**
 * Embedding Strategies
 */
export const EMBEDDING_STRATEGIES = {
  // Standard dense embeddings
  DENSE_SINGLE: {
    id: 'dense_single',
    name: 'Dense Single Vector',
    description: 'Single embedding per document',
  },
  
  // Multi-vector approaches
  DENSE_MULTI: {
    id: 'dense_multi', 
    name: 'Dense Multi-Vector',
    description: 'Multiple embeddings per document (ColBERT-style)',
    paper: 'ColBERT: Efficient and Effective Passage Search',
  },
  
  // Sparse embeddings
  SPARSE_LEARNED: {
    id: 'sparse_learned',
    name: 'Learned Sparse (SPLADE)',
    description: 'Learned sparse representations',
    paper: 'SPLADE: Sparse Lexical and Expansion Model',
  },
  
  // Hybrid
  HYBRID_DENSE_SPARSE: {
    id: 'hybrid_dense_sparse',
    name: 'Hybrid Dense-Sparse',
    description: 'Combine dense and sparse representations',
  },
  
  // Contextual
  CONTEXTUAL: {
    id: 'contextual',
    name: 'Contextual Embeddings',
    description: 'Include surrounding context in embedding',
  },
  
  // Late interaction
  LATE_INTERACTION: {
    id: 'late_interaction',
    name: 'Late Interaction',
    description: 'Token-level matching (ColBERT)',
  },
};

/**
 * Query Processing Strategies
 */
export const QUERY_STRATEGIES = {
  RAW: { id: 'raw', name: 'Raw Query', boost: 0 },
  EXPANDED: { id: 'expanded', name: 'Query Expansion', boost: 0.05 },
  REWRITTEN: { id: 'rewritten', name: 'Query Rewriting', boost: 0.08 },
  DECOMPOSED: { id: 'decomposed', name: 'Query Decomposition', boost: 0.12 },
  HYDE: { id: 'hyde', name: 'HyDE', description: 'Hypothetical Document Embeddings', boost: 0.15 },
  STEP_BACK: { id: 'step_back', name: 'Step-Back Prompting', boost: 0.10 },
  MULTI_QUERY: { id: 'multi_query', name: 'Multi-Query Generation', boost: 0.12 },
  RAG_FUSION: { id: 'rag_fusion', name: 'RAG Fusion', description: 'Multiple query perspectives', boost: 0.14 },
};

/**
 * Retrieval Methods
 */
export const RETRIEVAL_METHODS = {
  // Vector similarity
  COSINE: { id: 'cosine', name: 'Cosine Similarity', type: 'dense' },
  DOT_PRODUCT: { id: 'dot', name: 'Dot Product', type: 'dense' },
  EUCLIDEAN: { id: 'euclidean', name: 'Euclidean Distance', type: 'dense' },
  
  // Sparse/Lexical
  BM25: { id: 'bm25', name: 'BM25', type: 'sparse', params: { k1: 1.2, b: 0.75 } },
  BM25_PLUS: { id: 'bm25_plus', name: 'BM25+', type: 'sparse' },
  TFIDF: { id: 'tfidf', name: 'TF-IDF', type: 'sparse' },
  
  // Hybrid fusion
  HYBRID_LINEAR: { id: 'hybrid_linear', name: 'Linear Fusion', type: 'hybrid' },
  HYBRID_RRF: { id: 'hybrid_rrf', name: 'Reciprocal Rank Fusion', type: 'hybrid' },
  HYBRID_CONVEX: { id: 'hybrid_convex', name: 'Convex Combination', type: 'hybrid' },
  
  // Advanced
  MAXIMUM_INNER_PRODUCT: { id: 'mips', name: 'Maximum Inner Product', type: 'dense' },
  APPROXIMATE_NN: { id: 'ann', name: 'Approximate Nearest Neighbor', type: 'dense' },
};

/**
 * Reranking Methods
 */
export const RERANKING_METHODS = {
  NONE: { id: 'none', name: 'No Reranking' },
  
  // Cross-encoders
  CROSS_ENCODER: { id: 'cross_encoder', name: 'Cross-Encoder', models: ['ms-marco-MiniLM', 'bge-reranker'] },
  
  // LLM-based
  LLM_POINTWISE: { id: 'llm_pointwise', name: 'LLM Pointwise Scoring' },
  LLM_PAIRWISE: { id: 'llm_pairwise', name: 'LLM Pairwise Comparison' },
  LLM_LISTWISE: { id: 'llm_listwise', name: 'LLM Listwise Ranking' },
  
  // Diversity
  MMR: { id: 'mmr', name: 'Maximal Marginal Relevance', params: { lambda: 0.5 } },
  
  // API services
  COHERE: { id: 'cohere', name: 'Cohere Rerank' },
  JINA: { id: 'jina', name: 'Jina Reranker' },
  
  // Lost-in-middle fix
  POSITIONAL: { id: 'positional', name: 'Positional Reorder' },
  
  // Multi-stage
  CASCADE: { id: 'cascade', name: 'Cascade Reranking', description: 'Fast filter → Accurate rerank' },
};

/**
 * Chunking Strategies
 */
export const CHUNKING_STRATEGIES = {
  NONE: { id: 'none', name: 'No Chunking' },
  
  // Fixed size
  FIXED_TOKENS: { id: 'fixed_tokens', name: 'Fixed Token Count' },
  FIXED_CHARS: { id: 'fixed_chars', name: 'Fixed Character Count' },
  
  // Semantic
  SEMANTIC: { id: 'semantic', name: 'Semantic Chunking', description: 'Split on semantic boundaries' },
  SENTENCE: { id: 'sentence', name: 'Sentence-level' },
  PARAGRAPH: { id: 'paragraph', name: 'Paragraph-level' },
  
  // Document structure
  MARKDOWN_HEADERS: { id: 'markdown', name: 'Markdown Headers' },
  CODE_FUNCTIONS: { id: 'code', name: 'Code Functions/Classes' },
  
  // Hierarchical
  RECURSIVE: { id: 'recursive', name: 'Recursive Splitting' },
  PARENT_CHILD: { id: 'parent_child', name: 'Parent-Child Chunks', description: 'Small chunks with parent context' },
  
  // Sliding window
  SLIDING_WINDOW: { id: 'sliding', name: 'Sliding Window' },
  
  // Agentic
  AGENTIC: { id: 'agentic', name: 'Agentic Chunking', description: 'LLM determines chunk boundaries' },
};

/**
 * Post-Processing Methods
 */
export const POST_PROCESSING = {
  NONE: { id: 'none', name: 'No Post-Processing' },
  
  // Filtering
  SCORE_THRESHOLD: { id: 'threshold', name: 'Score Threshold' },
  DEDUPLICATION: { id: 'dedup', name: 'Deduplication' },
  
  // Context enhancement
  CONTEXT_EXPANSION: { id: 'expand', name: 'Context Expansion', description: 'Include surrounding chunks' },
  SENTENCE_WINDOW: { id: 'sentence_window', name: 'Sentence Window Retrieval' },
  AUTO_MERGE: { id: 'auto_merge', name: 'Auto-Merging Retrieval' },
  
  // Compression
  LLM_COMPRESSION: { id: 'compress', name: 'LLM Context Compression' },
  EXTRACTIVE_SUMMARY: { id: 'extract', name: 'Extractive Summary' },
  
  // Formatting
  REORDER: { id: 'reorder', name: 'Relevance Reorder' },
};

// ============================================================================
// ADVANCED GENOME
// ============================================================================

/**
 * Data Type Classification for Adaptive Strategies
 */
export interface DataTypeProfile {
  queryType: 'factual' | 'analytical' | 'procedural' | 'conversational' | 'code' | 'creative';
  documentType: 'technical' | 'narrative' | 'structured' | 'code' | 'mixed';
  complexity: 'simple' | 'moderate' | 'complex';
  domain?: string;
}

/**
 * Conditional Strategy - Different behavior for different data types
 */
export interface ConditionalStrategy {
  condition: DataTypeProfile;
  strategy: StrategyGenes;
  priority: number;
}

/**
 * Strategy Genes - All configurable parameters
 */
export interface StrategyGenes {
  // Architecture selection
  architecture: keyof typeof RAG_ARCHITECTURES;
  
  // Embedding configuration
  embeddingProvider: 'ollama' | 'openai' | 'gemini' | 'huggingface' | 'cohere' | 'voyage';
  embeddingModel: string;
  embeddingStrategy: keyof typeof EMBEDDING_STRATEGIES;
  embeddingDimensions?: number;
  
  // Chunking configuration
  chunkingStrategy: keyof typeof CHUNKING_STRATEGIES;
  chunkSize?: number;
  chunkOverlap?: number;
  
  // Query processing
  queryStrategy: keyof typeof QUERY_STRATEGIES;
  queryExpansionCount?: number;
  
  // Retrieval configuration
  retrievalMethod: keyof typeof RETRIEVAL_METHODS;
  retrievalK: number;
  retrievalK2?: number; // For multi-stage
  hybridAlpha?: number;
  
  // Reranking configuration
  rerankingMethod: keyof typeof RERANKING_METHODS;
  rerankingModel?: string;
  rerankingTopK?: number;
  mmrLambda?: number;
  
  // Post-processing
  postProcessing: Array<keyof typeof POST_PROCESSING>;
  scoreThreshold?: number;
  contextWindowSize?: number;
  
  // Graph RAG specific
  graphEnabled?: boolean;
  graphTraversalDepth?: number;
  entityLinkingThreshold?: number;
  
  // Hierarchical RAG specific
  hierarchicalLevels?: number;
  summarizationRatio?: number;
  
  // Multi-hop specific
  maxHops?: number;
  hopTerminationThreshold?: number;
  
  // Self-RAG specific
  selfReflectionEnabled?: boolean;
  relevanceThreshold?: number;
  
  // Agentic specific
  agentModel?: string;
  maxToolCalls?: number;
}

/**
 * Advanced Strategy Genome
 */
export interface AdvancedStrategyGenome {
  id: string;
  name: string;
  version: string;
  
  // Default strategy
  defaultStrategy: StrategyGenes;
  
  // Conditional strategies for different data types
  conditionalStrategies?: ConditionalStrategy[];
  
  // Ensemble configuration (combine multiple strategies)
  ensemble?: {
    enabled: boolean;
    strategies: StrategyGenes[];
    fusionMethod: 'vote' | 'weighted' | 'cascade' | 'adaptive';
    weights?: number[];
  };
  
  // Fitness tracking
  fitness?: number;
  fitnessDetails?: {
    correctness: number;
    speed: number;
    cost: number;
    llmJudgeScore?: number;
    perTypeScores?: Record<string, number>;
  };
  
  // Evolution metadata
  generation: number;
  parentIds?: string[];
  mutations?: string[];
  createdAt: string;
  
  // Research metadata
  basedOnPaper?: string;
  experimentalFeatures?: string[];
}

// ============================================================================
// GENOME FACTORY
// ============================================================================

export class AdvancedGenomeFactory {
  /**
   * Create a random genome
   */
  static createRandom(
    generation: number = 0,
    options: {
      availableProviders?: string[];
      maxComplexity?: number;
      enableAdvancedFeatures?: boolean;
    } = {}
  ): AdvancedStrategyGenome {
    const { 
      availableProviders = ['ollama'], 
      maxComplexity = 4,
      enableAdvancedFeatures = true 
    } = options;
    
    const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
    const pickKey = <T extends object>(obj: T): keyof T => {
      const keys = Object.keys(obj) as Array<keyof T>;
      return keys[Math.floor(Math.random() * keys.length)];
    };
    
    // Filter architectures by complexity
    const eligibleArchitectures = Object.entries(RAG_ARCHITECTURES)
      .filter(([_, arch]) => arch.complexity <= maxComplexity)
      .map(([key]) => key);
    
    const architecture = pick(eligibleArchitectures) as keyof typeof RAG_ARCHITECTURES;
    
    const defaultStrategy: StrategyGenes = {
      architecture,
      embeddingProvider: pick(availableProviders) as any,
      embeddingModel: this.getRandomModel(pick(availableProviders)),
      embeddingStrategy: pickKey(EMBEDDING_STRATEGIES),
      chunkingStrategy: pickKey(CHUNKING_STRATEGIES),
      chunkSize: pick([256, 512, 768, 1024]),
      chunkOverlap: pick([0, 32, 64, 128]),
      queryStrategy: pickKey(QUERY_STRATEGIES),
      retrievalMethod: pickKey(RETRIEVAL_METHODS),
      retrievalK: pick([5, 10, 20, 50]),
      hybridAlpha: Math.random() * 0.5 + 0.4,
      rerankingMethod: pickKey(RERANKING_METHODS),
      rerankingTopK: pick([5, 10, 20]),
      mmrLambda: Math.random() * 0.4 + 0.3,
      postProcessing: this.randomPostProcessing(),
      scoreThreshold: Math.random() < 0.3 ? Math.random() * 0.3 : 0,
    };
    
    // Add architecture-specific genes
    if (architecture === 'GRAPH_RAG') {
      defaultStrategy.graphEnabled = true;
      defaultStrategy.graphTraversalDepth = pick([1, 2, 3]);
      defaultStrategy.entityLinkingThreshold = Math.random() * 0.3 + 0.5;
    }
    
    if (architecture === 'HIERARCHICAL') {
      defaultStrategy.hierarchicalLevels = pick([2, 3]);
      defaultStrategy.summarizationRatio = Math.random() * 0.3 + 0.2;
    }
    
    if (architecture === 'MULTI_HOP') {
      defaultStrategy.maxHops = pick([2, 3, 4]);
      defaultStrategy.hopTerminationThreshold = Math.random() * 0.2 + 0.7;
    }
    
    if (architecture === 'SELF_RAG') {
      defaultStrategy.selfReflectionEnabled = true;
      defaultStrategy.relevanceThreshold = Math.random() * 0.2 + 0.6;
    }
    
    return {
      id: uuidv4(),
      name: this.generateName(defaultStrategy),
      version: '2.0',
      defaultStrategy,
      generation,
      createdAt: new Date().toISOString(),
    };
  }
  
  /**
   * Create baseline genomes representing known good strategies
   */
  static createBaselines(): AdvancedStrategyGenome[] {
    return [
      // 1. Simple but effective
      this.createFromTemplate('naive-hybrid', {
        architecture: 'NAIVE',
        embeddingProvider: 'ollama',
        embeddingModel: 'nomic-embed-text',
        embeddingStrategy: 'DENSE_SINGLE',
        chunkingStrategy: 'NONE',
        queryStrategy: 'RAW',
        retrievalMethod: 'HYBRID_RRF',
        retrievalK: 10,
        rerankingMethod: 'NONE',
        postProcessing: [],
      }),
      
      // 2. HyDE strategy
      this.createFromTemplate('hyde-baseline', {
        architecture: 'NAIVE',
        embeddingProvider: 'ollama',
        embeddingModel: 'nomic-embed-text',
        embeddingStrategy: 'DENSE_SINGLE',
        chunkingStrategy: 'SEMANTIC',
        chunkSize: 512,
        queryStrategy: 'HYDE',
        retrievalMethod: 'COSINE',
        retrievalK: 20,
        rerankingMethod: 'MMR',
        mmrLambda: 0.5,
        postProcessing: ['threshold'],
      }),
      
      // 3. Hierarchical RAG
      this.createFromTemplate('hierarchical-rag', {
        architecture: 'HIERARCHICAL',
        embeddingProvider: 'ollama',
        embeddingModel: 'nomic-embed-text',
        embeddingStrategy: 'DENSE_MULTI',
        chunkingStrategy: 'PARENT_CHILD',
        chunkSize: 256,
        queryStrategy: 'EXPANDED',
        retrievalMethod: 'COSINE',
        retrievalK: 30,
        rerankingMethod: 'CROSS_ENCODER',
        rerankingTopK: 10,
        hierarchicalLevels: 3,
        postProcessing: ['expand', 'threshold'],
      }),
      
      // 4. Multi-query RAG fusion
      this.createFromTemplate('rag-fusion', {
        architecture: 'NAIVE',
        embeddingProvider: 'gemini',
        embeddingModel: 'text-embedding-004',
        embeddingStrategy: 'DENSE_SINGLE',
        chunkingStrategy: 'FIXED_TOKENS',
        chunkSize: 512,
        queryStrategy: 'RAG_FUSION',
        queryExpansionCount: 4,
        retrievalMethod: 'HYBRID_RRF',
        retrievalK: 20,
        rerankingMethod: 'LLM_POINTWISE',
        postProcessing: ['dedup'],
      }),
      
      // 5. Self-RAG
      this.createFromTemplate('self-rag', {
        architecture: 'SELF_RAG',
        embeddingProvider: 'openai',
        embeddingModel: 'text-embedding-3-small',
        embeddingStrategy: 'DENSE_SINGLE',
        chunkingStrategy: 'SEMANTIC',
        queryStrategy: 'RAW',
        retrievalMethod: 'COSINE',
        retrievalK: 15,
        rerankingMethod: 'NONE',
        selfReflectionEnabled: true,
        relevanceThreshold: 0.7,
        postProcessing: [],
      }),
      
      // 6. Graph RAG
      this.createFromTemplate('graph-enhanced', {
        architecture: 'GRAPH_RAG',
        embeddingProvider: 'ollama',
        embeddingModel: 'nomic-embed-text',
        embeddingStrategy: 'DENSE_SINGLE',
        chunkingStrategy: 'PARAGRAPH',
        queryStrategy: 'DECOMPOSED',
        retrievalMethod: 'HYBRID_LINEAR',
        retrievalK: 25,
        hybridAlpha: 0.6,
        rerankingMethod: 'MMR',
        graphEnabled: true,
        graphTraversalDepth: 2,
        postProcessing: ['expand'],
      }),
      
      // 7. Multi-hop for complex queries
      this.createFromTemplate('multi-hop', {
        architecture: 'MULTI_HOP',
        embeddingProvider: 'gemini',
        embeddingModel: 'text-embedding-004',
        embeddingStrategy: 'DENSE_SINGLE',
        chunkingStrategy: 'SEMANTIC',
        queryStrategy: 'DECOMPOSED',
        retrievalMethod: 'COSINE',
        retrievalK: 10,
        rerankingMethod: 'LLM_LISTWISE',
        maxHops: 3,
        hopTerminationThreshold: 0.8,
        postProcessing: ['compress'],
      }),
      
      // 8. Adaptive routing
      this.createFromTemplate('adaptive-router', {
        architecture: 'ADAPTIVE',
        embeddingProvider: 'ollama',
        embeddingModel: 'nomic-embed-text',
        embeddingStrategy: 'HYBRID_DENSE_SPARSE',
        chunkingStrategy: 'RECURSIVE',
        queryStrategy: 'RAW',
        retrievalMethod: 'HYBRID_RRF',
        retrievalK: 20,
        rerankingMethod: 'CASCADE',
        postProcessing: ['threshold', 'reorder'],
      }),
    ];
  }
  
  /**
   * Create genome from template
   */
  static createFromTemplate(
    name: string,
    strategy: Partial<StrategyGenes>,
    generation: number = 0
  ): AdvancedStrategyGenome {
    const defaultGenes: StrategyGenes = {
      architecture: 'NAIVE',
      embeddingProvider: 'ollama',
      embeddingModel: 'nomic-embed-text',
      embeddingStrategy: 'DENSE_SINGLE',
      chunkingStrategy: 'NONE',
      queryStrategy: 'RAW',
      retrievalMethod: 'COSINE',
      retrievalK: 10,
      rerankingMethod: 'NONE',
      postProcessing: [],
    };
    
    return {
      id: uuidv4(),
      name,
      version: '2.0',
      defaultStrategy: { ...defaultGenes, ...strategy },
      generation,
      createdAt: new Date().toISOString(),
    };
  }
  
  /**
   * Create data-adaptive genome with conditional strategies
   */
  static createAdaptive(
    name: string,
    conditionalStrategies: Array<{ 
      queryType: string; 
      strategy: Partial<StrategyGenes>;
      priority?: number;
    }>,
    defaultStrategy: Partial<StrategyGenes>,
    generation: number = 0
  ): AdvancedStrategyGenome {
    const baseGenes: StrategyGenes = {
      architecture: 'ADAPTIVE',
      embeddingProvider: 'ollama',
      embeddingModel: 'nomic-embed-text',
      embeddingStrategy: 'DENSE_SINGLE',
      chunkingStrategy: 'NONE',
      queryStrategy: 'RAW',
      retrievalMethod: 'HYBRID_RRF',
      retrievalK: 10,
      rerankingMethod: 'NONE',
      postProcessing: [],
    };
    
    return {
      id: uuidv4(),
      name,
      version: '2.0',
      defaultStrategy: { ...baseGenes, ...defaultStrategy },
      conditionalStrategies: conditionalStrategies.map((cs, i) => ({
        condition: {
          queryType: cs.queryType as any,
          documentType: 'mixed',
          complexity: 'moderate',
        },
        strategy: { ...baseGenes, ...cs.strategy },
        priority: cs.priority || i,
      })),
      generation,
      createdAt: new Date().toISOString(),
    };
  }
  
  /**
   * Create ensemble genome
   */
  static createEnsemble(
    name: string,
    strategies: Array<Partial<StrategyGenes>>,
    fusionMethod: 'vote' | 'weighted' | 'cascade' | 'adaptive' = 'weighted',
    weights?: number[],
    generation: number = 0
  ): AdvancedStrategyGenome {
    const baseGenes: StrategyGenes = {
      architecture: 'NAIVE',
      embeddingProvider: 'ollama',
      embeddingModel: 'nomic-embed-text',
      embeddingStrategy: 'DENSE_SINGLE',
      chunkingStrategy: 'NONE',
      queryStrategy: 'RAW',
      retrievalMethod: 'COSINE',
      retrievalK: 10,
      rerankingMethod: 'NONE',
      postProcessing: [],
    };
    
    return {
      id: uuidv4(),
      name,
      version: '2.0',
      defaultStrategy: baseGenes,
      ensemble: {
        enabled: true,
        strategies: strategies.map(s => ({ ...baseGenes, ...s })),
        fusionMethod,
        weights: weights || strategies.map(() => 1 / strategies.length),
      },
      generation,
      createdAt: new Date().toISOString(),
    };
  }
  
  // ============================================================================
  // HELPER METHODS
  // ============================================================================
  
  private static getRandomModel(provider: string): string {
    const models: Record<string, string[]> = {
      ollama: ['nomic-embed-text', 'mxbai-embed-large', 'all-minilm'],
      openai: ['text-embedding-3-small', 'text-embedding-3-large'],
      gemini: ['embedding-001', 'text-embedding-004'],
      cohere: ['embed-english-v3.0', 'embed-multilingual-v3.0'],
      voyage: ['voyage-2', 'voyage-large-2'],
      huggingface: ['BAAI/bge-small-en-v1.5', 'sentence-transformers/all-MiniLM-L6-v2'],
    };
    
    const available = models[provider] || models.ollama;
    return available[Math.floor(Math.random() * available.length)];
  }
  
  private static randomPostProcessing(): Array<keyof typeof POST_PROCESSING> {
    const all = Object.keys(POST_PROCESSING) as Array<keyof typeof POST_PROCESSING>;
    const count = Math.floor(Math.random() * 3); // 0-2 post-processors
    const selected: Array<keyof typeof POST_PROCESSING> = [];
    
    for (let i = 0; i < count; i++) {
      const pick = all[Math.floor(Math.random() * all.length)];
      if (pick !== 'NONE' && !selected.includes(pick)) {
        selected.push(pick);
      }
    }
    
    return selected.length > 0 ? selected : ['NONE'];
  }
  
  private static generateName(strategy: StrategyGenes): string {
    const parts: string[] = [];
    
    const arch = RAG_ARCHITECTURES[strategy.architecture];
    if (arch && arch.id !== 'naive') {
      parts.push(arch.name);
    }
    
    parts.push(strategy.embeddingModel.split('/').pop() || strategy.embeddingModel);
    
    const retrieval = RETRIEVAL_METHODS[strategy.retrievalMethod];
    if (retrieval) {
      parts.push(retrieval.name);
    }
    
    if (strategy.queryStrategy !== 'RAW') {
      const query = QUERY_STRATEGIES[strategy.queryStrategy];
      if (query) parts.push(query.name);
    }
    
    if (strategy.rerankingMethod !== 'NONE') {
      const rerank = RERANKING_METHODS[strategy.rerankingMethod];
      if (rerank) parts.push(`→${rerank.name}`);
    }
    
    parts.push(`k${strategy.retrievalK}`);
    
    return parts.join(' | ');
  }
}

// ============================================================================
// GENETIC OPERATORS
// ============================================================================

/**
 * Mutate an advanced genome
 */
export function mutateAdvanced(
  genome: AdvancedStrategyGenome,
  mutationRate: number = 0.2,
  options: { availableProviders?: string[] } = {}
): AdvancedStrategyGenome {
  const { availableProviders = ['ollama'] } = options;
  const mutated = JSON.parse(JSON.stringify(genome)) as AdvancedStrategyGenome;
  
  mutated.id = uuidv4();
  mutated.parentIds = [genome.id];
  mutated.generation = genome.generation + 1;
  mutated.mutations = [];
  mutated.fitness = undefined;
  mutated.fitnessDetails = undefined;
  
  const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
  const pickKey = <T extends object>(obj: T): keyof T => {
    const keys = Object.keys(obj) as Array<keyof T>;
    return keys[Math.floor(Math.random() * keys.length)];
  };
  
  const strategy = mutated.defaultStrategy;
  
  // Mutate architecture (less frequently)
  if (Math.random() < mutationRate * 0.3) {
    strategy.architecture = pickKey(RAG_ARCHITECTURES);
    mutated.mutations!.push('architecture');
  }
  
  // Mutate embedding
  if (Math.random() < mutationRate) {
    strategy.embeddingProvider = pick(availableProviders) as any;
    strategy.embeddingModel = AdvancedGenomeFactory['getRandomModel'](strategy.embeddingProvider);
    mutated.mutations!.push('embedding');
  }
  
  // Mutate query strategy
  if (Math.random() < mutationRate) {
    strategy.queryStrategy = pickKey(QUERY_STRATEGIES);
    mutated.mutations!.push('queryStrategy');
  }
  
  // Mutate retrieval
  if (Math.random() < mutationRate) {
    strategy.retrievalMethod = pickKey(RETRIEVAL_METHODS);
    mutated.mutations!.push('retrievalMethod');
  }
  
  if (Math.random() < mutationRate * 0.5) {
    strategy.retrievalK = pick([5, 10, 20, 30, 50]);
    mutated.mutations!.push('retrievalK');
  }
  
  // Mutate chunking
  if (Math.random() < mutationRate) {
    strategy.chunkingStrategy = pickKey(CHUNKING_STRATEGIES);
    mutated.mutations!.push('chunkingStrategy');
  }
  
  // Mutate reranking
  if (Math.random() < mutationRate) {
    strategy.rerankingMethod = pickKey(RERANKING_METHODS);
    mutated.mutations!.push('rerankingMethod');
  }
  
  // Mutate post-processing
  if (Math.random() < mutationRate) {
    strategy.postProcessing = AdvancedGenomeFactory['randomPostProcessing']();
    mutated.mutations!.push('postProcessing');
  }
  
  // Mutate numeric parameters
  if (Math.random() < mutationRate * 0.5 && strategy.hybridAlpha !== undefined) {
    strategy.hybridAlpha = Math.max(0.1, Math.min(0.9, strategy.hybridAlpha + (Math.random() - 0.5) * 0.2));
    mutated.mutations!.push('hybridAlpha');
  }
  
  mutated.name = AdvancedGenomeFactory['generateName'](strategy);
  mutated.createdAt = new Date().toISOString();
  
  return mutated;
}

/**
 * Crossover two advanced genomes
 */
export function crossoverAdvanced(
  parent1: AdvancedStrategyGenome,
  parent2: AdvancedStrategyGenome
): [AdvancedStrategyGenome, AdvancedStrategyGenome] {
  const child1Strategy = { ...parent1.defaultStrategy };
  const child2Strategy = { ...parent2.defaultStrategy };
  
  // Uniform crossover for strategy genes
  const geneKeys = Object.keys(child1Strategy) as Array<keyof StrategyGenes>;
  
  for (const key of geneKeys) {
    if (Math.random() < 0.5) {
      const temp = (child1Strategy as any)[key];
      (child1Strategy as any)[key] = (child2Strategy as any)[key];
      (child2Strategy as any)[key] = temp;
    }
  }
  
  const generation = Math.max(parent1.generation, parent2.generation) + 1;
  
  const child1: AdvancedStrategyGenome = {
    id: uuidv4(),
    name: AdvancedGenomeFactory['generateName'](child1Strategy),
    version: '2.0',
    defaultStrategy: child1Strategy,
    generation,
    parentIds: [parent1.id, parent2.id],
    createdAt: new Date().toISOString(),
  };
  
  const child2: AdvancedStrategyGenome = {
    id: uuidv4(),
    name: AdvancedGenomeFactory['generateName'](child2Strategy),
    version: '2.0',
    defaultStrategy: child2Strategy,
    generation,
    parentIds: [parent1.id, parent2.id],
    createdAt: new Date().toISOString(),
  };
  
  return [child1, child2];
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
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
};

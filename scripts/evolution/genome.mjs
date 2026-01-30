/**
 * Comprehensive Strategy Genome
 * 
 * Represents ALL possible permutations of a retrieval pipeline:
 * - Pipeline stages in any order
 * - Multiple embedding engines
 * - Query expansion strategies
 * - Reranking at various positions
 * - BM25 combinations
 * - Fusion methods
 */

import crypto from 'crypto';

// ============================================================================
// GENE DEFINITIONS - All possible configuration options
// ============================================================================

export const PIPELINE_STAGES = {
  // Query Processing
  QUERY_EXPAND_LLM: 'query_expand_llm',      // Use LLM to expand query
  QUERY_EXPAND_SYNONYMS: 'query_expand_syn', // Add synonyms
  QUERY_REWRITE_LLM: 'query_rewrite_llm',    // Rewrite query for better retrieval
  QUERY_DECOMPOSE: 'query_decompose',         // Break into sub-queries
  
  // Initial Retrieval
  EMBED_RETRIEVE: 'embed_retrieve',           // Vector similarity search
  BM25_RETRIEVE: 'bm25_retrieve',             // Lexical search
  HYBRID_RETRIEVE: 'hybrid_retrieve',         // Combined vector + lexical
  
  // Post-Retrieval Processing
  RERANK_CROSS_ENCODER: 'rerank_ce',          // Cross-encoder reranking
  RERANK_LLM: 'rerank_llm',                   // LLM-based reranking
  RERANK_MMR: 'rerank_mmr',                   // Maximal Marginal Relevance
  RERANK_COHERE: 'rerank_cohere',             // Cohere reranker
  
  // Fusion
  FUSION_RRF: 'fusion_rrf',                   // Reciprocal Rank Fusion
  FUSION_WEIGHTED: 'fusion_weighted',         // Weighted combination
  
  // Filtering
  FILTER_THRESHOLD: 'filter_threshold',       // Score threshold filter
  FILTER_DEDUP: 'filter_dedup',               // Deduplication
  FILTER_DIVERSITY: 'filter_diversity',       // Diversity filter
};

export const EMBEDDING_PROVIDERS = {
  OLLAMA_NOMIC: { provider: 'ollama', model: 'nomic-embed-text', dims: 768, cost: 0 },
  OLLAMA_MXBAI: { provider: 'ollama', model: 'mxbai-embed-large', dims: 1024, cost: 0 },
  OLLAMA_SNOWFLAKE: { provider: 'ollama', model: 'snowflake-arctic-embed', dims: 1024, cost: 0 },
  OPENAI_SMALL: { provider: 'openai', model: 'text-embedding-3-small', dims: 1536, cost: 0.00002 },
  OPENAI_LARGE: { provider: 'openai', model: 'text-embedding-3-large', dims: 3072, cost: 0.00013 },
  OPENAI_ADA: { provider: 'openai', model: 'text-embedding-ada-002', dims: 1536, cost: 0.0001 },
  GEMINI: { provider: 'gemini', model: 'embedding-001', dims: 768, cost: 0.00001 },
  COHERE_EN: { provider: 'cohere', model: 'embed-english-v3.0', dims: 1024, cost: 0.0001 },
  COHERE_MULTI: { provider: 'cohere', model: 'embed-multilingual-v3.0', dims: 1024, cost: 0.0001 },
  VOYAGE_2: { provider: 'voyage', model: 'voyage-2', dims: 1024, cost: 0.0001 },
};

export const RERANKER_MODELS = {
  NONE: null,
  CROSS_ENCODER_MS: { type: 'cross-encoder', model: 'ms-marco-MiniLM-L-6-v2', cost: 0 },
  CROSS_ENCODER_BGE: { type: 'cross-encoder', model: 'bge-reranker-base', cost: 0 },
  COHERE: { type: 'cohere', model: 'rerank-english-v2.0', cost: 0.001 },
  LLM_GPT4: { type: 'llm', model: 'gpt-4', cost: 0.03 },
  LLM_CLAUDE: { type: 'llm', model: 'claude-3-haiku', cost: 0.00025 },
};

export const QUERY_EXPANDERS = {
  NONE: null,
  SYNONYMS: { type: 'synonyms', cost: 0 },
  LLM_EXPAND: { type: 'llm', prompt: 'expand', cost: 0.001 },
  LLM_REWRITE: { type: 'llm', prompt: 'rewrite', cost: 0.001 },
  LLM_DECOMPOSE: { type: 'llm', prompt: 'decompose', cost: 0.002 },
  HYDE: { type: 'hyde', cost: 0.002 }, // Hypothetical Document Embeddings
};

export const CHUNKING_STRATEGIES = {
  NONE: { method: 'none' },
  FIXED_256: { method: 'fixed', size: 256, overlap: 25 },
  FIXED_512: { method: 'fixed', size: 512, overlap: 50 },
  FIXED_1024: { method: 'fixed', size: 1024, overlap: 100 },
  SEMANTIC: { method: 'semantic', maxSize: 512 },
  SENTENCE: { method: 'sentence', maxSentences: 5 },
  PARAGRAPH: { method: 'paragraph' },
};

export const FUSION_METHODS = {
  NONE: null,
  RRF: { method: 'rrf', k: 60 },
  RRF_TUNED: { method: 'rrf', k: 20 },
  WEIGHTED_EMBED_HEAVY: { method: 'weighted', weights: [0.8, 0.2] },
  WEIGHTED_BALANCED: { method: 'weighted', weights: [0.5, 0.5] },
  WEIGHTED_BM25_HEAVY: { method: 'weighted', weights: [0.2, 0.8] },
  COMBSUM: { method: 'combsum' },
  COMBMNZ: { method: 'combmnz' },
};

// ============================================================================
// GENOME STRUCTURE
// ============================================================================

/**
 * Complete genome representing a retrieval strategy
 */
export class StrategyGenome {
  constructor(config = {}) {
    this.id = config.id || crypto.randomUUID();
    this.generation = config.generation || 0;
    this.createdAt = config.createdAt || new Date().toISOString();
    this.parentIds = config.parentIds || [];
    
    // Pipeline configuration - ordered list of stages
    this.pipeline = config.pipeline || [];
    
    // Component configurations
    this.genes = {
      // Embedding configuration
      primaryEmbedding: config.genes?.primaryEmbedding || 'OLLAMA_NOMIC',
      secondaryEmbedding: config.genes?.secondaryEmbedding || null, // For multi-vector
      embeddingDimReduction: config.genes?.embeddingDimReduction || null, // PCA/UMAP dims
      
      // Query processing
      queryExpander: config.genes?.queryExpander || 'NONE',
      queryExpandCount: config.genes?.queryExpandCount || 3,
      
      // Chunking
      chunking: config.genes?.chunking || 'NONE',
      
      // Retrieval parameters
      initialK: config.genes?.initialK || 100,       // Initial retrieval count
      finalK: config.genes?.finalK || 10,            // Final result count
      
      // BM25 parameters
      bm25K1: config.genes?.bm25K1 || 1.2,
      bm25B: config.genes?.bm25B || 0.75,
      
      // Hybrid/Fusion
      fusionMethod: config.genes?.fusionMethod || 'NONE',
      hybridAlpha: config.genes?.hybridAlpha || 0.5, // Weight for vector vs lexical
      
      // Reranking
      reranker: config.genes?.reranker || 'NONE',
      rerankK: config.genes?.rerankK || 50,          // How many to rerank
      
      // MMR parameters
      mmrLambda: config.genes?.mmrLambda || 0.5,
      
      // Filtering
      scoreThreshold: config.genes?.scoreThreshold || 0,
      diversityThreshold: config.genes?.diversityThreshold || 0.8,
      
      // Multi-stage retrieval
      useMultiStage: config.genes?.useMultiStage || false,
      stage1Method: config.genes?.stage1Method || 'bm25', // Fast first stage
      stage1K: config.genes?.stage1K || 1000,
    };
    
    // Fitness scores (set after evaluation)
    this.fitness = config.fitness || null;
  }
  
  /**
   * Generate a unique name based on configuration
   */
  getName() {
    const parts = [];
    
    // Query processing
    if (this.genes.queryExpander !== 'NONE') {
      parts.push(`qe:${this.genes.queryExpander.toLowerCase()}`);
    }
    
    // Embedding
    const emb = this.genes.primaryEmbedding.toLowerCase().replace('_', '-');
    parts.push(emb);
    
    // Pipeline stages
    const stageAbbrev = {
      'embed_retrieve': 'emb',
      'bm25_retrieve': 'bm25',
      'hybrid_retrieve': 'hyb',
      'rerank_ce': 'rce',
      'rerank_llm': 'rllm',
      'rerank_mmr': 'mmr',
      'fusion_rrf': 'rrf',
    };
    
    for (const stage of this.pipeline) {
      if (stageAbbrev[stage]) {
        parts.push(stageAbbrev[stage]);
      }
    }
    
    // Parameters
    parts.push(`k${this.genes.finalK}`);
    
    if (this.genes.fusionMethod !== 'NONE') {
      parts.push(`f:${this.genes.fusionMethod.toLowerCase()}`);
    }
    
    return parts.join('-');
  }
  
  /**
   * Calculate estimated cost per query
   */
  getEstimatedCost() {
    let cost = 0;
    
    // Embedding cost
    const embConfig = EMBEDDING_PROVIDERS[this.genes.primaryEmbedding];
    if (embConfig) cost += embConfig.cost;
    
    if (this.genes.secondaryEmbedding) {
      const secEmbConfig = EMBEDDING_PROVIDERS[this.genes.secondaryEmbedding];
      if (secEmbConfig) cost += secEmbConfig.cost;
    }
    
    // Query expansion cost
    const expConfig = QUERY_EXPANDERS[this.genes.queryExpander];
    if (expConfig) cost += expConfig.cost || 0;
    
    // Reranking cost
    const rerankConfig = RERANKER_MODELS[this.genes.reranker];
    if (rerankConfig) cost += rerankConfig.cost || 0;
    
    return cost;
  }
  
  /**
   * Validate genome is internally consistent
   */
  validate() {
    const errors = [];
    
    // Must have at least one retrieval stage
    const hasRetrieval = this.pipeline.some(s => 
      s.includes('retrieve')
    );
    if (!hasRetrieval) {
      errors.push('Pipeline must include at least one retrieval stage');
    }
    
    // Fusion requires multiple retrieval results
    if (this.genes.fusionMethod !== 'NONE') {
      const retrievalCount = this.pipeline.filter(s => s.includes('retrieve')).length;
      if (retrievalCount < 2 && !this.pipeline.includes('hybrid_retrieve')) {
        errors.push('Fusion requires multiple retrieval stages or hybrid retrieval');
      }
    }
    
    // Reranking should come after retrieval
    const rerankIdx = this.pipeline.findIndex(s => s.includes('rerank'));
    const retrieveIdx = this.pipeline.findIndex(s => s.includes('retrieve'));
    if (rerankIdx !== -1 && retrieveIdx !== -1 && rerankIdx < retrieveIdx) {
      errors.push('Reranking should come after retrieval');
    }
    
    return { valid: errors.length === 0, errors };
  }
  
  /**
   * Clone with new ID
   */
  clone() {
    return new StrategyGenome({
      ...this.toJSON(),
      id: crypto.randomUUID(),
      parentIds: [this.id],
    });
  }
  
  /**
   * Serialize to JSON
   */
  toJSON() {
    return {
      id: this.id,
      generation: this.generation,
      createdAt: this.createdAt,
      parentIds: this.parentIds,
      pipeline: [...this.pipeline],
      genes: { ...this.genes },
      fitness: this.fitness,
    };
  }
  
  /**
   * Create from JSON
   */
  static fromJSON(json) {
    return new StrategyGenome(json);
  }
}

// ============================================================================
// GENOME FACTORY - Create various genome types
// ============================================================================

export class GenomeFactory {
  /**
   * Create a completely random genome
   */
  static createRandom(generation = 0) {
    const pick = (obj) => {
      const keys = Object.keys(obj);
      return keys[Math.floor(Math.random() * keys.length)];
    };
    
    const pickN = (arr, n) => {
      const shuffled = [...arr].sort(() => Math.random() - 0.5);
      return shuffled.slice(0, n);
    };
    
    // Generate random pipeline
    const pipeline = [];
    
    // 30% chance of query expansion
    if (Math.random() < 0.3) {
      const expanders = ['query_expand_llm', 'query_expand_syn', 'query_rewrite_llm'];
      pipeline.push(expanders[Math.floor(Math.random() * expanders.length)]);
    }
    
    // Choose retrieval method(s)
    const retrievalMethods = ['embed_retrieve', 'bm25_retrieve', 'hybrid_retrieve'];
    const numRetrievals = Math.random() < 0.3 ? 2 : 1;
    
    if (numRetrievals === 1) {
      pipeline.push(retrievalMethods[Math.floor(Math.random() * retrievalMethods.length)]);
    } else {
      // Multi-retrieval with fusion
      pipeline.push('embed_retrieve');
      pipeline.push('bm25_retrieve');
      pipeline.push(Math.random() < 0.5 ? 'fusion_rrf' : 'fusion_weighted');
    }
    
    // 50% chance of reranking
    if (Math.random() < 0.5) {
      const rerankers = ['rerank_mmr', 'rerank_ce', 'rerank_llm'];
      pipeline.push(rerankers[Math.floor(Math.random() * rerankers.length)]);
    }
    
    // 20% chance of diversity filter
    if (Math.random() < 0.2) {
      pipeline.push('filter_diversity');
    }
    
    return new StrategyGenome({
      generation,
      pipeline,
      genes: {
        primaryEmbedding: pick(EMBEDDING_PROVIDERS),
        secondaryEmbedding: Math.random() < 0.2 ? pick(EMBEDDING_PROVIDERS) : null,
        queryExpander: Math.random() < 0.3 ? pick(QUERY_EXPANDERS) : 'NONE',
        queryExpandCount: Math.floor(Math.random() * 5) + 1,
        chunking: pick(CHUNKING_STRATEGIES),
        initialK: [50, 100, 200, 500][Math.floor(Math.random() * 4)],
        finalK: [5, 10, 20, 50][Math.floor(Math.random() * 4)],
        bm25K1: 0.5 + Math.random() * 1.5,
        bm25B: 0.3 + Math.random() * 0.6,
        fusionMethod: numRetrievals > 1 ? pick(FUSION_METHODS) : 'NONE',
        hybridAlpha: Math.random(),
        reranker: Math.random() < 0.5 ? pick(RERANKER_MODELS) : 'NONE',
        rerankK: [20, 50, 100][Math.floor(Math.random() * 3)],
        mmrLambda: 0.3 + Math.random() * 0.5,
        scoreThreshold: Math.random() < 0.3 ? Math.random() * 0.3 : 0,
        diversityThreshold: 0.5 + Math.random() * 0.4,
        useMultiStage: Math.random() < 0.2,
        stage1Method: Math.random() < 0.5 ? 'bm25' : 'embed',
        stage1K: [500, 1000, 2000][Math.floor(Math.random() * 3)],
      },
    });
  }
  
  /**
   * Create baseline genome (simple vector search)
   */
  static createBaseline() {
    return new StrategyGenome({
      generation: 0,
      pipeline: ['embed_retrieve'],
      genes: {
        primaryEmbedding: 'OLLAMA_NOMIC',
        queryExpander: 'NONE',
        chunking: 'NONE',
        initialK: 100,
        finalK: 10,
        fusionMethod: 'NONE',
        reranker: 'NONE',
      },
    });
  }
  
  /**
   * Create hybrid search genome
   */
  static createHybrid() {
    return new StrategyGenome({
      generation: 0,
      pipeline: ['hybrid_retrieve'],
      genes: {
        primaryEmbedding: 'OLLAMA_NOMIC',
        queryExpander: 'NONE',
        chunking: 'NONE',
        initialK: 100,
        finalK: 10,
        fusionMethod: 'WEIGHTED_BALANCED',
        hybridAlpha: 0.7,
        reranker: 'NONE',
      },
    });
  }
  
  /**
   * Create advanced RAG genome (query expansion + hybrid + reranking)
   */
  static createAdvancedRAG() {
    return new StrategyGenome({
      generation: 0,
      pipeline: [
        'query_expand_llm',
        'embed_retrieve',
        'bm25_retrieve', 
        'fusion_rrf',
        'rerank_ce',
      ],
      genes: {
        primaryEmbedding: 'OPENAI_SMALL',
        queryExpander: 'LLM_EXPAND',
        queryExpandCount: 3,
        chunking: 'FIXED_512',
        initialK: 200,
        finalK: 10,
        fusionMethod: 'RRF',
        reranker: 'CROSS_ENCODER_MS',
        rerankK: 50,
      },
    });
  }
  
  /**
   * Create cost-optimized genome (local models only)
   */
  static createCostOptimized() {
    return new StrategyGenome({
      generation: 0,
      pipeline: ['embed_retrieve', 'rerank_mmr'],
      genes: {
        primaryEmbedding: 'OLLAMA_NOMIC',
        queryExpander: 'NONE',
        chunking: 'FIXED_512',
        initialK: 100,
        finalK: 10,
        fusionMethod: 'NONE',
        reranker: 'NONE',
        mmrLambda: 0.5,
      },
    });
  }
  
  /**
   * Create speed-optimized genome
   */
  static createSpeedOptimized() {
    return new StrategyGenome({
      generation: 0,
      pipeline: ['bm25_retrieve'],
      genes: {
        primaryEmbedding: 'OLLAMA_NOMIC',
        queryExpander: 'NONE',
        chunking: 'NONE',
        initialK: 50,
        finalK: 10,
        fusionMethod: 'NONE',
        reranker: 'NONE',
      },
    });
  }
  
  /**
   * Create seeded population with diverse strategies
   */
  static createSeededPopulation(size = 10) {
    const seeded = [
      this.createBaseline(),
      this.createHybrid(),
      this.createAdvancedRAG(),
      this.createCostOptimized(),
      this.createSpeedOptimized(),
    ];
    
    // Fill rest with random
    while (seeded.length < size) {
      seeded.push(this.createRandom(0));
    }
    
    return seeded.slice(0, size);
  }
}

export default { StrategyGenome, GenomeFactory, PIPELINE_STAGES, EMBEDDING_PROVIDERS };

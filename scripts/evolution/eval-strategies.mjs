/**
 * Evaluation Strategy Permutations
 * 
 * Tests fundamentally different approaches to retrieval evaluation:
 * 
 * 1. RETRIEVAL METHODS: Vector, BM25, Hybrid, Multi-vector
 * 2. QUERY PROCESSING: Raw, Expanded, Rewritten, Decomposed, HyDE
 * 3. SCORING FUNCTIONS: Cosine, Dot product, Euclidean, BM25 variants
 * 4. RANKING ALGORITHMS: Top-K, MMR, Diversity, Reciprocal Rank Fusion
 * 5. RERANKING: None, Cross-encoder, LLM, Cohere
 * 6. CHUNK STRATEGIES: Full doc, Fixed chunks, Semantic chunks, Sentences
 * 7. EMBEDDING MODELS: Different dimensions, providers, fine-tuned
 * 8. FUSION METHODS: Early fusion, Late fusion, Score combination
 */

import crypto from 'crypto';

// ============================================================================
// EVALUATION STRATEGY COMPONENTS
// ============================================================================

/**
 * All possible retrieval methods
 */
export const RETRIEVAL_METHODS = {
  // Pure vector search
  VECTOR_COSINE: {
    id: 'vector_cosine',
    name: 'Vector (Cosine)',
    type: 'dense',
    scorer: 'cosine',
    description: 'Dense vector similarity with cosine distance',
  },
  VECTOR_DOT: {
    id: 'vector_dot', 
    name: 'Vector (Dot Product)',
    type: 'dense',
    scorer: 'dot',
    description: 'Dense vector similarity with dot product',
  },
  VECTOR_EUCLIDEAN: {
    id: 'vector_euclidean',
    name: 'Vector (Euclidean)',
    type: 'dense', 
    scorer: 'euclidean',
    description: 'Dense vector similarity with L2 distance',
  },
  
  // Sparse/lexical search
  BM25_CLASSIC: {
    id: 'bm25_classic',
    name: 'BM25 Classic',
    type: 'sparse',
    scorer: 'bm25',
    params: { k1: 1.2, b: 0.75 },
    description: 'Classic BM25 with standard parameters',
  },
  BM25_TUNED: {
    id: 'bm25_tuned',
    name: 'BM25 Tuned',
    type: 'sparse',
    scorer: 'bm25',
    params: { k1: 0.9, b: 0.4 },
    description: 'BM25 with parameters tuned for short queries',
  },
  TFIDF: {
    id: 'tfidf',
    name: 'TF-IDF',
    type: 'sparse',
    scorer: 'tfidf',
    description: 'Classic TF-IDF scoring',
  },
  
  // Hybrid methods
  HYBRID_LINEAR: {
    id: 'hybrid_linear',
    name: 'Hybrid (Linear)',
    type: 'hybrid',
    combination: 'linear',
    weights: [0.7, 0.3],
    description: 'Linear combination of vector and BM25 scores',
  },
  HYBRID_RRF: {
    id: 'hybrid_rrf',
    name: 'Hybrid (RRF)',
    type: 'hybrid',
    combination: 'rrf',
    k: 60,
    description: 'Reciprocal Rank Fusion of vector and BM25 results',
  },
  HYBRID_LEARNED: {
    id: 'hybrid_learned',
    name: 'Hybrid (Learned)',
    type: 'hybrid',
    combination: 'learned',
    description: 'ML-based fusion of multiple signals',
  },
  
  // Multi-vector approaches
  COLBERT: {
    id: 'colbert',
    name: 'ColBERT',
    type: 'multi_vector',
    description: 'Late interaction with token-level embeddings',
  },
  MULTI_VECTOR_MAX: {
    id: 'multi_vector_max',
    name: 'Multi-Vector (MaxSim)',
    type: 'multi_vector',
    aggregation: 'max',
    description: 'Multiple vectors per document with max similarity',
  },
};

/**
 * Query processing strategies
 */
export const QUERY_PROCESSORS = {
  RAW: {
    id: 'raw',
    name: 'Raw Query',
    description: 'Use query as-is without modification',
  },
  LOWERCASE: {
    id: 'lowercase',
    name: 'Lowercased',
    description: 'Convert query to lowercase',
  },
  EXPANDED_SYNONYMS: {
    id: 'expanded_synonyms',
    name: 'Synonym Expansion',
    description: 'Expand query with synonyms',
  },
  EXPANDED_LLM: {
    id: 'expanded_llm',
    name: 'LLM Expansion',
    description: 'Use LLM to generate query variations',
    cost: 0.001,
  },
  REWRITTEN_LLM: {
    id: 'rewritten_llm',
    name: 'LLM Rewrite',
    description: 'Rewrite query for better retrieval',
    cost: 0.001,
  },
  DECOMPOSED: {
    id: 'decomposed',
    name: 'Query Decomposition',
    description: 'Break complex query into sub-queries',
    cost: 0.002,
  },
  HYDE: {
    id: 'hyde',
    name: 'HyDE',
    description: 'Hypothetical Document Embeddings',
    cost: 0.002,
  },
  STEP_BACK: {
    id: 'step_back',
    name: 'Step-Back Prompting',
    description: 'Generate broader context query first',
    cost: 0.002,
  },
};

/**
 * Document chunking strategies
 */
export const CHUNKING_STRATEGIES = {
  FULL_DOC: {
    id: 'full_doc',
    name: 'Full Document',
    description: 'Embed entire document as single vector',
  },
  FIXED_256: {
    id: 'fixed_256',
    name: 'Fixed 256 tokens',
    size: 256,
    overlap: 32,
    description: 'Fixed-size chunks of 256 tokens',
  },
  FIXED_512: {
    id: 'fixed_512',
    name: 'Fixed 512 tokens',
    size: 512,
    overlap: 64,
    description: 'Fixed-size chunks of 512 tokens',
  },
  FIXED_1024: {
    id: 'fixed_1024',
    name: 'Fixed 1024 tokens',
    size: 1024,
    overlap: 128,
    description: 'Fixed-size chunks of 1024 tokens',
  },
  SEMANTIC: {
    id: 'semantic',
    name: 'Semantic Chunking',
    description: 'Split on semantic boundaries using embeddings',
  },
  SENTENCE: {
    id: 'sentence',
    name: 'Sentence-level',
    description: 'One embedding per sentence',
  },
  PARAGRAPH: {
    id: 'paragraph',
    name: 'Paragraph-level',
    description: 'One embedding per paragraph',
  },
  HIERARCHICAL: {
    id: 'hierarchical',
    name: 'Hierarchical',
    description: 'Multiple granularity levels',
  },
};

/**
 * Reranking methods
 */
export const RERANKERS = {
  NONE: {
    id: 'none',
    name: 'No Reranking',
    description: 'Use initial retrieval scores only',
  },
  CROSS_ENCODER_MINI: {
    id: 'cross_encoder_mini',
    name: 'Cross-Encoder (MiniLM)',
    model: 'cross-encoder/ms-marco-MiniLM-L-6-v2',
    description: 'Fast cross-encoder reranking',
  },
  CROSS_ENCODER_LARGE: {
    id: 'cross_encoder_large',
    name: 'Cross-Encoder (Large)',
    model: 'cross-encoder/ms-marco-electra-base',
    description: 'More accurate cross-encoder',
  },
  COHERE: {
    id: 'cohere',
    name: 'Cohere Rerank',
    model: 'rerank-english-v2.0',
    cost: 0.001,
    description: 'Cohere reranking API',
  },
  LLM_POINTWISE: {
    id: 'llm_pointwise',
    name: 'LLM Pointwise',
    description: 'Score each doc independently with LLM',
    cost: 0.01,
  },
  LLM_LISTWISE: {
    id: 'llm_listwise',
    name: 'LLM Listwise',
    description: 'Rank all docs together with LLM',
    cost: 0.02,
  },
  MMR: {
    id: 'mmr',
    name: 'MMR',
    lambda: 0.5,
    description: 'Maximal Marginal Relevance for diversity',
  },
  LOST_IN_MIDDLE: {
    id: 'lost_in_middle',
    name: 'Lost-in-Middle Fix',
    description: 'Reorder to avoid middle position bias',
  },
};

/**
 * Embedding models with different characteristics
 */
export const EMBEDDING_MODELS = {
  // Local models (Ollama)
  NOMIC_EMBED: {
    id: 'nomic_embed',
    name: 'Nomic Embed',
    provider: 'ollama',
    model: 'nomic-embed-text',
    dimensions: 768,
    cost: 0,
    description: 'Good general-purpose local model',
  },
  MXBAI_LARGE: {
    id: 'mxbai_large',
    name: 'MxBai Large',
    provider: 'ollama',
    model: 'mxbai-embed-large',
    dimensions: 1024,
    cost: 0,
    description: 'Larger local model, better quality',
  },
  SNOWFLAKE_ARCTIC: {
    id: 'snowflake_arctic',
    name: 'Snowflake Arctic',
    provider: 'ollama',
    model: 'snowflake-arctic-embed',
    dimensions: 1024,
    cost: 0,
    description: 'Optimized for retrieval tasks',
  },
  
  // OpenAI models
  OPENAI_SMALL: {
    id: 'openai_small',
    name: 'OpenAI Small',
    provider: 'openai',
    model: 'text-embedding-3-small',
    dimensions: 1536,
    cost: 0.00002,
    description: 'Fast and cheap OpenAI embeddings',
  },
  OPENAI_LARGE: {
    id: 'openai_large',
    name: 'OpenAI Large',
    provider: 'openai',
    model: 'text-embedding-3-large',
    dimensions: 3072,
    cost: 0.00013,
    description: 'Highest quality OpenAI embeddings',
  },
  
  // Other providers
  GEMINI: {
    id: 'gemini',
    name: 'Gemini',
    provider: 'gemini',
    model: 'embedding-001',
    dimensions: 768,
    cost: 0.00001,
    description: 'Google Gemini embeddings',
  },
  COHERE_EN: {
    id: 'cohere_en',
    name: 'Cohere English',
    provider: 'cohere',
    model: 'embed-english-v3.0',
    dimensions: 1024,
    cost: 0.0001,
    description: 'Cohere English embeddings',
  },
  VOYAGE: {
    id: 'voyage',
    name: 'Voyage',
    provider: 'voyage',
    model: 'voyage-2',
    dimensions: 1024,
    cost: 0.0001,
    description: 'Voyage AI embeddings',
  },
};

/**
 * Post-retrieval processing
 */
export const POST_PROCESSORS = {
  NONE: {
    id: 'none',
    name: 'None',
    description: 'No post-processing',
  },
  DEDUP: {
    id: 'dedup',
    name: 'Deduplication',
    description: 'Remove near-duplicate results',
  },
  DIVERSITY: {
    id: 'diversity',
    name: 'Diversity Filter',
    description: 'Ensure diverse results',
  },
  THRESHOLD: {
    id: 'threshold',
    name: 'Score Threshold',
    threshold: 0.5,
    description: 'Filter low-scoring results',
  },
  CONTEXT_EXPANSION: {
    id: 'context_expansion',
    name: 'Context Expansion',
    description: 'Expand retrieved chunks to include surrounding context',
  },
};

// ============================================================================
// EVALUATION STRATEGY GENOME
// ============================================================================

/**
 * Complete evaluation strategy configuration
 */
export class EvalStrategyGenome {
  constructor(config = {}) {
    this.id = config.id || crypto.randomUUID();
    this.generation = config.generation || 0;
    this.createdAt = config.createdAt || new Date().toISOString();
    this.parentIds = config.parentIds || [];
    
    // Strategy components
    this.components = {
      // Core retrieval
      embeddingModel: config.components?.embeddingModel || 'NOMIC_EMBED',
      retrievalMethod: config.components?.retrievalMethod || 'VECTOR_COSINE',
      chunkingStrategy: config.components?.chunkingStrategy || 'FULL_DOC',
      
      // Query processing
      queryProcessor: config.components?.queryProcessor || 'RAW',
      
      // Ranking/Reranking
      reranker: config.components?.reranker || 'NONE',
      
      // Post-processing
      postProcessor: config.components?.postProcessor || 'NONE',
      
      // Parameters
      topK: config.components?.topK || 10,
      rerankTopK: config.components?.rerankTopK || 50,
      hybridAlpha: config.components?.hybridAlpha || 0.7,
      mmrLambda: config.components?.mmrLambda || 0.5,
      scoreThreshold: config.components?.scoreThreshold || 0,
    };
    
    // Fitness scores
    this.fitness = config.fitness || null;
  }
  
  /**
   * Get human-readable name
   */
  getName() {
    const parts = [];
    
    // Query processing
    if (this.components.queryProcessor !== 'RAW') {
      parts.push(QUERY_PROCESSORS[this.components.queryProcessor]?.name || this.components.queryProcessor);
    }
    
    // Embedding
    const emb = EMBEDDING_MODELS[this.components.embeddingModel];
    parts.push(emb?.name || this.components.embeddingModel);
    
    // Retrieval
    const ret = RETRIEVAL_METHODS[this.components.retrievalMethod];
    parts.push(ret?.name || this.components.retrievalMethod);
    
    // Chunking
    if (this.components.chunkingStrategy !== 'FULL_DOC') {
      const chunk = CHUNKING_STRATEGIES[this.components.chunkingStrategy];
      parts.push(chunk?.name || this.components.chunkingStrategy);
    }
    
    // Reranking
    if (this.components.reranker !== 'NONE') {
      const rerank = RERANKERS[this.components.reranker];
      parts.push(`→ ${rerank?.name || this.components.reranker}`);
    }
    
    // Post-processing
    if (this.components.postProcessor !== 'NONE') {
      const post = POST_PROCESSORS[this.components.postProcessor];
      parts.push(`+ ${post?.name || this.components.postProcessor}`);
    }
    
    return parts.join(' | ');
  }
  
  /**
   * Get short name for tables
   */
  getShortName() {
    const parts = [];
    
    if (this.components.queryProcessor !== 'RAW') {
      parts.push(this.components.queryProcessor.toLowerCase());
    }
    
    parts.push(this.components.embeddingModel.toLowerCase().replace('_', '-'));
    parts.push(this.components.retrievalMethod.toLowerCase().replace('_', '-'));
    
    if (this.components.chunkingStrategy !== 'FULL_DOC') {
      parts.push(this.components.chunkingStrategy.toLowerCase().replace('_', '-'));
    }
    
    if (this.components.reranker !== 'NONE') {
      parts.push(this.components.reranker.toLowerCase().replace('_', '-'));
    }
    
    parts.push(`k${this.components.topK}`);
    
    return parts.join('-');
  }
  
  /**
   * Estimate cost per query
   */
  getEstimatedCost() {
    let cost = 0;
    
    // Embedding cost
    const emb = EMBEDDING_MODELS[this.components.embeddingModel];
    if (emb) cost += emb.cost || 0;
    
    // Query processing cost
    const qp = QUERY_PROCESSORS[this.components.queryProcessor];
    if (qp) cost += qp.cost || 0;
    
    // Reranking cost
    const rr = RERANKERS[this.components.reranker];
    if (rr) cost += rr.cost || 0;
    
    return cost;
  }
  
  /**
   * Check if strategy is valid for given environment
   */
  isValidForEnvironment(env) {
    const emb = EMBEDDING_MODELS[this.components.embeddingModel];
    if (!emb) return false;
    
    // Check provider availability
    if (env.availableProviders && !env.availableProviders.includes(emb.provider)) {
      return false;
    }
    
    // Check cost constraint
    if (env.maxCostPerQuery !== null && this.getEstimatedCost() > env.maxCostPerQuery) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Clone genome
   */
  clone() {
    return new EvalStrategyGenome({
      ...this.toJSON(),
      id: crypto.randomUUID(),
      parentIds: [this.id],
    });
  }
  
  /**
   * Serialize
   */
  toJSON() {
    return {
      id: this.id,
      generation: this.generation,
      createdAt: this.createdAt,
      parentIds: this.parentIds,
      components: { ...this.components },
      fitness: this.fitness,
    };
  }
  
  static fromJSON(json) {
    return new EvalStrategyGenome(json);
  }
}

// ============================================================================
// GENOME FACTORY
// ============================================================================

export class EvalStrategyFactory {
  /**
   * Create random strategy
   */
  static createRandom(env = {}, generation = 0) {
    const pickKey = (obj) => {
      const keys = Object.keys(obj);
      return keys[Math.floor(Math.random() * keys.length)];
    };
    
    const pickFrom = (arr) => arr[Math.floor(Math.random() * arr.length)];
    
    // Filter by environment
    const availableEmbeddings = Object.entries(EMBEDDING_MODELS)
      .filter(([_, m]) => !env.availableProviders || env.availableProviders.includes(m.provider))
      .map(([k]) => k);
    
    if (availableEmbeddings.length === 0) {
      availableEmbeddings.push('NOMIC_EMBED'); // Fallback
    }
    
    const genome = new EvalStrategyGenome({
      generation,
      components: {
        embeddingModel: pickFrom(availableEmbeddings),
        retrievalMethod: pickKey(RETRIEVAL_METHODS),
        chunkingStrategy: pickKey(CHUNKING_STRATEGIES),
        queryProcessor: pickKey(QUERY_PROCESSORS),
        reranker: pickKey(RERANKERS),
        postProcessor: pickKey(POST_PROCESSORS),
        topK: pickFrom([5, 10, 20, 50]),
        rerankTopK: pickFrom([20, 50, 100]),
        hybridAlpha: Math.random() * 0.5 + 0.5, // 0.5 to 1.0
        mmrLambda: Math.random() * 0.5 + 0.3, // 0.3 to 0.8
        scoreThreshold: Math.random() < 0.3 ? Math.random() * 0.3 : 0,
      },
    });
    
    return genome;
  }
  
  /**
   * Create baseline strategies for comparison
   */
  static createBaselines(env = {}) {
    const baselines = [];
    
    // 1. Simple vector search (baseline)
    baselines.push(new EvalStrategyGenome({
      components: {
        embeddingModel: 'NOMIC_EMBED',
        retrievalMethod: 'VECTOR_COSINE',
        chunkingStrategy: 'FULL_DOC',
        queryProcessor: 'RAW',
        reranker: 'NONE',
        postProcessor: 'NONE',
        topK: 10,
      },
    }));
    
    // 2. BM25 only
    baselines.push(new EvalStrategyGenome({
      components: {
        embeddingModel: 'NOMIC_EMBED',
        retrievalMethod: 'BM25_CLASSIC',
        chunkingStrategy: 'FULL_DOC',
        queryProcessor: 'RAW',
        reranker: 'NONE',
        postProcessor: 'NONE',
        topK: 10,
      },
    }));
    
    // 3. Hybrid RRF
    baselines.push(new EvalStrategyGenome({
      components: {
        embeddingModel: 'NOMIC_EMBED',
        retrievalMethod: 'HYBRID_RRF',
        chunkingStrategy: 'FULL_DOC',
        queryProcessor: 'RAW',
        reranker: 'NONE',
        postProcessor: 'NONE',
        topK: 10,
      },
    }));
    
    // 4. Vector + MMR reranking
    baselines.push(new EvalStrategyGenome({
      components: {
        embeddingModel: 'NOMIC_EMBED',
        retrievalMethod: 'VECTOR_COSINE',
        chunkingStrategy: 'FULL_DOC',
        queryProcessor: 'RAW',
        reranker: 'MMR',
        postProcessor: 'NONE',
        topK: 10,
        rerankTopK: 50,
        mmrLambda: 0.5,
      },
    }));
    
    // 5. Query expansion + Hybrid
    baselines.push(new EvalStrategyGenome({
      components: {
        embeddingModel: 'NOMIC_EMBED',
        retrievalMethod: 'HYBRID_LINEAR',
        chunkingStrategy: 'FULL_DOC',
        queryProcessor: 'EXPANDED_SYNONYMS',
        reranker: 'NONE',
        postProcessor: 'NONE',
        topK: 10,
        hybridAlpha: 0.7,
      },
    }));
    
    // 6. Chunked retrieval
    baselines.push(new EvalStrategyGenome({
      components: {
        embeddingModel: 'NOMIC_EMBED',
        retrievalMethod: 'VECTOR_COSINE',
        chunkingStrategy: 'FIXED_512',
        queryProcessor: 'RAW',
        reranker: 'NONE',
        postProcessor: 'NONE',
        topK: 10,
      },
    }));
    
    // 7. HyDE
    baselines.push(new EvalStrategyGenome({
      components: {
        embeddingModel: 'NOMIC_EMBED',
        retrievalMethod: 'VECTOR_COSINE',
        chunkingStrategy: 'FULL_DOC',
        queryProcessor: 'HYDE',
        reranker: 'NONE',
        postProcessor: 'NONE',
        topK: 10,
      },
    }));
    
    // 8. Full pipeline
    baselines.push(new EvalStrategyGenome({
      components: {
        embeddingModel: 'NOMIC_EMBED',
        retrievalMethod: 'HYBRID_RRF',
        chunkingStrategy: 'FIXED_512',
        queryProcessor: 'EXPANDED_SYNONYMS',
        reranker: 'MMR',
        postProcessor: 'DIVERSITY',
        topK: 10,
        rerankTopK: 50,
      },
    }));
    
    return baselines.filter(g => g.isValidForEnvironment(env));
  }
  
  /**
   * Create seeded population
   */
  static createSeededPopulation(size, env = {}) {
    const population = this.createBaselines(env);
    
    while (population.length < size) {
      const genome = this.createRandom(env, 0);
      if (genome.isValidForEnvironment(env)) {
        population.push(genome);
      }
    }
    
    return population.slice(0, size);
  }
}

export default {
  RETRIEVAL_METHODS,
  QUERY_PROCESSORS,
  CHUNKING_STRATEGIES,
  RERANKERS,
  EMBEDDING_MODELS,
  POST_PROCESSORS,
  EvalStrategyGenome,
  EvalStrategyFactory,
};

/**
 * Multi-Objective Fitness Evaluation
 * 
 * Evaluates genomes across multiple dimensions:
 * - Correctness: Retrieval quality metrics (NDCG, Recall, MRR)
 * - Speed: Latency and throughput
 * - Cost: API costs and resource usage
 * - Robustness: Performance across different query types
 */

import { EMBEDDING_PROVIDERS, RERANKER_MODELS, QUERY_EXPANDERS } from './genome.mjs';

// ============================================================================
// FITNESS FUNCTION
// ============================================================================

/**
 * Complete fitness evaluation result
 */
export class FitnessResult {
  constructor(config = {}) {
    // Correctness metrics (higher is better)
    this.correctness = {
      ndcg5: config.ndcg5 || 0,
      ndcg10: config.ndcg10 || 0,
      recall5: config.recall5 || 0,
      recall10: config.recall10 || 0,
      mrr10: config.mrr10 || 0,
      map10: config.map10 || 0,
      precision5: config.precision5 || 0,
      hitRate: config.hitRate || 0,
    };
    
    // Speed metrics (lower latency is better, will be inverted for fitness)
    this.speed = {
      avgLatencyMs: config.avgLatencyMs || 0,
      p50LatencyMs: config.p50LatencyMs || 0,
      p95LatencyMs: config.p95LatencyMs || 0,
      p99LatencyMs: config.p99LatencyMs || 0,
      queriesPerSecond: config.queriesPerSecond || 0,
    };
    
    // Cost metrics (lower is better, will be inverted for fitness)
    this.cost = {
      costPerQuery: config.costPerQuery || 0,
      embeddingCost: config.embeddingCost || 0,
      rerankingCost: config.rerankingCost || 0,
      queryExpansionCost: config.queryExpansionCost || 0,
      totalCost: config.totalCost || 0,
    };
    
    // Robustness metrics (higher is better)
    this.robustness = {
      consistencyScore: config.consistencyScore || 0,  // Variance across runs
      queryTypeScores: config.queryTypeScores || {},   // Score by query type
      edgeCaseScore: config.edgeCaseScore || 0,        // Performance on hard queries
      degradationResistance: config.degradationResistance || 0, // Performance under load
    };
    
    // Computed aggregate scores
    this.overall = 0;
    this.paretoRank = 0;
  }
  
  /**
   * Compute overall fitness with configurable weights
   */
  computeOverall(weights = {}) {
    const {
      correctnessWeight = 0.5,
      speedWeight = 0.2,
      costWeight = 0.2,
      robustnessWeight = 0.1,
    } = weights;
    
    // Normalize each dimension to 0-1
    const correctnessScore = this.getCorrectnessScore();
    const speedScore = this.getSpeedScore();
    const costScore = this.getCostScore();
    const robustnessScore = this.getRobustnessScore();
    
    this.overall = (
      correctnessWeight * correctnessScore +
      speedWeight * speedScore +
      costWeight * costScore +
      robustnessWeight * robustnessScore
    );
    
    return this.overall;
  }
  
  /**
   * Get normalized correctness score (0-1)
   */
  getCorrectnessScore() {
    // Weighted combination of metrics
    return (
      0.3 * this.correctness.ndcg10 +
      0.2 * this.correctness.recall10 +
      0.2 * this.correctness.mrr10 +
      0.15 * this.correctness.ndcg5 +
      0.15 * this.correctness.hitRate
    );
  }
  
  /**
   * Get normalized speed score (0-1, higher is better)
   */
  getSpeedScore() {
    // Target: < 100ms is excellent, > 5000ms is terrible
    const latency = this.speed.avgLatencyMs;
    
    if (latency <= 0) return 0;
    if (latency <= 50) return 1.0;
    if (latency <= 100) return 0.95;
    if (latency <= 250) return 0.85;
    if (latency <= 500) return 0.7;
    if (latency <= 1000) return 0.5;
    if (latency <= 2000) return 0.3;
    if (latency <= 5000) return 0.1;
    return 0.01;
  }
  
  /**
   * Get normalized cost score (0-1, higher is better = lower cost)
   */
  getCostScore() {
    const cost = this.cost.costPerQuery;
    
    // $0 is excellent (local models), > $0.01 per query is expensive
    if (cost <= 0) return 1.0;
    if (cost <= 0.0001) return 0.95;
    if (cost <= 0.0005) return 0.85;
    if (cost <= 0.001) return 0.7;
    if (cost <= 0.005) return 0.5;
    if (cost <= 0.01) return 0.3;
    if (cost <= 0.05) return 0.1;
    return 0.01;
  }
  
  /**
   * Get normalized robustness score (0-1)
   */
  getRobustnessScore() {
    return (
      0.4 * this.robustness.consistencyScore +
      0.3 * this.robustness.edgeCaseScore +
      0.3 * this.robustness.degradationResistance
    );
  }
  
  toJSON() {
    return {
      correctness: { ...this.correctness },
      speed: { ...this.speed },
      cost: { ...this.cost },
      robustness: { ...this.robustness },
      overall: this.overall,
      paretoRank: this.paretoRank,
    };
  }
}

// ============================================================================
// EVALUATION ENGINE
// ============================================================================

/**
 * Configuration for fitness evaluation
 */
export const DEFAULT_EVAL_CONFIG = {
  // What to evaluate
  evaluateCorrectness: true,
  evaluateSpeed: true,
  evaluateCost: true,
  evaluateRobustness: false, // More expensive
  
  // Correctness evaluation
  metricsK: [5, 10, 20],
  
  // Speed evaluation
  warmupRuns: 1,
  timedRuns: 3,
  
  // Robustness evaluation
  consistencyRuns: 3,
  testQueryTypes: ['factual', 'semantic', 'keyword', 'complex'],
  
  // Fitness weights
  weights: {
    correctnessWeight: 0.5,
    speedWeight: 0.2,
    costWeight: 0.2,
    robustnessWeight: 0.1,
  },
  
  // Environment constraints
  environment: {
    maxLatencyMs: null,      // Reject if exceeds
    maxCostPerQuery: null,   // Reject if exceeds
    minNdcg10: null,         // Reject if below
    availableProviders: ['ollama'], // Which providers are available
  },
};

/**
 * Fitness evaluator
 */
export class FitnessEvaluator {
  constructor(config = {}) {
    this.config = { ...DEFAULT_EVAL_CONFIG, ...config };
    this.embeddingCache = new Map();
    this.costTracker = new Map();
  }
  
  /**
   * Evaluate a genome's fitness
   */
  async evaluate(genome, queries, documents, docEmbeddings = null) {
    const result = new FitnessResult();
    const startTime = Date.now();
    
    // Pre-compute document embeddings if not provided
    if (!docEmbeddings) {
      docEmbeddings = await this.computeDocEmbeddings(genome, documents);
    }
    
    // Evaluate correctness
    if (this.config.evaluateCorrectness) {
      await this.evaluateCorrectness(genome, queries, documents, docEmbeddings, result);
    }
    
    // Evaluate speed
    if (this.config.evaluateSpeed) {
      await this.evaluateSpeed(genome, queries, documents, docEmbeddings, result);
    }
    
    // Evaluate cost
    if (this.config.evaluateCost) {
      this.evaluateCost(genome, queries.length, result);
    }
    
    // Evaluate robustness
    if (this.config.evaluateRobustness) {
      await this.evaluateRobustness(genome, queries, documents, docEmbeddings, result);
    }
    
    // Compute overall fitness
    result.computeOverall(this.config.weights);
    
    // Check environment constraints
    if (!this.checkConstraints(result, genome)) {
      result.overall = 0; // Penalize constraint violations
    }
    
    return result;
  }
  
  /**
   * Evaluate retrieval correctness
   */
  async evaluateCorrectness(genome, queries, documents, docEmbeddings, result) {
    const metrics = {
      ndcg5: [], ndcg10: [], ndcg20: [],
      recall5: [], recall10: [], recall20: [],
      mrr10: [], map10: [], precision5: [],
      hits: 0,
    };
    
    for (const query of queries) {
      const retrieved = await this.runRetrieval(genome, query, documents, docEmbeddings);
      const relevant = new Set(query.relevantDocs || []);
      
      // Calculate metrics
      for (const k of this.config.metricsK) {
        metrics[`ndcg${k}`].push(this.calculateNDCG(retrieved, relevant, k));
        metrics[`recall${k}`].push(this.calculateRecall(retrieved, relevant, k));
      }
      
      metrics.mrr10.push(this.calculateMRR(retrieved, relevant, 10));
      metrics.map10.push(this.calculateMAP(retrieved, relevant, 10));
      metrics.precision5.push(this.calculatePrecision(retrieved, relevant, 5));
      
      if (retrieved.slice(0, 10).some(d => relevant.has(d))) {
        metrics.hits++;
      }
    }
    
    // Average metrics
    result.correctness.ndcg5 = this.average(metrics.ndcg5);
    result.correctness.ndcg10 = this.average(metrics.ndcg10);
    result.correctness.recall5 = this.average(metrics.recall5);
    result.correctness.recall10 = this.average(metrics.recall10);
    result.correctness.mrr10 = this.average(metrics.mrr10);
    result.correctness.map10 = this.average(metrics.map10);
    result.correctness.precision5 = this.average(metrics.precision5);
    result.correctness.hitRate = metrics.hits / queries.length;
  }
  
  /**
   * Evaluate latency/speed
   */
  async evaluateSpeed(genome, queries, documents, docEmbeddings, result) {
    const latencies = [];
    const sampleQueries = queries.slice(0, Math.min(5, queries.length));
    
    // Warmup
    for (let i = 0; i < this.config.warmupRuns; i++) {
      const q = sampleQueries[i % sampleQueries.length];
      await this.runRetrieval(genome, q, documents, docEmbeddings);
    }
    
    // Timed runs
    for (let i = 0; i < this.config.timedRuns; i++) {
      for (const q of sampleQueries) {
        const start = performance.now();
        await this.runRetrieval(genome, q, documents, docEmbeddings);
        latencies.push(performance.now() - start);
      }
    }
    
    latencies.sort((a, b) => a - b);
    
    result.speed.avgLatencyMs = this.average(latencies);
    result.speed.p50LatencyMs = latencies[Math.floor(latencies.length * 0.5)] || 0;
    result.speed.p95LatencyMs = latencies[Math.floor(latencies.length * 0.95)] || 0;
    result.speed.p99LatencyMs = latencies[Math.floor(latencies.length * 0.99)] || 0;
    result.speed.queriesPerSecond = 1000 / result.speed.avgLatencyMs;
  }
  
  /**
   * Evaluate cost
   */
  evaluateCost(genome, queryCount, result) {
    let totalCost = 0;
    
    // Embedding cost
    const embConfig = EMBEDDING_PROVIDERS[genome.genes.primaryEmbedding];
    const embCost = embConfig?.cost || 0;
    totalCost += embCost;
    result.cost.embeddingCost = embCost;
    
    // Secondary embedding cost
    if (genome.genes.secondaryEmbedding) {
      const secEmbConfig = EMBEDDING_PROVIDERS[genome.genes.secondaryEmbedding];
      totalCost += secEmbConfig?.cost || 0;
    }
    
    // Query expansion cost
    const expConfig = QUERY_EXPANDERS[genome.genes.queryExpander];
    const expCost = expConfig?.cost || 0;
    totalCost += expCost;
    result.cost.queryExpansionCost = expCost;
    
    // Reranking cost
    const rerankConfig = RERANKER_MODELS[genome.genes.reranker];
    const rerankCost = rerankConfig?.cost || 0;
    totalCost += rerankCost;
    result.cost.rerankingCost = rerankCost;
    
    result.cost.costPerQuery = totalCost;
    result.cost.totalCost = totalCost * queryCount;
  }
  
  /**
   * Evaluate robustness
   */
  async evaluateRobustness(genome, queries, documents, docEmbeddings, result) {
    // Consistency across multiple runs
    const scores = [];
    for (let i = 0; i < this.config.consistencyRuns; i++) {
      const fitness = new FitnessResult();
      await this.evaluateCorrectness(genome, queries, documents, docEmbeddings, fitness);
      scores.push(fitness.correctness.ndcg10);
    }
    
    const mean = this.average(scores);
    const variance = scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length;
    result.robustness.consistencyScore = 1 - Math.min(1, variance * 10); // Low variance = high consistency
    
    // Query type performance
    const typeScores = {};
    for (const queryType of this.config.testQueryTypes) {
      const typeQueries = queries.filter(q => q.tags?.includes(queryType));
      if (typeQueries.length > 0) {
        const fitness = new FitnessResult();
        await this.evaluateCorrectness(genome, typeQueries, documents, docEmbeddings, fitness);
        typeScores[queryType] = fitness.correctness.ndcg10;
      }
    }
    result.robustness.queryTypeScores = typeScores;
    
    // Edge case handling (queries with many/few relevant docs)
    const hardQueries = queries.filter(q => {
      const numRelevant = q.relevantDocs?.length || 0;
      return numRelevant <= 1 || numRelevant >= 5;
    });
    
    if (hardQueries.length > 0) {
      const fitness = new FitnessResult();
      await this.evaluateCorrectness(genome, hardQueries, documents, docEmbeddings, fitness);
      result.robustness.edgeCaseScore = fitness.correctness.ndcg10;
    }
    
    result.robustness.degradationResistance = 1.0; // Would need load testing
  }
  
  /**
   * Check environment constraints
   */
  checkConstraints(result, genome) {
    const env = this.config.environment;
    
    // Check latency constraint
    if (env.maxLatencyMs && result.speed.avgLatencyMs > env.maxLatencyMs) {
      return false;
    }
    
    // Check cost constraint
    if (env.maxCostPerQuery && result.cost.costPerQuery > env.maxCostPerQuery) {
      return false;
    }
    
    // Check quality constraint
    if (env.minNdcg10 && result.correctness.ndcg10 < env.minNdcg10) {
      return false;
    }
    
    // Check provider availability
    const provider = EMBEDDING_PROVIDERS[genome.genes.primaryEmbedding]?.provider;
    if (provider && !env.availableProviders.includes(provider)) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Run retrieval pipeline for a single query
   */
  async runRetrieval(genome, query, documents, docEmbeddings) {
    // This is a simplified simulation - real implementation would execute the full pipeline
    const queryText = query.query;
    
    // Get query embedding
    const queryEmb = await this.getQueryEmbedding(genome, queryText);
    
    // Score documents
    let scores = [];
    
    for (const doc of documents) {
      const docEmb = docEmbeddings.get(doc.id);
      let score = 0;
      
      // Calculate score based on pipeline
      if (genome.pipeline.includes('embed_retrieve') || genome.pipeline.includes('hybrid_retrieve')) {
        score += genome.genes.hybridAlpha * this.cosineSimilarity(queryEmb, docEmb);
      }
      
      if (genome.pipeline.includes('bm25_retrieve') || genome.pipeline.includes('hybrid_retrieve')) {
        score += (1 - genome.genes.hybridAlpha) * this.bm25Score(queryText, doc.content, genome.genes);
      }
      
      scores.push({ id: doc.id, score, embedding: docEmb });
    }
    
    // Sort by score
    scores.sort((a, b) => b.score - a.score);
    
    // Apply reranking
    if (genome.pipeline.some(s => s.includes('rerank_mmr'))) {
      scores = this.applyMMR(scores, genome.genes.mmrLambda, genome.genes.rerankK);
    }
    
    // Return top-k document IDs
    return scores.slice(0, genome.genes.finalK).map(s => s.id);
  }
  
  /**
   * Compute document embeddings
   */
  async computeDocEmbeddings(genome, documents) {
    const embeddings = new Map();
    
    for (const doc of documents) {
      const cacheKey = `${genome.genes.primaryEmbedding}:${doc.id}`;
      
      if (this.embeddingCache.has(cacheKey)) {
        embeddings.set(doc.id, this.embeddingCache.get(cacheKey));
      } else {
        // Simulate embedding (in real implementation, call the embedding API)
        const emb = await this.simulateEmbedding(doc.content);
        this.embeddingCache.set(cacheKey, emb);
        embeddings.set(doc.id, emb);
      }
    }
    
    return embeddings;
  }
  
  /**
   * Get query embedding
   */
  async getQueryEmbedding(genome, queryText) {
    const cacheKey = `${genome.genes.primaryEmbedding}:query:${queryText}`;
    
    if (this.embeddingCache.has(cacheKey)) {
      return this.embeddingCache.get(cacheKey);
    }
    
    const emb = await this.simulateEmbedding(queryText);
    this.embeddingCache.set(cacheKey, emb);
    return emb;
  }
  
  /**
   * Simulate embedding (for testing without real API calls)
   */
  async simulateEmbedding(text) {
    // Generate deterministic pseudo-embedding based on text
    const dims = 768;
    const embedding = new Array(dims);
    
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash = hash & hash;
    }
    
    const random = (seed) => {
      const x = Math.sin(seed) * 10000;
      return x - Math.floor(x);
    };
    
    for (let i = 0; i < dims; i++) {
      embedding[i] = random(hash + i) * 2 - 1;
    }
    
    // Normalize
    const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    for (let i = 0; i < dims; i++) {
      embedding[i] /= norm;
    }
    
    return embedding;
  }
  
  // ========== Metric Calculations ==========
  
  cosineSimilarity(a, b) {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }
  
  bm25Score(query, doc, genes) {
    const k1 = genes.bm25K1;
    const b = genes.bm25B;
    const queryTerms = query.toLowerCase().split(/\s+/);
    const docTerms = doc.toLowerCase().split(/\s+/);
    const avgDocLen = 100;
    
    let score = 0;
    for (const term of queryTerms) {
      const tf = docTerms.filter(t => t === term).length;
      const idf = Math.log((10 + 1) / (1 + 1));
      const tfNorm = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * docTerms.length / avgDocLen));
      score += idf * tfNorm;
    }
    
    return score / 10; // Normalize to similar range as cosine
  }
  
  applyMMR(scores, lambda, k) {
    const selected = [];
    const candidates = [...scores];
    
    while (selected.length < k && candidates.length > 0) {
      let bestIdx = 0;
      let bestScore = -Infinity;
      
      for (let i = 0; i < candidates.length; i++) {
        const relevance = candidates[i].score;
        let maxSim = 0;
        
        for (const sel of selected) {
          const sim = this.cosineSimilarity(candidates[i].embedding, sel.embedding);
          maxSim = Math.max(maxSim, sim);
        }
        
        const mmrScore = lambda * relevance - (1 - lambda) * maxSim;
        if (mmrScore > bestScore) {
          bestScore = mmrScore;
          bestIdx = i;
        }
      }
      
      selected.push(candidates[bestIdx]);
      candidates.splice(bestIdx, 1);
    }
    
    return selected;
  }
  
  calculateNDCG(retrieved, relevant, k) {
    const dcg = retrieved.slice(0, k).reduce((sum, docId, i) => {
      const rel = relevant.has(docId) ? 1 : 0;
      return sum + rel / Math.log2(i + 2);
    }, 0);
    
    const ideal = Array.from(relevant).slice(0, k);
    const idcg = ideal.reduce((sum, _, i) => sum + 1 / Math.log2(i + 2), 0);
    
    return idcg > 0 ? dcg / idcg : 0;
  }
  
  calculateRecall(retrieved, relevant, k) {
    const found = retrieved.slice(0, k).filter(d => relevant.has(d)).length;
    return relevant.size > 0 ? found / relevant.size : 0;
  }
  
  calculateMRR(retrieved, relevant, k) {
    for (let i = 0; i < Math.min(retrieved.length, k); i++) {
      if (relevant.has(retrieved[i])) {
        return 1 / (i + 1);
      }
    }
    return 0;
  }
  
  calculateMAP(retrieved, relevant, k) {
    let precisionSum = 0;
    let relevantFound = 0;
    
    for (let i = 0; i < Math.min(retrieved.length, k); i++) {
      if (relevant.has(retrieved[i])) {
        relevantFound++;
        precisionSum += relevantFound / (i + 1);
      }
    }
    
    return relevant.size > 0 ? precisionSum / relevant.size : 0;
  }
  
  calculatePrecision(retrieved, relevant, k) {
    const found = retrieved.slice(0, k).filter(d => relevant.has(d)).length;
    return found / k;
  }
  
  average(arr) {
    return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  }
}

export default { FitnessResult, FitnessEvaluator, DEFAULT_EVAL_CONFIG };

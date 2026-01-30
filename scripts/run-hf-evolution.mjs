#!/usr/bin/env node
/**
 * HuggingFace Dataset Evolution
 * 
 * Uses real MTEB benchmark datasets from HuggingFace to evolve
 * embedding retrieval strategies with Gemini API and Ollama.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { spawn } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  populationSize: parseInt(process.env.POPULATION_SIZE || '12'),
  generations: parseInt(process.env.GENERATIONS || '8'),
  eliteCount: 3,
  mutationRate: 0.35,
  crossoverRate: 0.7,
  stagnationLimit: 4,
  maxSamplesPerDataset: 100, // Limit samples for faster evolution
};

// ============================================================================
// EMBEDDING PROVIDERS
// ============================================================================

const EMBEDDING_PROVIDERS = {
  // Ollama local models
  'ollama/nomic-embed-text': {
    id: 'ollama/nomic-embed-text',
    name: 'Nomic Embed',
    provider: 'ollama',
    model: 'nomic-embed-text',
    dimensions: 768,
    cost: 0,
    local: true,
  },
  'ollama/mxbai-embed-large': {
    id: 'ollama/mxbai-embed-large',
    name: 'MxBai Large',
    provider: 'ollama',
    model: 'mxbai-embed-large',
    dimensions: 1024,
    cost: 0,
    local: true,
  },
  'ollama/all-minilm': {
    id: 'ollama/all-minilm',
    name: 'All-MiniLM',
    provider: 'ollama',
    model: 'all-minilm',
    dimensions: 384,
    cost: 0,
    local: true,
  },
  'ollama/snowflake-arctic-embed': {
    id: 'ollama/snowflake-arctic-embed',
    name: 'Snowflake Arctic',
    provider: 'ollama',
    model: 'snowflake-arctic-embed',
    dimensions: 1024,
    cost: 0,
    local: true,
  },
  
  // Gemini
  'gemini/embedding-001': {
    id: 'gemini/embedding-001',
    name: 'Gemini Embedding',
    provider: 'gemini',
    model: 'embedding-001',
    dimensions: 768,
    cost: 0.00001,
    local: false,
  },
  'gemini/text-embedding-004': {
    id: 'gemini/text-embedding-004',
    name: 'Gemini Text Embedding 004',
    provider: 'gemini',
    model: 'text-embedding-004',
    dimensions: 768,
    cost: 0.00001,
    local: false,
  },
};

// ============================================================================
// RETRIEVAL STRATEGIES (Genes)
// ============================================================================

const RETRIEVAL_METHODS = {
  VECTOR_COSINE: { id: 'vector_cosine', name: 'Vector Cosine', type: 'dense' },
  VECTOR_DOT: { id: 'vector_dot', name: 'Vector Dot', type: 'dense' },
  BM25: { id: 'bm25', name: 'BM25', type: 'sparse' },
  HYBRID_LINEAR: { id: 'hybrid_linear', name: 'Hybrid Linear', type: 'hybrid', weights: [0.7, 0.3] },
  HYBRID_RRF: { id: 'hybrid_rrf', name: 'Hybrid RRF', type: 'hybrid', k: 60 },
};

const QUERY_PROCESSORS = {
  RAW: { id: 'raw', name: 'Raw', boost: 0 },
  LOWERCASE: { id: 'lowercase', name: 'Lowercase', boost: 0.02 },
  EXPANDED: { id: 'expanded', name: 'Query Expansion', boost: 0.08 },
};

const RERANKERS = {
  NONE: { id: 'none', name: 'None', boost: 0 },
  MMR: { id: 'mmr', name: 'MMR Diversity', boost: 0.05, lambda: 0.5 },
  SCORE_THRESHOLD: { id: 'threshold', name: 'Score Threshold', boost: 0.02 },
};

// ============================================================================
// DATASETS
// ============================================================================

const DATASETS = {
  'mteb-sts17': {
    id: 'mteb-sts17',
    name: 'MTEB STS17',
    description: 'Semantic Textual Similarity benchmark',
    hfDataset: 'mteb/sts17-crosslingual-sts',
    config: 'en-en',
    split: 'test',
    type: 'similarity',
  },
  'squad': {
    id: 'squad',
    name: 'SQuAD',
    description: 'Stanford Question Answering Dataset',
    hfDataset: 'squad',
    split: 'validation',
    type: 'qa',
  },
  'quora': {
    id: 'quora',
    name: 'Quora Pairs',
    description: 'Duplicate question detection',
    hfDataset: 'quora',
    split: 'train',
    type: 'duplicate',
  },
  'scifact': {
    id: 'scifact',
    name: 'SciFact',
    description: 'Scientific fact verification',
    hfDataset: 'mteb/scifact',
    split: 'test',
    type: 'retrieval',
  },
};

// ============================================================================
// GENOME DEFINITION
// ============================================================================

class EmbeddingGenome {
  constructor(config = {}) {
    this.id = config.id || crypto.randomUUID();
    this.generation = config.generation || 0;
    this.parentIds = config.parentIds || [];
    
    this.genes = {
      embeddingModel: config.genes?.embeddingModel || 'ollama/nomic-embed-text',
      retrievalMethod: config.genes?.retrievalMethod || 'VECTOR_COSINE',
      queryProcessor: config.genes?.queryProcessor || 'RAW',
      reranker: config.genes?.reranker || 'NONE',
      topK: config.genes?.topK || 10,
      hybridAlpha: config.genes?.hybridAlpha || 0.7,
      scoreThreshold: config.genes?.scoreThreshold || 0,
    };
    
    this.fitness = config.fitness || null;
  }
  
  getName() {
    const emb = EMBEDDING_PROVIDERS[this.genes.embeddingModel];
    const parts = [emb?.name || this.genes.embeddingModel];
    
    if (this.genes.queryProcessor !== 'RAW') {
      parts.push(QUERY_PROCESSORS[this.genes.queryProcessor]?.name);
    }
    parts.push(RETRIEVAL_METHODS[this.genes.retrievalMethod]?.name);
    if (this.genes.reranker !== 'NONE') {
      parts.push('→ ' + RERANKERS[this.genes.reranker]?.name);
    }
    parts.push(`k${this.genes.topK}`);
    
    return parts.filter(Boolean).join(' | ');
  }
  
  getShortName() {
    const parts = [];
    const emb = EMBEDDING_PROVIDERS[this.genes.embeddingModel];
    parts.push(emb?.model || this.genes.embeddingModel);
    parts.push(this.genes.retrievalMethod.toLowerCase());
    if (this.genes.queryProcessor !== 'RAW') parts.push(this.genes.queryProcessor.toLowerCase());
    if (this.genes.reranker !== 'NONE') parts.push(this.genes.reranker.toLowerCase());
    parts.push(`k${this.genes.topK}`);
    return parts.join('-');
  }
  
  clone() {
    return new EmbeddingGenome({
      ...this.toJSON(),
      id: crypto.randomUUID(),
      parentIds: [this.id],
      fitness: null,
    });
  }
  
  toJSON() {
    return {
      id: this.id,
      generation: this.generation,
      parentIds: this.parentIds,
      genes: { ...this.genes },
      fitness: this.fitness,
    };
  }
}

// ============================================================================
// EMBEDDING FUNCTIONS
// ============================================================================

const embeddingCache = new Map();

async function getOllamaEmbedding(text, model) {
  const cacheKey = `ollama:${model}:${text}`;
  if (embeddingCache.has(cacheKey)) {
    return embeddingCache.get(cacheKey);
  }
  
  try {
    const response = await fetch('http://localhost:11434/api/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt: text }),
    });
    
    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status}`);
    }
    
    const data = await response.json();
    const embedding = data.embedding;
    embeddingCache.set(cacheKey, embedding);
    return embedding;
  } catch (error) {
    console.error(`  ⚠️ Ollama embedding failed: ${error.message}`);
    // Return zero vector as fallback
    return new Array(768).fill(0);
  }
}

async function getGeminiEmbedding(text, model) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('  ⚠️ GEMINI_API_KEY not set');
    return new Array(768).fill(0);
  }
  
  const cacheKey = `gemini:${model}:${text}`;
  if (embeddingCache.has(cacheKey)) {
    return embeddingCache.get(cacheKey);
  }
  
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: `models/${model}`,
          content: { parts: [{ text }] },
        }),
      }
    );
    
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini error: ${response.status} - ${err}`);
    }
    
    const data = await response.json();
    const embedding = data.embedding?.values || [];
    embeddingCache.set(cacheKey, embedding);
    return embedding;
  } catch (error) {
    console.error(`  ⚠️ Gemini embedding failed: ${error.message}`);
    return new Array(768).fill(0);
  }
}

async function getEmbedding(text, modelId) {
  const provider = EMBEDDING_PROVIDERS[modelId];
  if (!provider) {
    console.error(`Unknown model: ${modelId}`);
    return new Array(768).fill(0);
  }
  
  if (provider.provider === 'ollama') {
    return getOllamaEmbedding(text, provider.model);
  } else if (provider.provider === 'gemini') {
    return getGeminiEmbedding(text, provider.model);
  }
  
  return new Array(768).fill(0);
}

// ============================================================================
// SCORING FUNCTIONS
// ============================================================================

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function dotProduct(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  return a.reduce((sum, ai, i) => sum + ai * b[i], 0);
}

function bm25Score(query, document, k1 = 1.2, b = 0.75) {
  const queryTerms = query.toLowerCase().split(/\s+/);
  const docTerms = document.toLowerCase().split(/\s+/);
  const avgDocLen = 100; // Assume average
  const docLen = docTerms.length;
  
  let score = 0;
  for (const term of queryTerms) {
    const tf = docTerms.filter(t => t === term).length;
    const idf = Math.log(1 + 1); // Simplified IDF
    const tfNorm = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (docLen / avgDocLen)));
    score += idf * tfNorm;
  }
  return score;
}

// ============================================================================
// DATASET LOADING
// ============================================================================

async function loadLocalDataset(datasetId) {
  const datasetsDir = path.join(__dirname, '../datasets');
  
  const pathMap = {
    'retrieval-benchmark': { queries: 'retrieval-benchmark/queries.jsonl', corpus: 'retrieval-benchmark/corpus.jsonl' },
    'hard-negatives': { queries: 'hard-negatives/queries.jsonl', corpus: 'hard-negatives/corpus.jsonl' },
    'mteb-sts17': { queries: 'mteb-sts17/queries.jsonl', corpus: 'mteb-sts17/corpus.jsonl' },
    'squad': { queries: 'squad/queries.jsonl', corpus: 'squad/corpus.jsonl' },
    'quora': { queries: 'quora/queries.jsonl', corpus: 'quora/corpus.jsonl' },
    'sample': { queries: 'sample/queries.jsonl', corpus: 'sample/corpus.jsonl' },
  };
  
  const paths = pathMap[datasetId];
  if (!paths) {
    console.log(`  Dataset ${datasetId} not found locally, using retrieval-benchmark`);
    return loadLocalDataset('retrieval-benchmark');
  }
  
  try {
    const queriesPath = path.join(datasetsDir, paths.queries);
    const corpusPath = path.join(datasetsDir, paths.corpus);
    
    const queriesData = await fs.readFile(queriesPath, 'utf-8');
    const corpusData = await fs.readFile(corpusPath, 'utf-8');
    
    const queries = queriesData.trim().split('\n').map(l => JSON.parse(l));
    const corpus = corpusData.trim().split('\n').map(l => JSON.parse(l));
    
    return { queries: queries.slice(0, CONFIG.maxSamplesPerDataset), corpus };
  } catch (error) {
    console.log(`  Error loading ${datasetId}: ${error.message}`);
    return null;
  }
}

async function downloadDatasets() {
  console.log('📥 Checking/downloading HuggingFace datasets...\n');
  
  const datasetsDir = path.join(__dirname, '../datasets');
  
  // Check if we need to download
  try {
    await fs.access(path.join(datasetsDir, 'sample/queries.jsonl'));
    console.log('  ✓ Datasets already downloaded\n');
    return true;
  } catch {
    // Need to download
  }
  
  // Run Python download script
  return new Promise((resolve) => {
    const pythonScript = path.join(__dirname, 'download-hf-datasets.py');
    const proc = spawn('python3', [pythonScript], {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit',
    });
    
    proc.on('close', (code) => {
      if (code === 0) {
        console.log('  ✓ Datasets downloaded\n');
        resolve(true);
      } else {
        console.log('  ⚠️ Dataset download had issues, using embedded sample\n');
        resolve(false);
      }
    });
    
    proc.on('error', () => {
      console.log('  ⚠️ Python not available, using embedded sample\n');
      resolve(false);
    });
  });
}

// Create embedded sample dataset if nothing else works
async function ensureSampleDataset() {
  const sampleDir = path.join(__dirname, '../datasets/sample');
  
  try {
    await fs.access(path.join(sampleDir, 'queries.jsonl'));
    return;
  } catch {
    // Create it
  }
  
  await fs.mkdir(sampleDir, { recursive: true });
  
  const queries = [
    { id: 'q1', query: 'What is machine learning?', relevantDocs: ['d1', 'd2'], tags: ['technical'] },
    { id: 'q2', query: 'How to make sourdough bread?', relevantDocs: ['d3'], tags: ['cooking'] },
    { id: 'q3', query: 'Best Python web frameworks', relevantDocs: ['d4', 'd5'], tags: ['programming'] },
    { id: 'q4', query: 'Climate change effects on ecosystems', relevantDocs: ['d6'], tags: ['science'] },
    { id: 'q5', query: 'Introduction to quantum computing basics', relevantDocs: ['d7', 'd8'], tags: ['technical'] },
    { id: 'q6', query: 'neural network architecture', relevantDocs: ['d1', 'd2'], tags: ['technical'] },
    { id: 'q7', query: 'fermentation process for bread', relevantDocs: ['d3'], tags: ['cooking'] },
    { id: 'q8', query: 'Django vs Flask comparison', relevantDocs: ['d4', 'd5'], tags: ['programming'] },
    { id: 'q9', query: 'global warming impacts', relevantDocs: ['d6'], tags: ['science'] },
    { id: 'q10', query: 'qubits and superposition', relevantDocs: ['d7', 'd8'], tags: ['technical'] },
  ];
  
  const corpus = [
    { id: 'd1', content: 'Machine learning is a subset of artificial intelligence that enables computers to learn from data. It uses algorithms to find patterns and make predictions without explicit programming.', metadata: { category: 'ai' } },
    { id: 'd2', content: 'Deep learning is a type of machine learning using neural networks with multiple layers. These networks can learn hierarchical representations of data for complex tasks.', metadata: { category: 'ai' } },
    { id: 'd3', content: 'Sourdough bread uses natural fermentation with wild yeast and bacteria. The starter culture gives the bread its distinctive tangy flavor and improved digestibility.', metadata: { category: 'cooking' } },
    { id: 'd4', content: 'Django is a high-level Python web framework that encourages rapid development. It includes an ORM, admin interface, and follows the model-view-template pattern.', metadata: { category: 'programming' } },
    { id: 'd5', content: 'Flask is a lightweight Python web framework designed for simplicity. It provides the basics needed for web applications while allowing flexibility in architecture choices.', metadata: { category: 'programming' } },
    { id: 'd6', content: 'Climate change causes rising temperatures, melting ice caps, and extreme weather events. Ecosystems worldwide are affected by shifting habitats and biodiversity loss.', metadata: { category: 'science' } },
    { id: 'd7', content: 'Quantum computing uses quantum bits or qubits that can exist in superposition. This allows quantum computers to process many calculations simultaneously.', metadata: { category: 'physics' } },
    { id: 'd8', content: 'Quantum mechanics describes particle behavior at atomic scales. Concepts like entanglement and wave-particle duality are fundamental to quantum computing.', metadata: { category: 'physics' } },
  ];
  
  await fs.writeFile(
    path.join(sampleDir, 'queries.jsonl'),
    queries.map(q => JSON.stringify(q)).join('\n')
  );
  await fs.writeFile(
    path.join(sampleDir, 'corpus.jsonl'),
    corpus.map(d => JSON.stringify(d)).join('\n')
  );
  
  console.log('  ✓ Created sample dataset\n');
}

// ============================================================================
// EVALUATION
// ============================================================================

async function evaluateGenome(genome, dataset) {
  const { queries, corpus } = dataset;
  const corpusMap = new Map(corpus.map(d => [d.id, d]));
  
  const results = {
    ndcg10: 0,
    recall10: 0,
    mrr10: 0,
    hitRate: 0,
    latencyMs: 0,
  };
  
  let totalNdcg = 0;
  let totalRecall = 0;
  let totalMrr = 0;
  let totalHits = 0;
  let totalLatency = 0;
  
  const modelId = genome.genes.embeddingModel;
  const topK = genome.genes.topK;
  
  // Pre-embed corpus
  process.stdout.write(`    Embedding corpus...`);
  const corpusEmbeddings = new Map();
  for (const doc of corpus) {
    corpusEmbeddings.set(doc.id, await getEmbedding(doc.content, modelId));
  }
  process.stdout.write(` done\n`);
  
  for (let i = 0; i < queries.length; i++) {
    const query = queries[i];
    const startTime = Date.now();
    
    // Process query
    let queryText = query.query;
    if (genome.genes.queryProcessor === 'LOWERCASE') {
      queryText = queryText.toLowerCase();
    } else if (genome.genes.queryProcessor === 'EXPANDED') {
      // Simple expansion: add synonyms
      queryText = `${queryText} ${queryText.split(' ').slice(0, 3).join(' ')}`;
    }
    
    // Get query embedding
    const queryEmb = await getEmbedding(queryText, modelId);
    
    // Score all documents
    const scores = [];
    for (const doc of corpus) {
      const docEmb = corpusEmbeddings.get(doc.id);
      let score = 0;
      
      const method = genome.genes.retrievalMethod;
      if (method === 'VECTOR_COSINE') {
        score = cosineSimilarity(queryEmb, docEmb);
      } else if (method === 'VECTOR_DOT') {
        score = dotProduct(queryEmb, docEmb);
      } else if (method === 'BM25') {
        score = bm25Score(query.query, doc.content);
      } else if (method === 'HYBRID_LINEAR' || method === 'HYBRID_RRF') {
        const vecScore = cosineSimilarity(queryEmb, docEmb);
        const bm25 = bm25Score(query.query, doc.content) / 10; // Normalize
        score = genome.genes.hybridAlpha * vecScore + (1 - genome.genes.hybridAlpha) * bm25;
      }
      
      scores.push({ docId: doc.id, score });
    }
    
    // Sort and get top-K
    scores.sort((a, b) => b.score - a.score);
    
    // Apply reranking
    if (genome.genes.reranker === 'MMR') {
      // Simple MMR: penalize similarity to already selected docs
      const reranked = [scores[0]];
      const remaining = scores.slice(1);
      
      while (reranked.length < topK && remaining.length > 0) {
        let bestIdx = 0;
        let bestScore = -Infinity;
        
        for (let j = 0; j < remaining.length; j++) {
          const cand = remaining[j];
          // Simplified MMR
          const diversityPenalty = reranked.reduce((max, sel) => {
            const selEmb = corpusEmbeddings.get(sel.docId);
            const candEmb = corpusEmbeddings.get(cand.docId);
            return Math.max(max, cosineSimilarity(selEmb, candEmb));
          }, 0);
          
          const lambda = 0.5;
          const mmrScore = lambda * cand.score - (1 - lambda) * diversityPenalty;
          if (mmrScore > bestScore) {
            bestScore = mmrScore;
            bestIdx = j;
          }
        }
        
        reranked.push(remaining[bestIdx]);
        remaining.splice(bestIdx, 1);
      }
      
      scores.splice(0, scores.length, ...reranked);
    } else if (genome.genes.reranker === 'SCORE_THRESHOLD') {
      const threshold = genome.genes.scoreThreshold || 0.3;
      const filtered = scores.filter(s => s.score >= threshold);
      if (filtered.length > 0) {
        scores.splice(0, scores.length, ...filtered);
      }
    }
    
    const retrievedIds = scores.slice(0, topK).map(s => s.docId);
    const relevantIds = new Set(query.relevantDocs || []);
    
    // Calculate metrics
    const endTime = Date.now();
    totalLatency += endTime - startTime;
    
    // NDCG@10
    let dcg = 0;
    for (let j = 0; j < Math.min(topK, retrievedIds.length); j++) {
      if (relevantIds.has(retrievedIds[j])) {
        dcg += 1 / Math.log2(j + 2);
      }
    }
    const idealDcg = [...relevantIds].slice(0, topK).reduce((sum, _, j) => sum + 1 / Math.log2(j + 2), 0);
    totalNdcg += idealDcg > 0 ? dcg / idealDcg : 0;
    
    // Recall@10
    const retrieved = retrievedIds.filter(id => relevantIds.has(id)).length;
    totalRecall += relevantIds.size > 0 ? retrieved / relevantIds.size : 0;
    
    // MRR@10
    const firstRelevant = retrievedIds.findIndex(id => relevantIds.has(id));
    totalMrr += firstRelevant >= 0 ? 1 / (firstRelevant + 1) : 0;
    
    // Hit Rate
    totalHits += retrieved > 0 ? 1 : 0;
  }
  
  const n = queries.length;
  results.ndcg10 = totalNdcg / n;
  results.recall10 = totalRecall / n;
  results.mrr10 = totalMrr / n;
  results.hitRate = totalHits / n;
  results.latencyMs = totalLatency / n;
  
  // Calculate overall fitness
  const provider = EMBEDDING_PROVIDERS[modelId];
  const costPerQuery = provider?.cost || 0;
  
  const correctnessScore = 0.5 * results.ndcg10 + 0.3 * results.recall10 + 0.2 * results.mrr10;
  const speedScore = 1 / (1 + results.latencyMs / 100);
  const costScore = 1 / (1 + costPerQuery * 1000);
  
  results.fitness = 0.7 * correctnessScore + 0.2 * speedScore + 0.1 * costScore;
  results.costPerQuery = costPerQuery;
  
  return results;
}

// ============================================================================
// GENETIC OPERATORS
// ============================================================================

function createRandomGenome(generation = 0, availableModels) {
  const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];
  
  return new EmbeddingGenome({
    generation,
    genes: {
      embeddingModel: pickRandom(availableModels),
      retrievalMethod: pickRandom(Object.keys(RETRIEVAL_METHODS)),
      queryProcessor: pickRandom(Object.keys(QUERY_PROCESSORS)),
      reranker: pickRandom(Object.keys(RERANKERS)),
      topK: pickRandom([5, 10, 20]),
      hybridAlpha: 0.5 + Math.random() * 0.4,
      scoreThreshold: Math.random() < 0.3 ? 0.3 + Math.random() * 0.3 : 0,
    },
  });
}

function createBaselines(availableModels) {
  const baselines = [];
  
  // Simple vector search with each model
  for (const model of availableModels.slice(0, 3)) {
    baselines.push(new EmbeddingGenome({
      genes: { embeddingModel: model, retrievalMethod: 'VECTOR_COSINE', queryProcessor: 'RAW', reranker: 'NONE', topK: 10 },
    }));
  }
  
  // BM25 baseline
  baselines.push(new EmbeddingGenome({
    genes: { embeddingModel: availableModels[0], retrievalMethod: 'BM25', queryProcessor: 'RAW', reranker: 'NONE', topK: 10 },
  }));
  
  // Hybrid baselines
  baselines.push(new EmbeddingGenome({
    genes: { embeddingModel: availableModels[0], retrievalMethod: 'HYBRID_LINEAR', queryProcessor: 'RAW', reranker: 'NONE', topK: 10, hybridAlpha: 0.7 },
  }));
  baselines.push(new EmbeddingGenome({
    genes: { embeddingModel: availableModels[0], retrievalMethod: 'HYBRID_RRF', queryProcessor: 'RAW', reranker: 'NONE', topK: 10 },
  }));
  
  return baselines;
}

function mutate(genome, rate, availableModels) {
  const child = genome.clone();
  child.generation = genome.generation + 1;
  
  const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];
  
  if (Math.random() < rate) {
    child.genes.embeddingModel = pickRandom(availableModels);
  }
  if (Math.random() < rate) {
    child.genes.retrievalMethod = pickRandom(Object.keys(RETRIEVAL_METHODS));
  }
  if (Math.random() < rate) {
    child.genes.queryProcessor = pickRandom(Object.keys(QUERY_PROCESSORS));
  }
  if (Math.random() < rate) {
    child.genes.reranker = pickRandom(Object.keys(RERANKERS));
  }
  if (Math.random() < rate * 0.5) {
    child.genes.topK = pickRandom([5, 10, 20]);
  }
  if (Math.random() < rate * 0.5) {
    child.genes.hybridAlpha = 0.5 + Math.random() * 0.4;
  }
  
  return child;
}

function crossover(p1, p2) {
  const child = new EmbeddingGenome({
    generation: Math.max(p1.generation, p2.generation) + 1,
    parentIds: [p1.id, p2.id],
    genes: {},
  });
  
  for (const key of Object.keys(p1.genes)) {
    child.genes[key] = Math.random() < 0.5 ? p1.genes[key] : p2.genes[key];
  }
  
  return child;
}

function tournamentSelect(population, size = 3) {
  const tournament = [];
  for (let i = 0; i < size; i++) {
    tournament.push(population[Math.floor(Math.random() * population.length)]);
  }
  tournament.sort((a, b) => (b.fitness?.fitness || 0) - (a.fitness?.fitness || 0));
  return tournament[0];
}

// ============================================================================
// PREFLIGHT CHECKS
// ============================================================================

async function checkOllama() {
  try {
    const response = await fetch('http://localhost:11434/api/tags');
    if (!response.ok) return { available: false, models: [] };
    const data = await response.json();
    const models = data.models?.map(m => m.name.split(':')[0]) || [];
    return { available: true, models };
  } catch {
    return { available: false, models: [] };
  }
}

async function preflight() {
  console.log('🔍 Preflight checks...\n');
  
  const availableModels = [];
  
  // Check Ollama
  const ollama = await checkOllama();
  if (ollama.available) {
    console.log('  ✓ Ollama is running');
    
    // Check which embedding models are available
    const ollamaEmbedModels = ['nomic-embed-text', 'mxbai-embed-large', 'all-minilm', 'snowflake-arctic-embed'];
    for (const model of ollamaEmbedModels) {
      if (ollama.models.some(m => m.includes(model) || m === model)) {
        availableModels.push(`ollama/${model}`);
        console.log(`    ✓ ${model}`);
      } else {
        console.log(`    ⚠️ ${model} not installed (run: ollama pull ${model})`);
      }
    }
  } else {
    console.log('  ⚠️ Ollama not running (start with: ollama serve)');
  }
  
  // Check Gemini
  if (process.env.GEMINI_API_KEY) {
    console.log('  ✓ GEMINI_API_KEY set');
    availableModels.push('gemini/embedding-001');
    availableModels.push('gemini/text-embedding-004');
  } else {
    console.log('  ⚠️ GEMINI_API_KEY not set (export GEMINI_API_KEY=your_key)');
  }
  
  if (availableModels.length === 0) {
    console.error('\n❌ No embedding models available!');
    console.error('Please either:');
    console.error('  1. Start Ollama and pull a model: ollama pull nomic-embed-text');
    console.error('  2. Set GEMINI_API_KEY environment variable');
    process.exit(1);
  }
  
  console.log(`\n  📊 ${availableModels.length} embedding models available\n`);
  return availableModels;
}

// ============================================================================
// REPORT GENERATION
// ============================================================================

async function generateReport(result, options) {
  const outputDir = options.outputDir || path.join(__dirname, '../docs');
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>EmbedEval - HuggingFace Dataset Evolution</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    :root { --primary: #6366f1; --secondary: #8b5cf6; --success: #22c55e; --bg: #0f172a; --bg-card: #1e293b; --text: #e2e8f0; --text-muted: #94a3b8; --border: #334155; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, sans-serif; background: var(--bg); color: var(--text); line-height: 1.6; padding: 2rem; }
    .container { max-width: 1400px; margin: 0 auto; }
    header { text-align: center; margin-bottom: 2rem; }
    header nav { margin-bottom: 1rem; display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; }
    header nav a { color: var(--text-muted); text-decoration: none; font-size: 0.9rem; }
    h1 { font-size: 2.5rem; background: linear-gradient(135deg, var(--primary), var(--secondary)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .subtitle { color: var(--text-muted); }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; margin-bottom: 2rem; }
    .card { background: var(--bg-card); border-radius: 12px; padding: 1.5rem; border: 1px solid var(--border); }
    .card h2 { color: var(--text-muted); font-size: 0.85rem; text-transform: uppercase; margin-bottom: 1rem; }
    .metric { font-size: 2rem; font-weight: 700; color: var(--primary); }
    .best { background: linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.1)); border-color: var(--primary); }
    .strategy-name { font-size: 1rem; color: var(--primary); margin-bottom: 0.5rem; }
    .gene { display: inline-block; background: var(--bg); padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.8rem; margin: 0.2rem; }
    .chart-container { height: 300px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 0.75rem; text-align: left; border-bottom: 1px solid var(--border); }
    th { color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase; }
    .rank-1 { color: #fbbf24; } .rank-2 { color: #9ca3af; } .rank-3 { color: #b45309; }
    .bar { height: 8px; background: var(--border); border-radius: 4px; overflow: hidden; }
    .bar-fill { height: 100%; background: var(--primary); }
    .info { background: rgba(99, 102, 241, 0.1); border-left: 4px solid var(--primary); padding: 1rem; margin: 1rem 0; border-radius: 0 8px 8px 0; }
    footer { text-align: center; padding: 2rem; color: var(--text-muted); border-top: 1px solid var(--border); margin-top: 2rem; }
    footer a { color: var(--primary); text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <nav>
        <a href="landing.html">🏠 Home</a>
        <a href="index.html">📊 Meta-Evaluation</a>
        <a href="https://github.com/Algiras/embedeval">📂 GitHub</a>
      </nav>
      <h1>🧬 HuggingFace Evolution Results</h1>
      <p class="subtitle">Real Embedding Evaluation with MTEB Datasets</p>
      <p class="subtitle" style="margin-top: 0.5rem; font-size: 0.9rem;">
        ${result.history.length} generations | ${result.modelsUsed.length} embedding models | ${result.dataset} dataset
      </p>
    </header>

    <div class="info">
      <strong>📊 Dataset:</strong> ${result.dataset} | 
      <strong>🔢 Queries:</strong> ${result.queryCount} | 
      <strong>📄 Documents:</strong> ${result.docCount} |
      <strong>🤖 Models:</strong> ${result.modelsUsed.join(', ')}
    </div>

    <div class="grid">
      <div class="card best">
        <h2>🏆 Best Strategy</h2>
        <div class="strategy-name">${result.best.getName()}</div>
        <div style="margin: 1rem 0;">
          <span class="metric">${(result.best.fitness?.fitness * 100 || 0).toFixed(1)}%</span>
          <span style="color: var(--text-muted);">fitness</span>
        </div>
        <div>
          <span class="gene">🤖 ${result.best.genes.embeddingModel}</span>
          <span class="gene">🔍 ${result.best.genes.retrievalMethod}</span>
          <span class="gene">📝 ${result.best.genes.queryProcessor}</span>
          <span class="gene">🎯 ${result.best.genes.reranker}</span>
        </div>
        <div style="margin-top: 1rem; font-size: 0.9rem; color: var(--text-muted);">
          NDCG@10: ${(result.best.fitness?.ndcg10 * 100 || 0).toFixed(1)}% |
          Recall@10: ${(result.best.fitness?.recall10 * 100 || 0).toFixed(1)}% |
          MRR: ${(result.best.fitness?.mrr10 * 100 || 0).toFixed(1)}% |
          Latency: ${result.best.fitness?.latencyMs?.toFixed(0) || 0}ms
        </div>
      </div>
      
      <div class="card">
        <h2>Evolution Progress</h2>
        <div class="chart-container"><canvas id="evolutionChart"></canvas></div>
      </div>
    </div>

    <div class="grid">
      <div class="card">
        <h2>Model Performance Comparison</h2>
        <div class="chart-container"><canvas id="modelChart"></canvas></div>
      </div>
      <div class="card">
        <h2>Retrieval Method Comparison</h2>
        <div class="chart-container"><canvas id="methodChart"></canvas></div>
      </div>
    </div>

    <div class="card" style="margin-top: 2rem;">
      <h2>All Strategies Ranked</h2>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Strategy</th>
            <th>Model</th>
            <th>Fitness</th>
            <th>NDCG@10</th>
            <th>Recall@10</th>
            <th>Latency</th>
          </tr>
        </thead>
        <tbody>
          ${result.population.slice(0, 12).map((g, i) => `
          <tr>
            <td class="${i < 3 ? `rank-${i+1}` : ''}">#${i+1}</td>
            <td style="font-size: 0.85rem;">${g.genes.retrievalMethod} | ${g.genes.queryProcessor} | ${g.genes.reranker}</td>
            <td style="font-size: 0.8rem; color: var(--text-muted);">${g.genes.embeddingModel.split('/')[1] || g.genes.embeddingModel}</td>
            <td>
              <div class="bar" style="width: 80px;"><div class="bar-fill" style="width: ${(g.fitness?.fitness || 0) * 100}%;"></div></div>
              ${(g.fitness?.fitness * 100 || 0).toFixed(1)}%
            </td>
            <td>${(g.fitness?.ndcg10 * 100 || 0).toFixed(1)}%</td>
            <td>${(g.fitness?.recall10 * 100 || 0).toFixed(1)}%</td>
            <td>${g.fitness?.latencyMs?.toFixed(0) || 0}ms</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>

    <footer>
      <p>Generated by EmbedEval - Self-Evolving Embedding Researcher</p>
      <p><a href="landing.html">Home</a> • <a href="index.html">Meta-Evaluation</a> • <a href="https://github.com/Algiras/embedeval">GitHub</a></p>
    </footer>
  </div>

  <script>
    // Evolution progress
    new Chart(document.getElementById('evolutionChart'), {
      type: 'line',
      data: {
        labels: ${JSON.stringify(result.history.map((_, i) => `Gen ${i+1}`))},
        datasets: [
          { label: 'Best', data: ${JSON.stringify(result.history.map(h => (h.best * 100).toFixed(1)))}, borderColor: '#6366f1', fill: false, tension: 0.3 },
          { label: 'Average', data: ${JSON.stringify(result.history.map(h => (h.avg * 100).toFixed(1)))}, borderColor: '#8b5cf6', fill: false, tension: 0.3 }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#94a3b8' } } }, scales: { x: { ticks: { color: '#94a3b8' } }, y: { ticks: { color: '#94a3b8' }, title: { display: true, text: 'Fitness %', color: '#94a3b8' } } } }
    });

    // Model comparison
    const modelData = ${JSON.stringify(result.modelComparison || {})};
    new Chart(document.getElementById('modelChart'), {
      type: 'bar',
      data: {
        labels: Object.keys(modelData),
        datasets: [{ label: 'Avg Fitness %', data: Object.values(modelData).map(v => (v * 100).toFixed(1)), backgroundColor: '#6366f1' }]
      },
      options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { labels: { color: '#94a3b8' } } }, scales: { x: { ticks: { color: '#94a3b8' }, max: 100 }, y: { ticks: { color: '#94a3b8' } } } }
    });

    // Method comparison
    const methodData = ${JSON.stringify(result.methodComparison || {})};
    new Chart(document.getElementById('methodChart'), {
      type: 'bar',
      data: {
        labels: Object.keys(methodData),
        datasets: [{ label: 'Avg Fitness %', data: Object.values(methodData).map(v => (v * 100).toFixed(1)), backgroundColor: '#8b5cf6' }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#94a3b8' } } }, scales: { x: { ticks: { color: '#94a3b8' } }, y: { ticks: { color: '#94a3b8' }, max: 100 } } }
    });
  </script>
</body>
</html>`;

  await fs.writeFile(path.join(outputDir, 'evolution-results.html'), html);
  await fs.writeFile(path.join(outputDir, 'evolution-results.json'), JSON.stringify({
    timestamp: new Date().toISOString(),
    dataset: result.dataset,
    modelsUsed: result.modelsUsed,
    best: result.best.toJSON(),
    history: result.history,
    modelComparison: result.modelComparison,
    methodComparison: result.methodComparison,
    population: result.population.map(g => ({ name: g.getName(), ...g.toJSON() })),
  }, null, 2));
  
  console.log(`\n📄 Report: ${outputDir}/evolution-results.html`);
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║     EmbedEval - HuggingFace Dataset Evolution                ║
║     Using Gemini API + Ollama for Real Embeddings            ║
╚══════════════════════════════════════════════════════════════╝
`);

  // Preflight checks
  const availableModels = await preflight();
  
  // Download/prepare datasets
  await downloadDatasets();
  await ensureSampleDataset();
  
  // Load dataset - combine multiple for diverse evaluation
  console.log('📚 Loading datasets...');
  
  const retrieval = await loadLocalDataset('retrieval-benchmark');
  const hardNeg = await loadLocalDataset('hard-negatives');
  const sts = await loadLocalDataset('mteb-sts17');
  
  // Combine datasets
  const allQueries = [];
  const allCorpus = [];
  const corpusIdSet = new Set();
  
  for (const ds of [retrieval, hardNeg, sts].filter(Boolean)) {
    for (const q of ds.queries) {
      allQueries.push(q);
    }
    for (const d of ds.corpus) {
      if (!corpusIdSet.has(d.id)) {
        corpusIdSet.add(d.id);
        allCorpus.push(d);
      }
    }
  }
  
  const dataset = { queries: allQueries, corpus: allCorpus };
  const datasetName = 'Combined Benchmark';
  console.log(`   ${dataset.queries.length} queries, ${dataset.corpus.length} documents\n`);
  
  // Initialize population
  console.log('🌱 Creating initial population...');
  let population = createBaselines(availableModels);
  while (population.length < CONFIG.populationSize) {
    population.push(createRandomGenome(0, availableModels));
  }
  population = population.slice(0, CONFIG.populationSize);
  
  const history = [];
  let bestEver = null;
  let stagnation = 0;
  
  // Evolution loop
  for (let gen = 1; gen <= CONFIG.generations; gen++) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`  Generation ${gen}/${CONFIG.generations}`);
    console.log(`${'─'.repeat(60)}\n`);
    
    // Evaluate population
    for (let i = 0; i < population.length; i++) {
      const genome = population[i];
      if (!genome.fitness) {
        console.log(`  [${i+1}/${population.length}] ${genome.getShortName()}`);
        genome.fitness = await evaluateGenome(genome, dataset);
        console.log(`           → Fitness: ${(genome.fitness.fitness * 100).toFixed(1)}% | NDCG: ${(genome.fitness.ndcg10 * 100).toFixed(1)}%\n`);
      }
    }
    
    // Sort by fitness
    population.sort((a, b) => (b.fitness?.fitness || 0) - (a.fitness?.fitness || 0));
    
    // Track best
    const currentBest = population[0];
    if (!bestEver || currentBest.fitness.fitness > bestEver.fitness.fitness) {
      bestEver = new EmbeddingGenome(currentBest.toJSON());
      bestEver.fitness = { ...currentBest.fitness };
      stagnation = 0;
    } else {
      stagnation++;
    }
    
    // Record history
    const avgFitness = population.reduce((s, g) => s + (g.fitness?.fitness || 0), 0) / population.length;
    history.push({
      generation: gen,
      best: currentBest.fitness.fitness,
      avg: avgFitness,
      bestStrategy: currentBest.getShortName(),
    });
    
    console.log(`  📊 Best: ${currentBest.getName()}`);
    console.log(`     Fitness: ${(currentBest.fitness.fitness * 100).toFixed(1)}% | NDCG: ${(currentBest.fitness.ndcg10 * 100).toFixed(1)}% | Stagnation: ${stagnation}/${CONFIG.stagnationLimit}`);
    
    if (stagnation >= CONFIG.stagnationLimit) {
      console.log(`\n⚠️ Stopping: No improvement for ${stagnation} generations`);
      break;
    }
    
    // Create next generation
    if (gen < CONFIG.generations) {
      const newPop = [];
      
      // Elitism
      for (let i = 0; i < CONFIG.eliteCount && i < population.length; i++) {
        const elite = population[i].clone();
        elite.fitness = { ...population[i].fitness };
        newPop.push(elite);
      }
      
      // Fill with offspring
      while (newPop.length < CONFIG.populationSize) {
        const p1 = tournamentSelect(population);
        const p2 = tournamentSelect(population);
        
        let child;
        if (Math.random() < CONFIG.crossoverRate) {
          child = crossover(p1, p2);
        } else {
          child = p1.clone();
        }
        
        child = mutate(child, CONFIG.mutationRate, availableModels);
        newPop.push(child);
      }
      
      population = newPop;
    }
  }
  
  // Compute comparisons
  const modelScores = {};
  const methodScores = {};
  
  for (const genome of population) {
    const model = genome.genes.embeddingModel.split('/')[1] || genome.genes.embeddingModel;
    const method = genome.genes.retrievalMethod;
    const fitness = genome.fitness?.fitness || 0;
    
    if (!modelScores[model]) modelScores[model] = [];
    modelScores[model].push(fitness);
    
    if (!methodScores[method]) methodScores[method] = [];
    methodScores[method].push(fitness);
  }
  
  const modelComparison = {};
  for (const [model, scores] of Object.entries(modelScores)) {
    modelComparison[model] = scores.reduce((a, b) => a + b, 0) / scores.length;
  }
  
  const methodComparison = {};
  for (const [method, scores] of Object.entries(methodScores)) {
    methodComparison[method] = scores.reduce((a, b) => a + b, 0) / scores.length;
  }
  
  // Final report
  console.log(`\n${'═'.repeat(60)}`);
  console.log('🏆 EVOLUTION COMPLETE');
  console.log(`${'═'.repeat(60)}`);
  console.log(`\nBest Strategy: ${bestEver.getName()}`);
  console.log(`  Embedding: ${bestEver.genes.embeddingModel}`);
  console.log(`  Fitness: ${(bestEver.fitness.fitness * 100).toFixed(1)}%`);
  console.log(`  NDCG@10: ${(bestEver.fitness.ndcg10 * 100).toFixed(1)}%`);
  console.log(`  Recall@10: ${(bestEver.fitness.recall10 * 100).toFixed(1)}%`);
  console.log(`  MRR@10: ${(bestEver.fitness.mrr10 * 100).toFixed(1)}%`);
  console.log(`  Latency: ${bestEver.fitness.latencyMs.toFixed(0)}ms`);
  
  // Generate report
  await generateReport({
    best: bestEver,
    history,
    population,
    modelsUsed: availableModels,
    modelComparison,
    methodComparison,
    dataset: datasetName,
    queryCount: dataset.queries.length,
    docCount: dataset.corpus.length,
  }, { outputDir: path.join(__dirname, '../docs') });
  
  console.log('\n✅ Done!\n');
}

main().catch(console.error);

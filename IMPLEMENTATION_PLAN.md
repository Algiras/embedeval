# Implementation Plan: Making EmbedEval a Research Platform

## 🎯 Goal
Transform EmbedEval from a "model comparison tool" to a "retrieval research platform" that supports experimenting with different approaches, not just different models.

## 📋 Phase 1: Strategy Framework Enhancement (Week 1-2)

### 1.1 Composable Strategy System

**Current:** Basic pipeline with hardcoded stages
**Target:** Plugin-based strategy system

```typescript
// strategies/base.ts
interface StrategyStage {
  name: string;
  type: 'embedding' | 'retrieval' | 'reranking' | 'chunking' | 'fusion';
  config: Record<string, any>;
  execute: (context: StrategyContext) => Promise<StrategyContext>;
}

interface Strategy {
  name: string;
  description: string;
  stages: StrategyStage[];
}

// Example strategies
const strategies = {
  // Basic embedding retrieval
  'baseline': {
    stages: [
      { type: 'embedding', config: {} },
      { type: 'retrieval', config: { k: 10, metric: 'cosine' } }
    ]
  },
  
  // Hybrid BM25 + Embeddings
  'hybrid-bm25': {
    stages: [
      { type: 'embedding', config: {} },
      { type: 'bm25', config: { k: 100 } },
      { type: 'fusion', config: { method: 'rrf', weights: [0.7, 0.3] } }
    ]
  },
  
  // With LLM re-ranking
  'reranked-llm': {
    stages: [
      { type: 'embedding', config: {} },
      { type: 'retrieval', config: { k: 50 } },
      { type: 'reranking', config: { method: 'llm', model: 'gpt-4', top_k: 10 } }
    ]
  },
  
  // Semantic chunking
  'semantic-chunks': {
    stages: [
      { type: 'chunking', config: { method: 'semantic', size: 512, overlap: 50 } },
      { type: 'embedding', config: {} },
      { type: 'retrieval', config: { k: 10 } }
    ]
  }
};
```

### 1.2 Chunking Strategies

```typescript
// strategies/chunking/fixed.ts
class FixedSizeChunker {
  chunk(documents: Document[], config: { size: number; overlap: number }): ChunkedDocument[] {
    // Implementation
  }
}

// strategies/chunking/semantic.ts
class SemanticChunker {
  chunk(documents: Document[], config: { maxSize: number }): ChunkedDocument[] {
    // Use embeddings to find semantic boundaries
  }
}

// strategies/chunking/sliding-window.ts
class SlidingWindowChunker {
  chunk(documents: Document[], config: { size: number; step: number }): ChunkedDocument[] {
    // Overlapping windows
  }
}
```

### 1.3 Retrieval Methods

```typescript
// strategies/retrieval/flat.ts - Current implementation
class FlatRetrieval {
  retrieve(query: Embedding, docs: Embedding[], config: { k: number; metric: string }): RetrievedDoc[] {
    // Brute force cosine similarity
  }
}

// strategies/retrieval/hnsw.ts
class HNSWRetrieval {
  constructor(dimensions: number) {
    // Initialize HNSW index
  }
  
  addDocuments(docs: Embedding[]): void {
    // Build index
  }
  
  retrieve(query: Embedding, config: { k: number }): RetrievedDoc[] {
    // Approximate nearest neighbor
  }
}

// strategies/retrieval/bm25.ts
class BM25Retrieval {
  retrieve(query: string, docs: Document[], config: { k: number }): RetrievedDoc[] {
    // Classic BM25 ranking
  }
}
```

### 1.4 Fusion Methods

```typescript
// strategies/fusion/rrf.ts (Reciprocal Rank Fusion)
class ReciprocalRankFusion {
  fuse(results: RetrievedDoc[][], config: { k: number }): RetrievedDoc[] {
    // RRF formula: score = sum(1 / (k + rank))
  }
}

// strategies/fusion/weighted.ts
class WeightedFusion {
  fuse(results: RetrievedDoc[][], weights: number[]): RetrievedDoc[] {
    // Weighted combination of scores
  }
}
```

### 1.5 Re-ranking Methods

```typescript
// strategies/reranking/llm.ts
class LLMReranker {
  async rerank(query: string, docs: RetrievedDoc[], config: { model: string; top_k: number }): Promise<RetrievedDoc[]> {
    // Use LLM to score relevance
    // Example prompt: "Rate relevance (0-10): Query: {query} Document: {doc}"
  }
}

// strategies/reranking/cross-encoder.ts
class CrossEncoderReranker {
  async rerank(query: string, docs: RetrievedDoc[], config: { model: string }): Promise<RetrievedDoc[]> {
    // Use cross-encoder model (e.g., from HF)
  }
}

// strategies/reranking/mmr.ts (Maximal Marginal Relevance)
class MMRReranker {
  rerank(docs: RetrievedDoc[], config: { lambda: number; top_k: number }): RetrievedDoc[] {
    // Balance relevance vs diversity
    // MMR = argmax[lambda * Sim(query, doc) - (1-lambda) * max(Sim(doc, selected))]
  }
}
```

## 📋 Phase 2: Data Analysis Tools (Week 3-4)

### 2.1 Query Analysis Command

```bash
embedeval analyze dataset \
  --dataset ./queries.jsonl \
  --corpus ./corpus.jsonl \
  --output ./analysis-report.html
```

**Features:**
- Query length distribution
- Query complexity analysis (question vs statement, entities, etc.)
- Query clustering (find similar queries)
- Relevance judgment distribution
- Corpus statistics (doc length, vocabulary)

### 2.2 Failure Analysis

```bash
embedeval analyze failures \
  --test-id <id> \
  --output ./failure-analysis.html
```

**Features:**
- Queries where all variants failed
- Queries with high variance across variants
- Error categorization (ambiguous, OOV, etc.)
- Embedding space visualization (t-SNE)

### 2.3 Chunking Experiments

```bash
embedeval experiment chunking \
  --dataset ./queries.jsonl \
  --corpus ./corpus.jsonl \
  --sizes 128,256,512,1024 \
  --overlaps 0,10,20,50 \
  --output ./chunking-results.json
```

**Features:**
- Grid search over chunking parameters
- Compare performance across configurations
- Recommend optimal chunking strategy

## 📋 Phase 3: Advanced Features (Week 5-6)

### 3.1 Synthetic Data Generation

```bash
embedeval generate synthetic \
  --corpus ./documents.jsonl \
  --provider openai \
  --model gpt-4 \
  --num-queries 100 \
  --output ./synthetic-queries.jsonl
```

**Methods:**
- LLM-generated questions from documents
- Hard negative mining (find similar but irrelevant docs)
- Query paraphrasing

### 3.2 Time-Series Tracking

```bash
embedeval history \
  --show-trends \
  --compare "test-1,test-2,test-3" \
  --output ./trends.html
```

**Features:**
- Track metrics over multiple runs
- Detect performance degradation
- Compare against baseline

### 3.3 Ensemble Methods

```typescript
// strategies/ensemble/voting.ts
class VotingEnsemble {
  async ensemble(results: RetrievedDoc[][], config: { method: 'majority' | 'borda' }): Promise<RetrievedDoc[]> {
    // Combine results from multiple strategies
  }
}
```

## 🎨 Configuration Example

```yaml
# research-config.yaml
experiments:
  - name: "Chunking Strategy Comparison"
    variants:
      - name: "fixed-256"
        strategy:
          - type: chunking
            config: { method: fixed, size: 256, overlap: 0 }
          - type: embedding
          - type: retrieval
            config: { k: 10 }
      
      - name: "semantic-512"
        strategy:
          - type: chunking
            config: { method: semantic, maxSize: 512 }
          - type: embedding
          - type: retrieval
            config: { k: 10 }
      
      - name: "sliding-128-64"
        strategy:
          - type: chunking
            config: { method: sliding, size: 128, step: 64 }
          - type: embedding
          - type: retrieval
            config: { k: 10 }

  - name: "Retrieval Method Comparison"
    variants:
      - name: "flat-cosine"
        strategy:
          - type: embedding
          - type: retrieval
            config: { method: flat, metric: cosine, k: 10 }
      
      - name: "hnsw-cosine"
        strategy:
          - type: embedding
          - type: retrieval
            config: { method: hnsw, metric: cosine, k: 10, ef: 200 }
      
      - name: "hybrid-bm25-embedding"
        strategy:
          - type: embedding
          - type: bm25
            config: { k: 100 }
          - type: fusion
            config: { method: rrf, k: 60, weights: [0.5, 0.5] }

  - name: "Re-ranking Comparison"
    variants:
      - name: "no-reranking"
        strategy:
          - type: embedding
          - type: retrieval
            config: { k: 10 }
      
      - name: "llm-rerank"
        strategy:
          - type: embedding
          - type: retrieval
            config: { k: 50 }
          - type: reranking
            config: { method: llm, model: gpt-4, top_k: 10 }
      
      - name: "mmr-diversity"
        strategy:
          - type: embedding
          - type: retrieval
            config: { k: 50 }
          - type: reranking
            config: { method: mmr, lambda: 0.5, top_k: 10 }

providers:
  - type: openai
    apiKey: ${OPENAI_API_KEY}
    model: text-embedding-3-large

dataset: ./data/queries.jsonl
corpus: ./data/corpus.jsonl
```

## 🔧 CLI Commands

```bash
# Run strategy comparison experiment
embedeval experiment run --config ./research-config.yaml

# Analyze dataset
embedeval analyze dataset --dataset ./queries.jsonl --corpus ./corpus.jsonl

# Grid search chunking
embedeval experiment chunking \
  --dataset ./queries.jsonl \
  --corpus ./corpus.jsonl \
  --sizes 128,256,512 \
  --overlaps 0,20,50

# Generate synthetic data
embedeval generate synthetic \
  --corpus ./docs.jsonl \
  --provider openai \
  --num-queries 100

# View trends over time
embedeval history --last 10 --show-trends

# Compare specific experiments
embedeval compare --experiments exp-1,exp-2,exp-3 --output ./comparison.html
```

## 📊 Success Metrics

After implementation, users should be able to:

1. ✅ Compare not just models, but approaches (chunking, retrieval, re-ranking)
2. ✅ Understand their data (query analysis, failure modes)
3. ✅ Experiment systematically (grid search, A/B tests)
4. ✅ Generate synthetic data for bootstrapping
5. ✅ Track improvements over time
6. ✅ Make data-driven decisions about retrieval architecture

## 🎯 Summary

**Current:** Compare embedding models head-to-head  
**Target:** Research platform for retrieval architecture decisions  

**Key additions:**
1. Composable strategy system (chunking → embedding → retrieval → re-ranking)
2. Data analysis tools (understand queries, failures, patterns)
3. Experiment framework (grid search, systematic comparison)
4. Synthetic data generation (bootstrap evaluation)
5. Time-series tracking (monitor over time)

This transforms EmbedEval into a comprehensive tool for researching and optimizing retrieval systems.

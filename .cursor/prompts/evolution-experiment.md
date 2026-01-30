# Prompt: Design Evolution Experiment

Use this prompt template when designing new evolution/research experiments.

---

## Template

```
I want to run an evolution experiment in EmbedEval:

Objective:
[What are we trying to optimize or learn?]

Current Baseline:
- Strategy: [current strategy name]
- Metrics: [current NDCG, recall, etc.]
- Constraints: [latency, cost, etc.]

Hypothesis:
[What do we think will improve results?]

Experiment Design:
- Population size: [number]
- Generations: [number]
- Fitness metric: [primary metric]
- Mutation rate: [0-1]

Success Criteria:
- Minimum improvement: [percentage]
- Statistical significance: [p-value threshold]
- Must not exceed: [constraint limits]

Data:
- Corpus: [path or description]
- Queries: [path or description]
- Size: [number of documents/queries]
```

---

## Example: Optimize Chunking Strategy

```
I want to run an evolution experiment in EmbedEval:

Objective:
Find optimal chunking parameters for our legal document corpus

Current Baseline:
- Strategy: fixed-chunks (size=512, overlap=0)
- Metrics: NDCG@10 = 0.68, Recall@10 = 0.72
- Constraints: Latency < 200ms per query

Hypothesis:
Semantic chunking with overlap may better preserve legal clause boundaries

Experiment Design:
- Population size: 20
- Generations: 10
- Fitness metric: ndcg@10
- Mutation rate: 0.15

Genes to Evolve:
- chunkingMethod: [fixed, semantic, sliding]
- chunkSize: [256, 384, 512, 768, 1024]
- chunkOverlap: [0, 25, 50, 100]

Success Criteria:
- Minimum improvement: 5% NDCG
- Statistical significance: p < 0.05
- Must not exceed: 300ms latency

Data:
- Corpus: ./data/legal-contracts.jsonl (5,000 documents)
- Queries: ./data/legal-queries.jsonl (200 queries)
- Human-labeled relevance judgments available
```

---

## Example: Find Optimal Hybrid Weights

```
I want to run an evolution experiment in EmbedEval:

Objective:
Optimize the BM25/embedding weight ratio for hybrid retrieval

Current Baseline:
- Strategy: hybrid-bm25 (weights=[0.5, 0.5])
- Metrics: NDCG@10 = 0.75, MRR@10 = 0.68
- Constraints: No additional cost constraints

Hypothesis:
Different query types may benefit from different BM25/embedding ratios

Experiment Design:
- Population size: 15
- Generations: 8
- Fitness metric: ndcg@10
- Mutation rate: 0.2

Genes to Evolve:
- embeddingWeight: [0.1 - 0.9] (continuous)
- bm25Weight: [0.1 - 0.9] (continuous, must sum to 1)
- retrievalK: [50, 75, 100, 150]

Success Criteria:
- Minimum improvement: 3% NDCG
- Statistical significance: p < 0.05

Data:
- Corpus: ./data/product-catalog.jsonl (50,000 products)
- Queries: ./data/search-queries.jsonl (500 queries, mixed types)
```

---

## Example: Compare Reranking Methods

```
I want to run an evolution experiment in EmbedEval:

Objective:
Determine if LLM reranking is worth the cost for our use case

Current Baseline:
- Strategy: baseline (no reranking)
- Metrics: NDCG@10 = 0.72, Precision@5 = 0.65
- Constraints: Cost < $0.01 per query

Hypothesis:
LLM reranking improves precision@5 enough to justify cost

Experiment Design:
- Type: A/B test (not evolution)
- Variants: [no-rerank, mmr-rerank, llm-rerank]
- Sample size: 200 queries per variant

Success Criteria:
- LLM must improve Precision@5 by >= 10%
- Cost must stay under $0.01/query
- Statistical significance: p < 0.01 (Bonferroni corrected)

Data:
- Corpus: ./data/knowledge-base.jsonl (10,000 documents)
- Queries: ./data/user-questions.jsonl (600 queries)
- High-stakes domain, precision matters more than recall
```

---

## Experiment Design Checklist

When designing experiments:

1. **Clear Hypothesis**
   - [ ] Specific, testable claim
   - [ ] Based on observations or theory
   - [ ] Defines expected improvement

2. **Appropriate Metrics**
   - [ ] Primary fitness metric chosen
   - [ ] Secondary metrics tracked
   - [ ] Constraints defined

3. **Sufficient Power**
   - [ ] Enough queries for significance
   - [ ] Enough generations for convergence
   - [ ] Population size appropriate for search space

4. **Valid Comparison**
   - [ ] Same data for all variants
   - [ ] Controlled variables
   - [ ] Reproducible setup

5. **Actionable Outcome**
   - [ ] Clear deployment criteria
   - [ ] Rollback plan
   - [ ] Monitoring plan

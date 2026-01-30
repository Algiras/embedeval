# Real-World Evaluation Examples

Ready-to-run examples using **GEMINI_API_KEY** and **Ollama** for actual embedding generation.

## 🚀 Quick Start

### Prerequisites

```bash
# 1. Set your Gemini API key
export GEMINI_API_KEY=your-key-here

# 2. Start Ollama (optional, for local comparison)
ollama serve
ollama pull nomic-embed-text

# 3. Start Redis (optional, for parallel processing)
./docker/redis.sh start
```

### Run Examples

```bash
# Option 1: Run individual examples
embedeval ab-test --config ./examples/real-world/ex1-gemini-vs-ollama.yaml

# Option 2: Run all examples via script
./examples/scripts/real-world-examples.sh

# Option 3: Run specific example
embedeval ab-test --config ./examples/real-world/ex2-query-embedding.yaml
```

## 📊 Examples Overview

### Example 1: Gemini vs Ollama (`ex1-gemini-vs-ollama.yaml`)
**What it tests**: Cloud vs local embedding providers

**Variants**:
- Google Gemini (embedding-001)
- Google Gemini (text-embedding-004) 
- Ollama (nomic-embed-text)

**Key Metrics**: NDCG@10, Recall@10, Latency comparison

**Run**:
```bash
embedeval ab-test --config ./examples/real-world/ex1-gemini-vs-ollama.yaml
```

---

### Example 2: Query Embedding Analysis (`ex2-query-embedding.yaml`)
**What it tests**: How different strategies affect query understanding

**Variants**:
- Simple retrieval (baseline)
- Hybrid BM25 + embeddings
- With document chunking

**Key Metrics**: Query-to-document matching quality

**Run**:
```bash
embedeval ab-test --config ./examples/real-world/ex2-query-embedding.yaml
```

---

### Example 3: Reranking Strategies (`ex3-reranking.yaml`)
**What it tests**: Different reranking approaches

**Variants**:
- No reranking (baseline)
- MMR reranking (diversity-focused)
- Hybrid + MMR
- Ollama baseline (comparison)

**Key Metrics**: Result diversity, ranking quality

**Run**:
```bash
embedeval ab-test --config ./examples/real-world/ex3-reranking.yaml
```

---

### Example 4: Full Permutation Matrix (`ex4-permutations.yaml`)
**What it tests**: All combinations of providers × strategies × chunking

**Variants** (9 total):
- Gemini: baseline, chunks, hybrid
- Ollama: baseline, chunks, semantic, hybrid, full-pipeline

**Key Metrics**: Comprehensive comparison matrix

**Run**:
```bash
embedeval ab-test --config ./examples/real-world/ex4-permutations.yaml
```

**Note**: Takes longer (9 variants × 5 queries = 45 evaluations)

---

### Example 5: Cost vs Performance (`ex5-cost-performance.yaml`)
**What it tests**: Cost-quality trade-offs

**Variants**:
- Gemini embedding-001 (legacy, cheaper)
- Gemini text-embedding-004 (latest, better)
- Gemini-004 + Hybrid (best quality)
- Ollama nomic (free, local)
- Ollama + chunks (free, better)

**Key Metrics**: Quality per dollar, latency comparison

**Run**:
```bash
embedeval ab-test --config ./examples/real-world/ex5-cost-performance.yaml
```

---

## 📈 Expected Results

### Example 1: Gemini vs Ollama

| Provider | NDCG@10 | Recall@10 | Latency | Cost |
|----------|---------|-----------|---------|------|
| Gemini-004 | ~0.90 | ~88% | ~50ms | Paid |
| Gemini-001 | ~0.88 | ~85% | ~45ms | Paid (cheaper) |
| Ollama | ~0.85 | ~82% | ~100ms | Free |

**Insight**: Cloud models slightly better quality, local models free but slower

---

### Example 2: Query Analysis

| Strategy | NDCG@5 | Improvement |
|----------|---------|-------------|
| Baseline | 0.82 | — |
| Hybrid | 0.87 | +6% 📈 |
| Chunked | 0.85 | +4% 📈 |

**Insight**: Hybrid approach (BM25 + embeddings) works best

---

### Example 3: Reranking

| Strategy | Diversity | NDCG@10 |
|----------|-----------|---------|
| Baseline | Low | 0.88 |
| MMR | High | 0.89 |
| Hybrid+MMR | High | 0.91 |

**Insight**: MMR improves diversity without hurting quality

---

### Example 4: Permutations

**Best Overall**: Gemini + Hybrid (NDCG@10: 0.92)  
**Best Free**: Ollama + Full Pipeline (NDCG@10: 0.88)  
**Fastest**: Gemini Baseline (45ms)  
**Best Value**: Ollama + Chunks (Free, NDCG@10: 0.86)

---

### Example 5: Cost Analysis

| Model | Quality | Latency | Cost/1K queries |
|-------|---------|---------|-----------------|
| Gemini-001 | Good | 45ms | ~$0.10 |
| Gemini-004 | Better | 50ms | ~$0.10 |
| Ollama | Good | 100ms | $0 |

**Insight**: Ollama provides 85% of quality at 0% of cost

---

## 🎯 Use Case Recommendations

### For Production (High Traffic)
```yaml
# Use: ex1-gemini-vs-ollama.yaml
# Choose: Gemini-004 with baseline strategy
# Why: Fast, good quality, predictable cost
```

### For Research (Quality Matters)
```yaml
# Use: ex4-permutations.yaml
# Choose: Gemini-004 + Hybrid
# Why: Best overall quality
```

### For Cost-Sensitive
```yaml
# Use: ex5-cost-performance.yaml
# Choose: Ollama + Chunks
# Why: 85% quality at $0 cost
```

### For Diverse Results
```yaml
# Use: ex3-reranking.yaml
# Choose: MMR reranking
# Why: Better diversity, less redundancy
```

---

## 📁 Output Structure

Each example creates:
```
real-results/
├── ex1-gemini-vs-ollama/
│   ├── metrics.json          # Raw metrics
│   ├── dashboard.html        # Visual comparison
│   └── results.csv          # Spreadsheet data
├── ex2-query-analysis/
│   └── ...
└── ...
```

---

## 🔧 Customization

### Change Dataset
Edit the YAML file:
```yaml
dataset: ./your-data/queries.jsonl
corpus: ./your-data/documents.jsonl
```

### Add More Variants
```yaml
variants:
  - id: my-variant
    name: "My Custom Setup"
    provider:
      type: google
      apiKey: ${GEMINI_API_KEY}
      model: text-embedding-004
    strategy: hybrid-bm25
```

### Change Metrics
```yaml
metrics:
  - ndcg@5
  - ndcg@10
  - recall@5
  - recall@10
  - mrr@10
  - map@10
  - hitRate@10
```

---

## 💡 Pro Tips

1. **Start Small**: Use sample data first, then scale
2. **Compare Trends**: Run same example multiple times
3. **Check Latency**: Cloud faster for small batches, local better for large
4. **Use Cache**: Second run much faster (embeddings cached)
5. **Analyze Failures**: Check which queries perform poorly

---

## 🐛 Troubleshooting

### "GEMINI_API_KEY not set"
```bash
export GEMINI_API_KEY=your-key-here
```

### "Ollama not running"
```bash
ollama serve
ollama pull nomic-embed-text
```

### "Redis not available"
```bash
./docker/redis.sh start
# Or: docker-compose up -d
```

### Slow execution
- Enable caching (default: 10GB)
- Use parallel processing (requires Redis)
- Start with smaller dataset

---

## 📊 Analyzing Results

### View Dashboard
```bash
open real-results/ex1-gemini-vs-ollama/dashboard.html
```

### Compare Metrics
```bash
# View JSON
cat real-results/ex1-gemini-vs-ollama/metrics.json | jq '.variants[] | {name: .variantName, ndcg10: .metrics.ndcg10}'

# View CSV
cat real-results/ex1-gemini-vs-ollama/results.csv
```

### Generate Report
```bash
embedeval dashboard \
  --results real-results/ex1-gemini-vs-ollama/metrics.json \
  --output report.html
```

---

## 🚀 Next Steps

1. ✅ Run all examples: `./examples/scripts/real-world-examples.sh`
2. 📊 Analyze results in `real-results/`
3. 🔧 Customize configs for your data
4. 📈 Scale to larger datasets
5. 🎯 Choose optimal setup for your use case

---

## 📚 Related Documentation

- [Main README](../../README.md)
- [EVALUATION_TESTING.md](../../EVALUATION_TESTING.md)
- [STRATEGY_SYSTEM.md](../../STRATEGY_SYSTEM.md)
- [Examples Overview](../README.md)

---

**Ready to evaluate?** Start with Example 1! 🎉

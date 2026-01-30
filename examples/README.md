# Quick Start Examples

This directory contains ready-to-run examples for common use cases.

## 🚀 Quick Start (5 minutes)

### 1. Basic Model Comparison
Compare two embedding models side-by-side:

```bash
embedeval ab-test \
  --name "Ollama vs OpenAI" \
  --variants "ollama:nomic-embed-text,openai:text-embedding-3-small" \
  --strategies baseline \
  --dataset ./examples/sample-queries.jsonl \
  --corpus ./examples/sample-corpus.jsonl
```

### 2. Strategy Comparison
Test which retrieval strategy works best:

```bash
embedeval ab-test \
  --name "Strategy Shootout" \
  --variants ollama:nomic-embed-text \
  --strategies baseline,fixed-chunks,semantic-chunks,hybrid-bm25 \
  --dataset ./examples/sample-queries.jsonl \
  --corpus ./examples/sample-corpus.jsonl
```

### 3. HuggingFace Model Test
Test a HuggingFace model:

```bash
embedeval ab-test \
  --name "HF Test" \
  --variants "huggingface:sentence-transformers/all-MiniLM-L6-v2" \
  --strategies baseline \
  --dataset ./examples/sample-queries.jsonl
```

## 📊 Example Flows

### Flow 1: Production Evaluation
**Goal**: Find the best setup for production RAG

```bash
# Step 1: Test baseline
embedeval ab-test \
  --name "Prod-Baseline" \
  --variants openai:text-embedding-3-small \
  --strategies baseline \
  --dataset ./data/prod-queries.jsonl

# Step 2: Add chunking
embedeval ab-test \
  --name "Prod-Chunked" \
  --variants openai:text-embedding-3-small \
  --strategies fixed-chunks \
  --dataset ./data/prod-queries.jsonl

# Step 3: Try hybrid
embedeval ab-test \
  --name "Prod-Hybrid" \
  --variants openai:text-embedding-3-small \
  --strategies hybrid-bm25 \
  --dataset ./data/prod-queries.jsonl

# Step 4: Compare all results
embedeval compare \
  --results ./results/Prod-*/metrics.json \
  --output ./results/production-comparison.html
```

### Flow 2: Model Selection
**Goal**: Choose the best embedding model for your data

```bash
# Step 1: List available strategies
embedeval strategy --list

# Step 2: Search HF models
embedeval huggingface --search "ecommerce" --limit 10

# Step 3: Test multiple models
embedeval ab-test \
  --name "Model-Comparison" \
  --variants "ollama:nomic-embed-text,huggingface:sentence-transformers/all-mpnet-base-v2,openai:text-embedding-3-small" \
  --strategies baseline \
  --dataset ./data/test-queries.jsonl

# Step 4: Analyze results
# Check which model has best NDCG@10 and lowest latency
```

### Flow 3: Chunking Optimization
**Goal**: Find optimal chunk size for your documents

```bash
# Test different chunk sizes
for size in 128 256 512 1024; do
  embedeval ab-test \
    --name "Chunk-Size-${size}" \
    --variants ollama:nomic-embed-text \
    --strategies fixed-chunks \
    --dataset ./data/long-docs-queries.jsonl \
    --config "{chunking:{size:${size}}}"
done

# Compare all chunk sizes
embedeval compare \
  --results ./results/Chunk-Size-*/metrics.json \
  --output ./results/chunking-analysis.html
```

### Flow 4: CI/CD Integration
**Goal**: Automated testing in CI/CD pipeline

```bash
# Create test configuration
cat > ci-config.yaml << 'EOF'
test:
  name: "CI Regression Test"
variants:
  - id: baseline
    name: "Baseline"
    provider:
      type: ollama
      baseUrl: http://localhost:11434
      model: nomic-embed-text
    strategy: baseline
gates:
  ndcg@5:
    min: 0.70
  recall@5:
    min: 0.65
EOF

# Run in CI
embedeval ab-test --config ci-config.yaml

# Exit code indicates pass/fail
# 0 = all gates passed
# 1 = some gates failed
```

### Flow 5: Human Evaluation
**Goal**: Collect human judgments for ground truth

```bash
# Step 1: Run automated evaluation
embedeval ab-test \
  --name "Auto-Eval" \
  --variants ollama:nomic-embed-text \
  --strategies baseline \
  --dataset ./data/queries.jsonl \
  --corpus ./data/corpus.jsonl

# Step 2: Start human evaluation wizard
embedeval human-eval \
  --dataset ./data/queries.jsonl \
  --session "human-round-1" \
  --notes

# Step 3: Re-run with human judgments
embedeval ab-test \
  --name "With-Human-Labels" \
  --variants ollama:nomic-embed-text \
  --strategies baseline \
  --dataset ./data/queries-with-human-labels.jsonl
```

### Flow 6: Multi-Provider Shootout
**Goal**: Compare all available providers

```bash
# Test local vs cloud providers
embedeval ab-test \
  --name "Provider-Shootout" \
  --variants "ollama:nomic-embed-text,openai:text-embedding-3-small,google:embedding-001,huggingface:sentence-transformers/all-MiniLM-L6-v2" \
  --strategies baseline \
  --dataset ./data/test-queries.jsonl \
  --output ./results/provider-comparison

# Generate comparison dashboard
embedeval dashboard \
  --results ./results/provider-comparison/metrics.json \
  --output ./results/provider-comparison/dashboard.html
```

### Flow 7: A/B Test with Statistical Significance
**Goal**: Determine if new model is significantly better

```bash
# Run control (baseline)
embedeval ab-test \
  --name "Control" \
  --variants ollama:nomic-embed-text \
  --strategies baseline \
  --dataset ./data/ab-test-queries.jsonl

# Run treatment (new model)
embedeval ab-test \
  --name "Treatment" \
  --variants ollama:mxbai-embed-large \
  --strategies baseline \
  --dataset ./data/ab-test-queries.jsonl

# Compare with statistical tests
embedeval compare \
  --results ./results/Control/metrics.json,./results/Treatment/metrics.json \
  --statistical-tests \
  --confidence 0.95 \
  --output ./results/ab-test-report.html
```

### Flow 8: E-commerce Search Optimization
**Goal**: Optimize product search for e-commerce

```bash
# Test different approaches for product search
embedeval ab-test \
  --name "Ecommerce-Search" \
  --variants openai:text-embedding-3-small \
  --strategies baseline,hybrid-bm25 \
  --dataset ./data/product-search-queries.jsonl \
  --corpus ./data/product-catalog.jsonl

# Focus on top-5 results (most users don't scroll)
# Metrics: NDCG@5, Recall@5, HitRate@5
```

### Flow 9: Long Document Analysis
**Goal**: Handle long documents effectively

```bash
# Test with semantic chunking
embedeval ab-test \
  --name "Long-Docs-Semantic" \
  --variants ollama:nomic-embed-text \
  --strategies semantic-chunks \
  --dataset ./data/long-document-queries.jsonl \
  --corpus ./data/long-documents.jsonl

# Test with sliding window
embedeval ab-test \
  --name "Long-Docs-Sliding" \
  --variants ollama:nomic-embed-text \
  --strategies sliding-window \
  --dataset ./data/long-document-queries.jsonl \
  --corpus ./data/long-documents.jsonl
```

### Flow 10: Cost-Quality Trade-off
**Goal**: Find best quality per dollar

```bash
# Test cheap models
embedeval ab-test \
  --name "Cheap-Models" \
  --variants "ollama:nomic-embed-text,huggingface:sentence-transformers/all-MiniLM-L6-v2" \
  --strategies baseline \
  --dataset ./data/test-queries.jsonl

# Test expensive models
embedeval ab-test \
  --name "Premium-Models" \
  --variants "openai:text-embedding-3-large,huggingface:BAAI/bge-large-en-v1.5" \
  --strategies baseline \
  --dataset ./data/test-queries.jsonl

# Compare cost vs quality
# Check: metrics.json for each result includes cost estimates
```

## 📁 Configuration Examples

See `configs/` directory for complete configuration files:
- `production.yaml` - Production-ready setup
- `research.yaml` - Comprehensive research evaluation
- `chunking-experiment.yaml` - Chunk size optimization
- `provider-shootout.yaml` - Multi-provider comparison
- `ci-cd.yaml` - CI/CD integration with gates
- `ecommerce.yaml` - E-commerce search optimization

## 🔧 Advanced Usage

### Using Environment Variables

```bash
# Set variables
export OPENAI_API_KEY="sk-..."
export OLLAMA_HOST="http://localhost:11434"

# Use in config
# ${OPENAI_API_KEY} will be expanded

# Or use .env file
cat > .env << 'EOF'
OPENAI_API_KEY=sk-...
OLLAMA_HOST=http://localhost:11434
EOF

embedeval ab-test --config config.yaml
```

### Custom Strategies

```bash
# Define custom strategy in config
cat > custom-config.yaml << 'EOF'
strategies:
  - name: my-strategy
    stages:
      - type: chunking
        config: { size: 256, overlap: 50 }
      - type: embedding
      - type: retrieval
        config: { k: 20 }
      - type: reranking
        config: { method: mmr, topK: 10 }
EOF

embedeval ab-test --config custom-config.yaml
```

### Batch Processing

```bash
# Process multiple datasets
for dataset in ./data/*.jsonl; do
  name=$(basename $dataset .jsonl)
  embedeval ab-test \
    --name "Batch-${name}" \
    --variants ollama:nomic-embed-text \
    --strategies baseline \
    --dataset $dataset \
    --output "./results/batch/${name}"
done
```

## 📊 Output Examples

Each run produces:
- `metrics.json` - Raw metrics data
- `dashboard.html` - Visual comparison
- `summary.txt` - Text summary
- `per-query-results.jsonl` - Detailed per-query results

## 🎯 Next Steps

1. Try the quick start examples above
2. Explore the configuration files in `configs/`
3. Run the example script: `./scripts/run-examples.sh`
4. Adapt examples to your own data

## 💡 Tips

- Start with small dataset (5-10 queries) for quick iteration
- Use `--concurrency 1` for debugging
- Enable checkpointing for long-running evaluations
- Use cache to speed up repeated runs
- Compare results across multiple runs

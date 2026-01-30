# Real-World Examples with Ollama & Gemini

These examples use **Ollama** (free, local) and **Gemini** (cloud) with your `GEMINI_API_KEY`.

## Quick Start

### 1. Ollama Only (Free, Private)

```bash
# Make sure Ollama is running
ollama serve

# Pull embedding model
ollama pull nomic-embed-text

# Run evaluation
embedeval ab-test --config examples/ollama-gemini/ollama-only.yaml
```

### 2. Gemini Only (Fast, High Quality)

```bash
# Set your API key (already available in your environment)
export GEMINI_API_KEY=$GEMINI_API_KEY

# Run evaluation
embedeval ab-test --config examples/ollama-gemini/gemini-only.yaml
```

### 3. Ollama vs Gemini (A/B Test)

```bash
# Compare local vs cloud side-by-side
embedeval ab-test --config examples/ollama-gemini/ollama-vs-gemini.yaml
```

## Examples

### Example 1: Ollama-Only Evaluation

**Best for**: Privacy, no API costs, offline use

```yaml
# examples/ollama-gemini/ollama-only.yaml
test:
  name: "Ollama Local Evaluation"
  description: "Free, private embedding evaluation using local Ollama"

variants:
  - id: ollama-baseline
    name: "Ollama Baseline"
    provider:
      type: ollama
      model: nomic-embed-text
      baseUrl: http://localhost:11434
    strategy: baseline

dataset: ./examples/data/sample-queries.jsonl
corpus: ./examples/data/sample-corpus.jsonl

metrics:
  - ndcg@10
  - recall@10
  - mrr@10

output:
  json: ./results/ollama-only/metrics.json
  dashboard: ./results/ollama-only/dashboard.html
```

**Expected Results**:
- Quality: Good (NDCG ~0.70-0.75)
- Speed: Slower (1-3s per query)
- Cost: **$0** ✨
- Privacy: **100% local**

### Example 2: Gemini-Only Evaluation

**Best for**: Speed, convenience, high quality

```yaml
# examples/ollama-gemini/gemini-only.yaml
test:
  name: "Gemini Cloud Evaluation"
  description: "Fast, high-quality evaluation using Google Gemini API"

variants:
  - id: gemini-baseline
    name: "Gemini Baseline"
    provider:
      type: google
      model: text-embedding-004
      apiKey: ${GEMINI_API_KEY}
    strategy: baseline

dataset: ./examples/data/sample-queries.jsonl
corpus: ./examples/data/sample-corpus.jsonl

metrics:
  - ndcg@10
  - recall@10
  - mrr@10

output:
  json: ./results/gemini-only/metrics.json
  dashboard: ./results/gemini-only/dashboard.html
```

**Expected Results**:
- Quality: Excellent (NDCG ~0.82-0.88)
- Speed: Fast (100-200ms per query)
- Cost: ~$0.000025 per query

### Example 3: Ollama vs Gemini A/B Test

**Best for**: Deciding which to use for production

```yaml
# examples/ollama-gemini/ollama-vs-gemini.yaml
test:
  name: "Ollama vs Gemini A/B Test"
  description: "Compare local Ollama vs cloud Gemini for your use case"

variants:
  - id: ollama-local
    name: "Ollama (Local)"
    provider:
      type: ollama
      model: nomic-embed-text
    strategy: baseline

  - id: gemini-cloud
    name: "Gemini (Cloud)"
    provider:
      type: google
      model: text-embedding-004
    strategy: baseline

dataset: ./examples/data/sample-queries.jsonl
corpus: ./examples/data/sample-corpus.jsonl

metrics:
  - ndcg@10
  - recall@10
  - mrr@10

output:
  json: ./results/ollama-vs-gemini/metrics.json
  dashboard: ./results/ollama-vs-gemini/dashboard.html
  sideBySide: ./results/ollama-vs-gemini/comparison.html
```

**What You'll Learn**:
- Quality difference between local and cloud
- Speed difference (local vs API latency)
- Cost per query comparison
- Which is better for YOUR data

### Example 4: Multi-Strategy with Both

**Best for**: Finding optimal strategy regardless of provider

```yaml
# examples/ollama-gemini/multi-strategy.yaml
test:
  name: "Multi-Strategy Evaluation"
  description: "Test different strategies with both Ollama and Gemini"

variants:
  - id: ollama-baseline
    name: "Ollama Baseline"
    provider:
      type: ollama
      model: nomic-embed-text
    strategy: baseline

  - id: ollama-chunks
    name: "Ollama + Semantic Chunks"
    provider:
      type: ollama
      model: nomic-embed-text
    strategy: semantic-chunks

  - id: gemini-baseline
    name: "Gemini Baseline"
    provider:
      type: google
      model: text-embedding-004
    strategy: baseline

  - id: gemini-chunks
    name: "Gemini + Semantic Chunks"
    provider:
      type: google
      model: text-embedding-004
    strategy: semantic-chunks

dataset: ./examples/data/sample-queries.jsonl
corpus: ./examples/data/sample-corpus.jsonl

metrics:
  - ndcg@10
  - recall@10
  - mrr@10

output:
  json: ./results/multi-strategy/metrics.json
  dashboard: ./results/multi-strategy/dashboard.html
```

## Running the Examples

### Prerequisites

1. **Ollama installed**: https://ollama.ai
2. **GEMINI_API_KEY set**: Already available in your environment
3. **EmbedEval installed**: `npm install -g embedeval`

### Step-by-Step

```bash
# 1. Navigate to repo
cd /path/to/embedeval

# 2. Start Ollama (in separate terminal)
ollama serve

# 3. Pull model
ollama pull nomic-embed-text

# 4. Run Ollama-only example
embedeval ab-test --config examples/ollama-gemini/ollama-only.yaml

# 5. Run Gemini-only example
embedeval ab-test --config examples/ollama-gemini/gemini-only.yaml

# 6. Run comparison
embedeval ab-test --config examples/ollama-gemini/ollama-vs-gemini.yaml

# 7. View results
open results/ollama-vs-gemini/dashboard.html
```

## Understanding the Results

### Typical Comparison

| Metric | Ollama (Local) | Gemini (Cloud) | Difference |
|--------|---------------|----------------|------------|
| **NDCG@10** | 0.72 | 0.84 | +16.7% |
| **Recall@10** | 0.68 | 0.79 | +16.2% |
| **Latency** | 2,450ms | 120ms | 20x faster |
| **Cost** | $0 | $0.000025 | Free vs paid |
| **Privacy** | 100% local | Cloud | Local wins |

### When to Choose What

**Choose Ollama when:**
- ✅ Privacy is critical (medical, legal data)
- ✅ No internet connection
- ✅ Cost must be zero
- ✅ Data cannot leave your machine
- ⚠️ Accept 15-20% quality drop

**Choose Gemini when:**
- ✅ Maximum quality needed
- ✅ Speed is important
- ✅ Budget allows small costs
- ✅ Data can be processed in cloud
- ✅ Want to compare with other models

**Hybrid Approach:**
```yaml
# Use Ollama for dev, Gemini for production
variants:
  - name: "Development (Ollama)"
    provider: { type: ollama, model: nomic-embed-text }
    
  - name: "Production (Gemini)"
    provider: { type: google, model: text-embedding-004 }
```

## Tips

### Optimizing Ollama Performance

```bash
# Use GPU if available
ollama serve --gpu

# Pull faster model
ollama pull all-minilm  # Lighter than nomic-embed-text
```

### Managing Gemini Costs

```yaml
# Limit queries for testing
dataset: ./data/sample-queries.jsonl  # 50-100 queries

# Use smaller model for initial testing
provider:
  model: text-embedding-004  # Cheapest option
```

### Cost Estimate

For 100 test queries:
- **Ollama**: $0.00 (completely free)
- **Gemini**: $0.0025 (negligible)

For production (10,000 queries/day):
- **Ollama**: $0.00 / month
- **Gemini**: ~$7.50 / month

## Troubleshooting

### Ollama Connection Error

```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Start Ollama
ollama serve
```

### Gemini API Error

```bash
# Verify API key
echo $GEMINI_API_KEY

# Test with curl
curl "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=$GEMINI_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"content": {"parts": [{"text": "test"}]}}'
```

### Out of Memory (Ollama)

```bash
# Use smaller model
ollama pull all-minilm  # ~50MB vs nomic-embed-text ~500MB
```

## Next Steps

1. Run all 3 examples above
2. Compare results in your browser
3. Choose best provider for your use case
4. Try multi-strategy evaluation
5. Deploy winning configuration

---

**Questions?** Open an issue at https://github.com/Algiras/embedeval

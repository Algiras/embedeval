# Hugging Face Evaluation Examples

This directory contains example configurations for evaluating embedding models from Hugging Face on popular benchmarks.

## 📊 Available Evaluations

### MTEB Benchmarks
- **mteb-sts17.yaml** - Semantic Textual Similarity (English)
- **mteb-nfcorpus.yaml** - Medical information retrieval

### Question Answering
- **squad-retrieval.yaml** - SQuAD context retrieval

### Passage Ranking
- **msmarco-ranking.yaml** - Large-scale passage ranking

### Model Comparisons
- **hf-model-shootout.yaml** - Compare 8 popular HF models
- **multilingual.yaml** - Multilingual model comparison

## 🚀 Quick Start

### 1. Download Datasets

```bash
# Install datasets library
pip install datasets

# Download evaluation datasets
python scripts/download-hf-datasets.py
```

### 2. Run Evaluation

```bash
# Run single evaluation
embedeval ab-test --config examples/hf-evaluations/mteb-sts17.yaml

# Run model shootout (comprehensive comparison)
embedeval ab-test --config examples/hf-evaluations/hf-model-shootout.yaml
```

### 3. View Results

```bash
# Open dashboard
open results/mteb-sts17/dashboard.html

# View metrics
cat results/mteb-sts17/metrics.json
```

## 📈 Leaderboard Comparison

Compare your results with official MTEB leaderboard:

| Model | NFCorpus | STS17 | Avg |
|-------|----------|-------|-----|
| **gte-large** | 0.3585 | 0.8234 | 0.5910 |
| **bge-large** | 0.3512 | 0.8156 | 0.5834 |
| **e5-large** | 0.3421 | 0.8098 | 0.5760 |
| **all-MiniLM** | 0.2987 | 0.7845 | 0.5416 |

## 🎯 Recommended Workflows

### Quick Test (5 minutes)
```bash
embedeval ab-test \
  --config examples/hf-evaluations/mteb-sts17.yaml \
  --variants huggingface:sentence-transformers/all-MiniLM-L6-v2
```

### Standard Benchmark (30 minutes)
```bash
embedeval ab-test --config examples/hf-evaluations/mteb-nfcorpus.yaml
```

### Comprehensive Shootout (2-4 hours)
```bash
# With parallel processing (requires Redis)
embedeval ab-test --config examples/hf-evaluations/hf-model-shootout.yaml
```

## 📚 Resources

- **MTEB Leaderboard**: https://huggingface.co/spaces/mteb/leaderboard
- **Sentence Transformers**: https://sbert.net/
- **Hugging Face Hub**: https://huggingface.co/models?pipeline_tag=sentence-similarity

## 🤝 Contributing

To add new HF evaluations:

1. Create YAML config in `examples/hf-evaluations/`
2. Update this README
3. Test with `embedeval ab-test --config your-config.yaml`
4. Submit PR

## 📝 Configuration Template

```yaml
test:
  name: "Your Evaluation"
  description: "What this evaluates"

variants:
  - id: model-id
    name: "Model Name"
    provider:
      type: huggingface
      model: org/model-name
    strategy: baseline

dataset: ./datasets/your-dataset/queries.jsonl
corpus: ./datasets/your-dataset/corpus.jsonl

metrics:
  - ndcg@10
  - recall@10

output:
  json: ./results/your-eval/metrics.json
  dashboard: ./results/your-eval/dashboard.html
```

---

*For more details, see [HUGGINGFACE_EVALUATIONS.md](../../docs/HUGGINGFACE_EVALUATIONS.md)*

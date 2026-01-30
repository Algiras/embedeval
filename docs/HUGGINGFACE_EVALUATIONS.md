# Hugging Face Evaluation Examples for EmbedEval

This document contains example evaluations from Hugging Face that can be run with EmbedEval to benchmark embedding models against established datasets and leaderboards.

## 🏆 MTEB (Massive Text Embedding Benchmark)

The gold standard for embedding evaluation. MTEB contains 56 datasets across 112 languages.

### Quick Start Examples

#### 1. STS (Semantic Textual Similarity) - English
```yaml
# examples/hf-evaluations/mteb-sts17.yaml
test:
  name: "MTEB STS17 Evaluation"
  description: "Cross-lingual semantic similarity evaluation from MTEB benchmark"

variants:
  - id: minilm-sts
    name: "all-MiniLM-L6-v2 on STS"
    provider:
      type: huggingface
      model: sentence-transformers/all-MiniLM-L6-v2
    strategy: baseline

  - id: bge-sts
    name: "BGE-base on STS"
    provider:
      type: huggingface
      model: BAAI/bge-base-en-v1.5
    strategy: baseline

dataset: ./datasets/mteb/sts17-crosslingual-sts.jsonl
corpus: ./datasets/mteb/sts17-corpus.jsonl

metrics:
  - ndcg@10
  - spearman
  - cosine_similarity

output:
  json: ./results/mteb-sts/metrics.json
  dashboard: ./results/mteb-sts/dashboard.html
```

#### 2. NFCorpus (Retrieval)
```yaml
# examples/hf-evaluations/mteb-nfcorpus.yaml
test:
  name: "MTEB NFCorpus Retrieval"
  description: "Medical retrieval task from MTEB"

variants:
  - id: gte-base
    name: "GTE-base Retrieval"
    provider:
      type: huggingface
      model: thenlper/gte-base
    strategy: baseline

  - id: e5-base
    name: "E5-base Retrieval"
    provider:
      type: huggingface
      model: intfloat/e5-base-v2
    strategy: baseline

  - id: bge-m3
    name: "BGE-M3 Multi-modal"
    provider:
      type: huggingface
      model: BAAI/bge-m3
    strategy: hybrid-bm25

dataset: ./datasets/mteb/nfcorpus-queries.jsonl
corpus: ./datasets/mteb/nfcorpus-docs.jsonl

metrics:
  - ndcg@10
  - recall@10
  - precision@10
  - map@10

output:
  json: ./results/mteb-nfcorpus/metrics.json
  dashboard: ./results/mteb-nfcorpus/dashboard.html
```

#### 3. Clustering Tasks
```yaml
# examples/hf-evaluations/mteb-clustering.yaml
test:
  name: "MTEB Clustering Evaluation"
  description: "Biorxiv and Medrxiv clustering tasks"

variants:
  - id: minilm-cluster
    name: "MiniLM Clustering"
    provider:
      type: huggingface
      model: sentence-transformers/all-MiniLM-L6-v2
    strategy: baseline

  - id: instructor-cluster
    name: "Instructor-XL Clustering"
    provider:
      type: huggingface
      model: hkunlp/instructor-xl
    strategy: baseline

dataset: ./datasets/mteb/biorxiv-clustering.jsonl
corpus: ./datasets/mteb/biorxiv-corpus.jsonl

metrics:
  - v_measure
  - silhouette_score
  - adjusted_rand_index

output:
  json: ./results/mteb-clustering/metrics.json
```

## 📊 Popular Hugging Face Datasets

### 1. SQuAD (Question Answering)
```yaml
# examples/hf-evaluations/squad-retrieval.yaml
test:
  name: "SQuAD Retrieval Evaluation"
  description: "Question-answer pair retrieval from SQuAD dataset"

variants:
  - id: mpnet-squad
    name: "MPNet on SQuAD"
    provider:
      type: huggingface
      model: sentence-transformers/all-mpnet-base-v2
    strategy: baseline

  - id: gte-squad
    name: "GTE-large on SQuAD"
    provider:
      type: huggingface
      model: thenlper/gte-large
    strategy: semantic-chunks

dataset: ./datasets/squad/queries.jsonl
corpus: ./datasets/squad/contexts.jsonl

metrics:
  - ndcg@5
  - ndcg@10
  - recall@5
  - recall@10
  - mrr@10

output:
  json: ./results/squad/metrics.json
  dashboard: ./results/squad/dashboard.html
```

### 2. MSMARCO (Passage Ranking)
```yaml
# examples/hf-evaluations/msmarco-ranking.yaml
test:
  name: "MS MARCO Passage Ranking"
  description: "Large-scale passage retrieval benchmark"

variants:
  - id: msmarco-minilm
    name: "MiniLM on MSMARCO"
    provider:
      type: huggingface
      model: sentence-transformers/all-MiniLM-L6-v2
    strategy: baseline

  - id: msmarco-e5
    name: "E5 on MSMARCO"
    provider:
      type: huggingface
      model: intfloat/e5-large-v2
    strategy: hybrid-bm25

  - id: msmarco-bge
    name: "BGE on MSMARCO"
    provider:
      type: huggingface
      model: BAAI/bge-large-en-v1.5
    strategy: full-pipeline

dataset: ./datasets/msmarco/queries.jsonl
corpus: ./datasets/msmarco/corpus.jsonl

metrics:
  - ndcg@10
  - recall@50
  - recall@100
  - map@100
  - mrr@10

output:
  json: ./results/msmarco/metrics.json
  dashboard: ./results/msmarco/dashboard.html
  csv: ./results/msmarco/results.csv
```

### 3. Quora Question Pairs
```yaml
# examples/hf-evaluations/quora-duplicate.yaml
test:
  name: "Quora Duplicate Detection"
  description: "Detecting duplicate questions on Quora"

variants:
  - id: quora-distilbert
    name: "DistilBERT on Quora"
    provider:
      type: huggingface
      model: sentence-transformers/distilbert-base-nli-stsb-mean-tokens
    strategy: baseline

  - id: quora-mpnet
    name: "MPNet on Quora"
    provider:
      type: huggingface
      model: sentence-transformers/all-mpnet-base-v2
    strategy: baseline

dataset: ./datasets/quora/queries.jsonl
corpus: ./datasets/quora/questions.jsonl

metrics:
  - accuracy
  - f1_score
  - precision
  - recall

output:
  json: ./results/quora/metrics.json
```

## 🌍 Multilingual Evaluations

### 1. C-MTEB (Chinese)
```yaml
# examples/hf-evaluations/c-mteb.yaml
test:
  name: "C-MTEB Chinese Evaluation"
  description: "Chinese embedding benchmark from C-MTEB"

variants:
  - id: chinese-bert
    name: "Chinese BERT"
    provider:
      type: huggingface
      model: uer/sbert-base-chinese-nli
    strategy: baseline

  - id: multilingual-minilm
    name: "Multilingual MiniLM"
    provider:
      type: huggingface
      model: sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2
    strategy: baseline

  - id: bce-embedding
    name: "BCE Embedding"
    provider:
      type: huggingface
      model: maidalun1020/bce-embedding-base_v1
    strategy: semantic-chunks

dataset: ./datasets/c-mteb/queries.jsonl
corpus: ./datasets/c-mteb/corpus.jsonl

metrics:
  - ndcg@10
  - recall@10
  - map@10

output:
  json: ./results/c-mteb/metrics.json
```

### 2. XTREME (Cross-lingual)
```yaml
# examples/hf-evaluations/xtreme.yaml
test:
  name: "XTREME Cross-lingual"
  description: "Cross-lingual evaluation across 40 languages"

variants:
  - id: labse
    name: "LaBSE Multilingual"
    provider:
      type: huggingface
      model: sentence-transformers/LaBSE
    strategy: baseline

  - id: multilingual-e5
    name: "Multilingual E5"
    provider:
      type: huggingface
      model: intfloat/multilingual-e5-large
    strategy: baseline

dataset: ./datasets/xtreme/queries.jsonl
corpus: ./datasets/xtreme/corpus.jsonl

metrics:
  - ndcg@10
  - recall@10
  - accuracy

output:
  json: ./results/xtreme/metrics.json
```

## 🎯 Domain-Specific Evaluations

### 1. Scientific/Academic
```yaml
# examples/hf-evaluations/scidocs.yaml
test:
  name: "SciDocs Scientific Literature"
  description: "Citation prediction and document classification"

variants:
  - id: scibert
    name: "SciBERT Scientific"
    provider:
      type: huggingface
      model: allenai/scibert_scivocab_uncased
    strategy: baseline

  - id: sPECTER
    name: "SPECTER Citations"
    provider:
      type: huggingface
      model: allenai/specter
    strategy: baseline

dataset: ./datasets/scidocs/queries.jsonl
corpus: ./datasets/scidocs/papers.jsonl

metrics:
  - ndcg@10
  - map@10
  - recall@10

output:
  json: ./results/scidocs/metrics.json
```

### 2. Legal Documents
```yaml
# examples/hf-evaluations/legal.yaml
test:
  name: "Legal Document Retrieval"
  description: "Case law and statute retrieval"

variants:
  - id: legal-bert
    name: "Legal-BERT"
    provider:
      type: huggingface
      model: nlpaueb/legal-bert-base-uncased
    strategy: semantic-chunks

  - id: case-law
    name: "CaseLaw BERT"
    provider:
      type: huggingface
      model: pile-of-law/legalbert-large-1.7M-1
    strategy: fixed-chunks

dataset: ./datasets/legal/queries.jsonl
corpus: ./datasets/legal/documents.jsonl

metrics:
  - ndcg@10
  - recall@10
  - precision@10

output:
  json: ./results/legal/metrics.json
```

### 3. Medical/Healthcare
```yaml
# examples/hf-evaluations/medical.yaml
test:
  name: "Medical Information Retrieval"
  description: "PubMed and clinical document retrieval"

variants:
  - id: pubmedbert
    name: "PubMedBERT"
    provider:
      type: huggingface
      model: microsoft/BiomedNLP-PubMedBERT-base-uncased-abstract-fulltext
    strategy: semantic-chunks

  - id: clinicalbert
    name: "ClinicalBERT"
    provider:
      type: huggingface
      model: emilyalsentzer/Bio_ClinicalBERT
    strategy: baseline

dataset: ./datasets/medical/queries.jsonl
corpus: ./datasets/medical/abstracts.jsonl

metrics:
  - ndcg@10
  - recall@10
  - map@10

output:
  json: ./results/medical/metrics.json
```

## 🔧 Running the Evaluations

### Prerequisites
```bash
# Install EmbedEval
npm install -g embedeval

# Or use local development version
cd embedeval && npm install && npm run build
```

### Download Datasets
```bash
# Using Hugging Face datasets library
pip install datasets

# Download MTEB datasets
python scripts/download-mteb-datasets.py

# Or manually download from:
# https://huggingface.co/mteb
```

### Run Evaluations
```bash
# Run single evaluation
embedeval ab-test --config examples/hf-evaluations/mteb-sts17.yaml

# Run all MTEB evaluations
for config in examples/hf-evaluations/mteb-*.yaml; do
  embedeval ab-test --config "$config"
done

# Run with specific provider
embedeval ab-test \
  --config examples/hf-evaluations/mteb-nfcorpus.yaml \
  --variants huggingface:BAAI/bge-m3
```

## 📈 Leaderboard Comparison

Compare your results with official MTEB leaderboard:

| Model | NFCorpus | STS17 | Avg |
|-------|----------|-------|-----|
| **gte-large** | 0.3585 | 0.8234 | 0.5910 |
| **bge-large** | 0.3512 | 0.8156 | 0.5834 |
| **e5-large** | 0.3421 | 0.8098 | 0.5760 |
| **all-MiniLM** | 0.2987 | 0.7845 | 0.5416 |

## 🎯 Recommended Evaluation Suites

### Quick Test (5 min)
```yaml
# Quick sanity check
variants:
  - huggingface:sentence-transformers/all-MiniLM-L6-v2
dataset: ./examples/sample-queries.jsonl
```

### Standard Benchmark (30 min)
```yaml
# Standard MTEB subset
variants:
  - huggingface:BAAI/bge-base-en-v1.5
  - huggingface:sentence-transformers/all-mpnet-base-v2
dataset: ./datasets/mteb/sts17-crosslingual-sts.jsonl
```

### Comprehensive (2 hours)
```yaml
# Full MTEB suite
variants:
  - huggingface:BAAI/bge-large-en-v1.5
  - huggingface:intfloat/e5-large-v2
  - huggingface:thenlper/gte-large
datasets:
  - mteb/sts17
  - mteb/nfcorpus
  - mteb/scidocs
  - mteb/biorxiv-clustering
```

## 📚 Resources

- **MTEB Leaderboard**: https://huggingface.co/spaces/mteb/leaderboard
- **MTEB GitHub**: https://github.com/embeddings-benchmark/mteb
- **Sentence Transformers**: https://sbert.net/
- **Hugging Face Hub**: https://huggingface.co/models?pipeline_tag=sentence-similarity

## 🤝 Contributing

To add new Hugging Face evaluations:

1. Create YAML config in `examples/hf-evaluations/`
2. Add dataset to `datasets/` directory
3. Update this README with results
4. Submit PR with evaluation results

---

*These evaluations allow you to benchmark any embedding model against established standards and compare with state-of-the-art results.*

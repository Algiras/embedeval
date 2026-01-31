# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Automatic Token Refresh**: OAuth tokens are now automatically refreshed before expiration
  - `refreshOAuthToken()` function for manual refresh
  - `getCredential()` now checks expiration and refreshes automatically with 5-minute buffer
  - Preserves existing refresh tokens if server doesn't provide new ones
  - Graceful fallback to expired credentials if refresh fails

### Planned
- Grid search for optimal chunking parameters
- Synthetic data generation module
- Time-series tracking for experiments
- Parquet export format
- SQL export for data warehouses
- MLflow integration
- Query analysis dashboard
- Failure analysis tools

## [1.0.0] - 2024-01-30

### Added

#### Core Platform
- **Composable Strategy System**: Pipeline-based architecture supporting chunking → embedding → retrieval → fusion → re-ranking
- **A/B Testing Engine**: Compare multiple models and strategies with statistical significance testing
- **Parallel Processing**: BullMQ job queue with Redis for efficient evaluation
- **Binary Embedding Cache**: 10GB LRU cache with binary storage format
- **Per-Query Checkpointing**: Crash recovery and resumable evaluations

#### Embedding Providers
- **Ollama**: Local embedding models (nomic-embed-text, etc.)
- **OpenAI**: OpenAI API + compatible endpoints (OpenRouter, etc.)
- **Google**: Gemini Embedding API (embedding-001, text-embedding-004)
- **HuggingFace**: HF Hub models via Inference API or custom endpoints

#### Retrieval Strategies
- **Chunking**: Fixed-size, semantic (paragraph-based), sliding-window
- **Retrieval**: BM25, cosine similarity (embeddings)
- **Fusion**: Reciprocal Rank Fusion (RRF), weighted fusion
- **Re-ranking**: LLM-based relevance scoring, MMR (Maximal Marginal Relevance)

#### Predefined Strategies
1. `baseline` - Simple embedding retrieval
2. `fixed-chunks` - Fixed-size chunking with embedding
3. `semantic-chunks` - Semantic chunking with embedding
4. `hybrid-bm25` - BM25 + Embeddings with RRF fusion
5. `llm-reranked` - Embedding + LLM re-ranking
6. `mmr-diversity` - Embedding + MMR for diversity
7. `full-pipeline` - Complete pipeline with all stages

#### Evaluation Metrics
- **Ranking Metrics**: NDCG@K, MAP@K, MRR@K
- **Retrieval Metrics**: Recall@K, Hit Rate@K
- **Statistical Tests**: Paired t-test, Wilcoxon signed-rank test
- **Efficiency Metrics**: Latency (avg, p50, p95, p99), token usage, cost

#### CLI Commands
- `embedeval ab-test` - Run A/B tests comparing models/strategies
- `embedeval strategy` - List and test retrieval strategies
- `embedeval providers` - Manage and test embedding providers
- `embedeval huggingface` - Search HF Hub for embedding models
- `embedeval human-eval` - Interactive human evaluation wizard
- `embedeval dashboard` - Generate HTML dashboards from results

#### Infrastructure
- **TypeScript**: Strict mode for type safety
- **BullMQ**: Job queue for parallel processing
- **Redis**: Persistence for job state
- **Docker**: Redis container for local development
- **GitHub Actions**: CI/CD pipeline with automated testing
- **NPM**: Package distribution

#### Documentation
- README.md - Main documentation with quick start
- QUICKSTART.md - Step-by-step guide for new users
- STRATEGY_SYSTEM.md - Strategy system details and examples
- SYSTEM_ANALYSIS.md - Architecture analysis and gaps
- IMPLEMENTATION_PLAN.md - Roadmap for future development
- CONTRIBUTING.md - Guidelines for contributors
- RELEASE.md - Release process documentation
- CHANGELOG.md - This file
- docs/adr/ - Architecture Decision Records

#### Installation
- Install script (`install.sh`) for easy setup
- NPM global installation support
- Source installation from GitHub

### Technical Details

#### Architecture Decisions
- **Composable Pipeline**: Strategy pattern for flexible retrieval pipelines
- **Provider Abstraction**: Factory pattern for embedding providers
- **Binary Cache**: Filesystem-based binary storage for embeddings
- **Per-Query Checkpointing**: JSONL append-only format for durability
- **BullMQ**: Job queue for parallel processing with Redis

#### File Structure
```
embedeval/
├── src/
│   ├── cli/           # CLI commands
│   ├── core/          # Core types and evaluation
│   ├── providers/     # Embedding providers
│   ├── strategies/    # Composable strategies
│   ├── jobs/          # BullMQ + checkpointing
│   └── utils/         # Utilities
├── tests/             # Test suite
├── docs/              # Documentation
│   └── adr/           # Architecture Decision Records
├── examples/          # Sample data
├── docker/            # Docker setup
└── scripts/           # Utility scripts
```

### Known Issues
- TypeScript strict mode warnings in some CLI commands
- No package-lock.json (using npm install in CI)
- Requires Redis for parallel processing

### Contributors
- Algiras <kras.algim@gmail.com>

## Release History

- v1.0.0 (2024-01-30) - Initial release with complete platform

---

**Full Changelog**: [v1.0.0](https://github.com/Algiras/embedeval/releases/tag/v1.0.0)

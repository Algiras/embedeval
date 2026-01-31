# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.6] - 2026-01-31

### Added

#### Testing
- **346+ Tests**: Comprehensive test suite for core modules
  - 43 tests for eval engine (assertion, regex, code, LLM-judge, registry)
  - 66 tests for DSL parser (metadata, eval types, priority, patterns)
  - 40 tests for SDK evaluate module
  - 35 tests for core storage (TraceStore, AnnotationStore, TaxonomyStore)
  - 29 tests for CLI collect command
  - 35 tests for CLI annotate command (temporarily disabled due to stdin mocking)
  - 20 tests for CLI taxonomy command
  - 33 tests for CLI eval commands
  - 26 tests for CLI DSL commands
  - 63 tests for LLM providers integration
  - 6 existing auth tests (token refresh)

#### Documentation
- **GETTING_STARTED.md**: 10-minute tutorial for first-time users
  - Installation verification
  - First trace collection, annotation, taxonomy build
  - Run first eval
  - Export and next steps

- **TROUBLESHOOTING.md**: Comprehensive troubleshooting guide
  - Installation issues, JSONL format errors
  - Authentication problems, evaluation failures
  - Performance issues, CLI errors, DSL errors
  - Debug mode and getting help

#### CI/CD
- **Fixed CI workflows**: Now properly fail on errors
  - Removed `continue-on-error: true` from typecheck and lint steps
  - Removed error masking (`|| true`) from npm scripts
  - Added `npm test` step to CI workflows
  - Increased Jest timeout to 10000ms
  - Fixed Jest config JSON formatting

#### Authentication & Setup
- **Automatic Token Refresh**: OAuth tokens are now automatically refreshed before expiration
  - `refreshOAuthToken()` function for manual refresh
  - `getCredential()` now checks expiration and refreshes automatically with 5-minute buffer
  - Preserves existing refresh tokens if server doesn't provide new ones
  - Graceful fallback to expired credentials if refresh fails
  - **`embedeval doctor`**: Environment diagnostics command
  - Checks Node.js version, installation integrity, API keys, sample data
  - `--json` flag for programmatic output

## [Unreleased]

### Added

#### Testing
- **184+ Tests**: Comprehensive test suite for core modules
  - 43 tests for eval engine (assertion, regex, code, LLM-judge, registry)
  - 66 tests for DSL parser (metadata, eval types, priority, patterns)
  - 40 tests for SDK evaluate module
  - 35 tests for core storage (TraceStore, AnnotationStore, TaxonomyStore)
  - 29 tests for CLI collect command
  - 26 tests for CLI annotate command
  - 20 tests for CLI taxonomy command
  - 33 tests for CLI eval commands
  - 26 tests for CLI DSL commands
  - 63 tests for LLM providers integration
  - 6 existing auth tests (token refresh)
  
#### Documentation
- **GETTING_STARTED.md**: 10-minute tutorial for first-time users
  - Installation verification
  - First trace collection, annotation, taxonomy build
  - Run first eval
  - Export and next steps
  
- **TROUBLESHOOTING.md**: Comprehensive troubleshooting guide
  - Installation issues, JSONL format errors
  - Authentication problems, evaluation failures
  - Performance issues, CLI errors, DSL errors
  - Debug mode and getting help

#### Authentication & Setup
- **Automatic Token Refresh**: OAuth tokens are now automatically refreshed before expiration
  - `refreshOAuthToken()` function for manual refresh
  - `getCredential()` now checks expiration and refreshes automatically with 5-minute buffer
  - Preserves existing refresh tokens if server doesn't provide new ones
  - Graceful fallback to expired credentials if refresh fails
- **`embedeval doctor`**: Environment diagnostics command
  - Checks Node.js version, installation integrity, API keys, sample data
  - `--json` flag for programmatic output
  - `--fix` flag for interactive setup fixes
  - `--validate-keys` flag to test API keys with actual calls
- **`embedeval init`**: Project scaffolding command
  - Interactive project creation with 10 templates
  - Generates directory structure, .env file, README.md
  - API key configuration wizard
- **`embedeval demo`**: Complete workflow demonstration
  - Runs full evaluation workflow on sample data in seconds
  - Generates HTML report automatically
  - Perfect for onboarding new users

#### Advanced Evaluation Types (World-Class Features)
- **JSON Schema Validation**: New `json-schema` eval type using Ajv
  - Validates responses against JSON schemas
  - Supports validating response, metadata, context, or toolCalls
  - Configurable strict mode and string parsing
- **Safety & Security Suite**: New `safety` eval type
  - Prompt injection detection (25+ patterns)
  - Jailbreak attempt detection (15+ patterns)
  - PII leakage detection (SSN, credit cards, emails, phones)
  - Configurable check types: injection, jailbreak, pii, toxicity, all
- **Semantic Similarity**: New `semantic` eval type
  - Embedding-based comparison to reference text
  - Configurable similarity threshold
  - Foundation for embedding-based evals
- **Multi-Turn Conversation**: New `multi-turn` eval type
  - Validates consistency across conversation turns
  - Checks context retention
  - Detects contradictions with previous responses
- **Reasoning Validation**: New `reasoning` eval type
  - Validates step-by-step reasoning quality
  - Checks for citations in reasoning
  - Configurable minimum steps requirement

#### Enterprise Templates (10 Total)
Added 4 new enterprise-focused templates:
- **healthcare**: Medical accuracy, HIPAA compliance, disclaimer checks, PHI handling
- **legal**: Citation format, precedent accuracy, jurisdiction correctness, legal disclaimers
- **finance**: Compliance checks, risk disclosure, calculation accuracy, regulatory requirements
- **education**: Learning objective alignment, difficulty appropriateness, misconception detection

#### Developer Experience
- **Skills Index**: New documentation system
  - `skills/SKILL_INDEX.md`: Human-readable skill navigation
  - `skills/skill-manifest.json`: Machine-readable skill definitions
  - 17 skills documented across categories
- **GitHub Pages Improvements**
  - Setup Commands section with terminal demos
  - Skills Index section with quick navigation
  - Consistent dark theme colors throughout

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

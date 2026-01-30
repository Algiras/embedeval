# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial release of EmbedEval
- Composable strategy system for retrieval pipelines
- Multiple embedding providers (Ollama, OpenAI, Google, HuggingFace)
- A/B testing framework with statistical significance
- Chunking strategies (fixed, semantic, sliding-window)
- BM25 retrieval and hybrid fusion
- Re-ranking strategies (LLM, MMR)
- Binary embedding cache (10GB LRU)
- Per-query checkpointing
- Human evaluation wizard
- HTML dashboard generation
- CLI interface with multiple commands
- GitHub Actions CI/CD pipeline
- Install script for easy setup

## [1.0.0] - 2024-01-30

### Added
- Complete embedeval platform with composable strategies
- Strategy system supporting chunking → embedding → retrieval → fusion → re-ranking
- 7 predefined strategy pipelines
- CLI commands: ab-test, strategy, providers, huggingface, human-eval, dashboard
- GitHub Actions workflows for CI/CD
- NPM package configuration
- Install script for easy installation
- Comprehensive documentation

### Features
- **Multi-Provider Support**: Ollama, OpenAI, Google Gemini, Hugging Face
- **A/B Testing**: Compare models and strategies side-by-side
- **Composable Strategies**: Mix and match chunking, retrieval, fusion, re-ranking
- **Metrics**: NDCG@K, Recall@K, MRR@K, MAP@K, Hit Rate@K
- **Parallel Processing**: BullMQ with Redis
- **Binary Cache**: 10GB LRU cache for embeddings
- **Checkpointing**: Per-query crash recovery
- **Statistical Tests**: Paired t-test, Wilcoxon signed-rank
- **Human Evaluation**: Interactive wizard with note-taking
- **HTML Dashboards**: Visual comparison reports

### Documentation
- README.md with quick start
- QUICKSTART.md for new users
- STRATEGY_SYSTEM.md for strategy details
- SYSTEM_ANALYSIS.md for architecture overview
- IMPLEMENTATION_PLAN.md for roadmap
- CONTRIBUTING.md for contributors
- RELEASE.md for release process
- This CHANGELOG.md

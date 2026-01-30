# Examples Summary

## 📦 What's Included

### Configuration Files (`examples/configs/`)

1. **production.yaml** - Production-ready RAG setup
   - Fast baseline for high traffic
   - Chunked approach for better quality
   - High-quality variant for critical queries

2. **research.yaml** - Comprehensive research evaluation
   - Multiple providers (Ollama, OpenAI, Google, HF)
   - Full factorial testing
   - Statistical significance testing

3. **chunking-experiment.yaml** - Chunk size optimization
   - Grid search: 128, 256, 512, 1024 chunk sizes
   - Different overlap percentages
   - Semantic chunking comparison

4. **provider-shootout.yaml** - Multi-provider comparison
   - Ollama models (nomic, mxbai)
   - OpenAI (3-small, 3-large)
   - Google (embedding-001, text-embedding-004)
   - HuggingFace (MiniLM, MPNet, BGE)
   - OpenRouter (Cohere)

5. **ci-cd.yaml** - CI/CD integration
   - Pass/fail gates with thresholds
   - Environment variable support
   - Regression detection
   - Notification webhooks

6. **ecommerce.yaml** - E-commerce product search
   - Category-boosted search
   - Product recommendations
   - Business rules and gates

### Scripts (`examples/scripts/`)

1. **run-examples.sh** - Quick example runs
   - 8 different example commands
   - Tests various CLI features
   - Good for quick validation

2. **comprehensive-examples.sh** - Detailed demonstrations
   - 8 comprehensive example flows
   - Prerequisites checking
   - Progress tracking
   - Output analysis

### Documentation (`examples/README.md`)

Comprehensive guide with:
- Quick start (5 minutes)
- 10 detailed example flows
- Environment variable usage
- Custom strategies
- Batch processing
- Output analysis

## 🚀 Quick Start

```bash
# 1. Basic model comparison
embedeval ab-test \
  --variants ollama:nomic-embed-text \
  --strategies baseline \
  --dataset ./examples/sample-queries.jsonl

# 2. Strategy comparison
embedeval ab-test \
  --variants ollama:nomic-embed-text \
  --strategies baseline,fixed-chunks,hybrid-bm25 \
  --dataset ./examples/sample-queries.jsonl

# 3. Use config file
embedeval ab-test --config ./examples/configs/production.yaml

# 4. Run all examples
./examples/scripts/comprehensive-examples.sh
```

## 📊 Example Flows Covered

1. ✅ **Production Evaluation** - Find best setup for production RAG
2. ✅ **Model Selection** - Choose best embedding model
3. ✅ **Chunking Optimization** - Find optimal chunk size
4. ✅ **CI/CD Integration** - Automated testing with gates
5. ✅ **Human Evaluation** - Collect ground truth labels
6. ✅ **Multi-Provider Shootout** - Compare all providers
7. ✅ **A/B Testing** - Statistical significance testing
8. ✅ **E-commerce Search** - Product search optimization
9. ✅ **Long Document Analysis** - Handle long documents
10. ✅ **Cost-Quality Trade-off** - Best quality per dollar

## 🔧 Environment Variables

Updated `.env.example` with:
- All API keys (OpenAI, Google, HF, OpenRouter)
- Service configuration (Ollama, Redis)
- Cache settings
- CI/CD gates (thresholds)
- Test data paths
- Notification settings
- Usage documentation

## 📁 File Structure

```
examples/
├── README.md                          # Main examples documentation
├── configs/
│   ├── production.yaml               # Production RAG setup
│   ├── research.yaml                 # Comprehensive research
│   ├── chunking-experiment.yaml      # Chunk size optimization
│   ├── provider-shootout.yaml        # Multi-provider comparison
│   ├── ci-cd.yaml                    # CI/CD integration
│   └── ecommerce.yaml                # E-commerce search
├── scripts/
│   ├── run-examples.sh               # Quick examples (8 runs)
│   └── comprehensive-examples.sh     # Detailed demonstrations
└── data/                             # Sample data files
    ├── sample-queries.jsonl
    └── sample-corpus.jsonl
```

## 🎯 Use Cases Covered

- **Production Deployment** - Performance vs quality trade-offs
- **Research & Development** - Comprehensive model comparison
- **CI/CD Automation** - Regression testing with gates
- **E-commerce** - Product search and recommendations
- **Cost Optimization** - Finding best value models
- **Chunking Strategy** - Document preprocessing optimization
- **Multi-Provider** - Cloud vs local model comparison

## 💡 Key Features Demonstrated

- ✅ Multiple provider support (6 providers)
- ✅ 7 predefined strategies
- ✅ Environment variable expansion
- ✅ CI/CD pass/fail gates
- ✅ Statistical significance testing
- ✅ Custom configurations
- ✅ Batch processing
- ✅ Output analysis

## 📚 Next Steps

1. Explore `examples/README.md` for detailed flows
2. Try configuration files in `examples/configs/`
3. Run example scripts: `./examples/scripts/run-examples.sh`
4. Adapt examples to your own data
5. Create custom configurations

## 🔗 Related Documentation

- [Main README](../README.md) - Project overview
- [EVALUATION_TESTING.md](../EVALUATION_TESTING.md) - Testing results
- [STRATEGY_SYSTEM.md](../STRATEGY_SYSTEM.md) - Strategy details
- [QUICKSTART.md](../QUICKSTART.md) - Getting started guide

---

**Total Examples Added**: 10+ flows, 6 configs, 2 scripts

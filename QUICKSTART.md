# Quick Start Guide

## 1. Setup

```bash
# Navigate to project
cd embedeval

# Install dependencies
npm install

# Start Redis (required for BullMQ)
./docker/redis.sh start

# Set environment variables
export OPENAI_API_KEY="your-key-here"
export GEMINI_API_KEY="your-key-here"
export HUGGINGFACE_API_KEY="your-hf-key"  # Optional, for HF Inference API
```

## 2. Test Providers

```bash
# Test Ollama (local)
npm run dev -- providers --test ollama

# Test OpenAI
npm run dev -- providers --test openai

# Test Google
npm run dev -- providers --test google

# Test Hugging Face (with API key for Inference API)
npm run dev -- providers --test huggingface

# Search Hugging Face for embedding models
npm run dev -- huggingface --search "sentence-transformers"
```

## 3. Run A/B Test

```bash
# Quick test with CLI options
npm run dev -- ab-test \
  --name "Test Run" \
  --variants ollama:nomic-embed-text,openai:text-embedding-3-small \
  --dataset ./examples/sample-queries.jsonl \
  --corpus ./examples/sample-corpus.jsonl \
  --output ./results

# Compare Hugging Face models
npm run dev -- ab-test \
  --name "HF Models" \
  --variants "huggingface:sentence-transformers/all-MiniLM-L6-v2,huggingface:sentence-transformers/all-mpnet-base-v2" \
  --dataset ./examples/sample-queries.jsonl \
  --corpus ./examples/sample-corpus.jsonl \
  --output ./results

# Or use config file
npm run dev -- ab-test --config ./examples/config.yaml
```

## 4. View Results

```bash
# Generate dashboard
npm run dev -- dashboard \
  --test-id <test-id> \
  --output ./results/dashboard.html

# Results are also saved as JSON
ls -la .embedeval/runs/<test-id>/results/
```

## 5. Human Evaluation

```bash
# Start interactive wizard
npm run dev -- human-eval \
  --dataset ./examples/sample-queries.jsonl \
  --provider ollama \
  --model nomic-embed-text
```

## Troubleshooting

### Redis Connection Error

```bash
# Check if Redis is running
./docker/redis.sh status

# Restart Redis
./docker/redis.sh restart
```

### Provider Connection Issues

```bash
# Test specific provider
npm run dev -- providers --test ollama --base-url http://localhost:11434
```

### Cache Issues

```bash
# Clear cache
rm -rf .embedeval/cache
```

## Next Steps

- Create your own dataset in JSONL format
- Define custom strategies in config.yaml
- Run comparisons across multiple models
- Use human evaluation to create ground truth

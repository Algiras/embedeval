#!/bin/bash
# Multi-Model Shootout Setup Script
# Pulls all Ollama models and runs comprehensive evaluation

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🚀 Multi-Model Shootout Setup"
echo "============================="
echo ""

# Check prerequisites
echo "Checking prerequisites..."

if ! command -v ollama &> /dev/null; then
    echo -e "${RED}✗${NC} Ollama not found. Install from https://ollama.ai"
    exit 1
fi

if ! curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo -e "${YELLOW}!${NC} Ollama not running. Starting..."
    ollama serve &
    sleep 5
fi

if [ -z "$GEMINI_API_KEY" ]; then
    echo -e "${RED}✗${NC} GEMINI_API_KEY not set"
    exit 1
fi

echo -e "${GREEN}✓${NC} Prerequisites met"
echo ""

# Pull models
echo "📦 Pulling Ollama models..."
echo "This may take 10-30 minutes depending on your connection"
echo ""

models=(
    "nomic-embed-text"
    "all-minilm"
    "mxbai-embed-large"
    "snowflake-arctic-embed"
    "llama3.2"
    "qwen2.5"
)

for model in "${models[@]}"; do
    echo -n "Pulling $model... "
    if ollama pull "$model" 2>/dev/null; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${YELLOW}⚠${NC} (may need manual pull)"
    fi
done

echo ""
echo -e "${GREEN}✓${NC} Model setup complete"
echo ""

# Show menu
echo "What would you like to do?"
echo ""
echo "1) Run FULL multi-model shootout (25 variants, 2-4 hours, ~$20)"
echo "2) Run QUICK test (5 variants, 20 min, ~$2)"
echo "3) Run Ollama-only (15 variants, 1-2 hours, FREE)"
echo "4) Run Gemini-only (10 variants, 30 min, ~$5)"
echo "5) View current models"
echo "6) Exit"
echo ""

read -p "Choice (1-6): " choice

case $choice in
    1)
        echo ""
        echo "🔬 Running FULL multi-model shootout..."
        echo "This will test 25 different configurations"
        echo "Estimated time: 2-4 hours"
        echo "Estimated cost: ~$20 in API calls"
        echo ""
        read -p "Press Enter to continue..."
        embedeval ab-test --config examples/ollama-gemini/multi-model-shootout.yaml
        ;;
    2)
        echo ""
        echo "⚡ Running QUICK test..."
        echo "Testing 5 most important variants"
        # Create temporary quick config
        cat > /tmp/quick-shootout.yaml << 'EOF'
test:
  name: "Quick Shootout"
variants:
  - id: ollama-nomic
    name: "Ollama: nomic-embed-text"
    provider: { type: ollama, model: nomic-embed-text }
    strategy: baseline
  - id: gemini-004
    name: "Gemini: text-embedding-004"
    provider: { type: google, model: text-embedding-004 }
    strategy: baseline
  - id: ollama-snowflake
    name: "Ollama: snowflake-arctic-embed"
    provider: { type: ollama, model: snowflake-arctic-embed }
    strategy: semantic-chunks
  - id: gemini-hybrid
    name: "Gemini: Hybrid BM25"
    provider: { type: google, model: text-embedding-004 }
    strategy: hybrid-bm25
  - id: ollama-gemini-hybrid
    name: "Hybrid: Ollama + Gemini"
    provider: { type: ollama, model: nomic-embed-text }
    strategy: llm-reranked
    llmProvider: { type: google, model: gemini-pro }
dataset: ./examples/data/sample-queries.jsonl
corpus: ./examples/data/sample-corpus.jsonl
metrics: [ndcg@10, recall@10]
output:
  json: ./results/quick-shootout/metrics.json
  dashboard: ./results/quick-shootout/dashboard.html
EOF
        embedeval ab-test --config /tmp/quick-shootout.yaml
        rm /tmp/quick-shootout.yaml
        ;;
    3)
        echo ""
        echo "🦙 Running Ollama-only evaluation..."
        echo "FREE - No API costs"
        # Filter to Ollama-only variants
        cat > /tmp/ollama-only-shootout.yaml << 'EOF'
test:
  name: "Ollama-Only Shootout"
variants:
  - id: nomic-baseline
    name: "nomic-embed-text + baseline"
    provider: { type: ollama, model: nomic-embed-text }
    strategy: baseline
  - id: nomic-chunks
    name: "nomic-embed-text + chunks"
    provider: { type: ollama, model: nomic-embed-text }
    strategy: semantic-chunks
  - id: minilm-baseline
    name: "all-minilm + baseline"
    provider: { type: ollama, model: all-minilm }
    strategy: baseline
  - id: snowflake-baseline
    name: "snowflake-arctic-embed + baseline"
    provider: { type: ollama, model: snowflake-arctic-embed }
    strategy: baseline
  - id: snowflake-chunks
    name: "snowflake-arctic-embed + chunks"
    provider: { type: ollama, model: snowflake-arctic-embed }
    strategy: semantic-chunks
dataset: ./examples/data/sample-queries.jsonl
corpus: ./examples/data/sample-corpus.jsonl
metrics: [ndcg@10, recall@10, mrr@10]
output:
  json: ./results/ollama-shootout/metrics.json
  dashboard: ./results/ollama-shootout/dashboard.html
EOF
        embedeval ab-test --config /tmp/ollama-only-shootout.yaml
        rm /tmp/ollama-only-shootout.yaml
        ;;
    4)
        echo ""
        echo "🔮 Running Gemini-only evaluation..."
        echo "Testing Gemini with different strategies"
        cat > /tmp/gemini-only-shootout.yaml << 'EOF'
test:
  name: "Gemini-Only Shootout"
variants:
  - id: gemini-baseline
    name: "text-embedding-004 + baseline"
    provider: { type: google, model: text-embedding-004 }
    strategy: baseline
  - id: gemini-chunks
    name: "text-embedding-004 + semantic chunks"
    provider: { type: google, model: text-embedding-004 }
    strategy: semantic-chunks
  - id: gemini-hybrid
    name: "text-embedding-004 + hybrid BM25"
    provider: { type: google, model: text-embedding-004 }
    strategy: hybrid-bm25
  - id: gemini-mmr
    name: "text-embedding-004 + MMR diversity"
    provider: { type: google, model: text-embedding-004 }
    strategy: mmr-diversity
  - id: gemini-full
    name: "text-embedding-004 + full pipeline"
    provider: { type: google, model: text-embedding-004 }
    strategy: full-pipeline
dataset: ./examples/data/sample-queries.jsonl
corpus: ./examples/data/sample-corpus.jsonl
metrics: [ndcg@10, recall@10, mrr@10]
output:
  json: ./results/gemini-shootout/metrics.json
  dashboard: ./results/gemini-shootout/dashboard.html
EOF
        embedeval ab-test --config /tmp/gemini-only-shootout.yaml
        rm /tmp/gemini-only-shootout.yaml
        ;;
    5)
        echo ""
        echo "📋 Current Ollama models:"
        ollama list
        ;;
    6)
        echo "Goodbye!"
        exit 0
        ;;
    *)
        echo "Invalid choice"
        exit 1
        ;;
esac

echo ""
echo "✅ Complete!"
echo "View results:"
echo "  ls -la results/"

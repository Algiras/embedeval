#!/bin/bash

# Example Runs Script
# Demonstrates various EmbedEval use cases

set -e

echo "🚀 EmbedEval Example Runs"
echo "=========================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if embedeval is installed
if ! command -v embedeval &> /dev/null; then
    echo -e "${YELLOW}⚠️  embedeval not found in PATH${NC}"
    echo "   Using local build: npm run dev --"
    EMBEDEVAL="npm run dev --"
else
    EMBEDEVAL="embedeval"
fi

echo -e "${BLUE}Example 1: Quick Test with Sample Data${NC}"
echo "   Testing baseline strategy with Ollama..."
$EMBEDEVAL ab-test \
    --name "Quick Test" \
    --variants ollama:nomic-embed-text \
    --strategies baseline \
    --dataset ./examples/sample-queries.jsonl \
    --corpus ./examples/sample-corpus.jsonl \
    --output ./example-outputs/quick-test
echo -e "${GREEN}   ✓ Complete${NC}"
echo ""

echo -e "${BLUE}Example 2: Strategy Comparison${NC}"
echo "   Comparing different retrieval strategies..."
$EMBEDEVAL ab-test \
    --name "Strategy Comparison" \
    --variants ollama:nomic-embed-text \
    --strategies baseline,fixed-chunks,semantic-chunks,hybrid-bm25 \
    --dataset ./examples/sample-queries.jsonl \
    --corpus ./examples/sample-corpus.jsonl \
    --output ./example-outputs/strategy-comparison
echo -e "${GREEN}   ✓ Complete${NC}"
echo ""

echo -e "${BLUE}Example 3: Multi-Provider Comparison${NC}"
echo "   Comparing Ollama vs OpenAI..."
$EMBEDEVAL ab-test \
    --name "Provider Comparison" \
    --variants "ollama:nomic-embed-text,openai:text-embedding-3-small" \
    --strategies baseline \
    --dataset ./examples/sample-queries.jsonl \
    --corpus ./examples/sample-corpus.jsonl \
    --output ./example-outputs/provider-comparison
echo -e "${GREEN}   ✓ Complete${NC}"
echo ""

echo -e "${BLUE}Example 4: HuggingFace Model Test${NC}"
echo "   Testing HuggingFace model..."
$EMBEDEVAL ab-test \
    --name "HF Model Test" \
    --variants "huggingface:sentence-transformers/all-MiniLM-L6-v2" \
    --strategies baseline \
    --dataset ./examples/sample-queries.jsonl \
    --corpus ./examples/sample-corpus.jsonl \
    --output ./example-outputs/hf-test
echo -e "${GREEN}   ✓ Complete${NC}"
echo ""

echo -e "${BLUE}Example 5: Using Config File${NC}"
echo "   Running with production config..."
$EMBEDEVAL ab-test --config ./examples/configs/production.yaml
echo -e "${GREEN}   ✓ Complete${NC}"
echo ""

echo -e "${BLUE}Example 6: List Available Strategies${NC}"
$EMBEDEVAL strategy --list
echo ""

echo -e "${BLUE}Example 7: Search HuggingFace Models${NC}"
$EMBEDEVAL huggingface --search "sentence-transformers" --limit 5
echo ""

echo -e "${BLUE}Example 8: Test Provider Connectivity${NC}"
$EMBEDEVAL providers --test ollama || echo "   (Ollama not running)"
echo ""

echo -e "${GREEN}✅ All examples complete!${NC}"
echo ""
echo "📊 Results saved to: ./example-outputs/"
echo ""
echo "Next steps:"
echo "   - View results: ls -la ./example-outputs/"
echo "   - Open dashboard: open ./example-outputs/*/dashboard.html"
echo "   - Analyze metrics: cat ./example-outputs/*/metrics.json"

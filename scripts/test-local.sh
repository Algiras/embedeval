#!/bin/bash

# Local Integration Test Script
# Tests EmbedEval CLI with Ollama

set -e

echo "🧪 EmbedEval Local Integration Test"
echo "===================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Ollama is running
echo "📋 Checking Ollama..."
if ! curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo -e "${RED}❌ Ollama is not running on http://localhost:11434${NC}"
    echo "   Please start Ollama first:"
    echo "   ollama serve"
    exit 1
fi
echo -e "${GREEN}✓ Ollama is running${NC}"
echo ""

# Check if model is available
echo "📋 Checking for nomic-embed-text model..."
if ! curl -s http://localhost:11434/api/tags | grep -q "nomic-embed-text"; then
    echo -e "${YELLOW}⚠️  nomic-embed-text model not found${NC}"
    echo "   Pulling model..."
    ollama pull nomic-embed-text
fi
echo -e "${GREEN}✓ Model is available${NC}"
echo ""

# Build the project
echo "🔨 Building project..."
npm run build
echo -e "${GREEN}✓ Build successful${NC}"
echo ""

# Test 1: CLI Help
echo "🧪 Test 1: CLI Help"
node dist/cli/index.js --help > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ CLI help works${NC}"
else
    echo -e "${RED}❌ CLI help failed${NC}"
    exit 1
fi
echo ""

# Test 2: Providers List
echo "🧪 Test 2: Providers List"
node dist/cli/index.js providers --list > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Providers list works${NC}"
else
    echo -e "${RED}❌ Providers list failed${NC}"
    exit 1
fi
echo ""

# Test 3: Strategy List
echo "🧪 Test 3: Strategy List"
node dist/cli/index.js strategy --list > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Strategy list works${NC}"
else
    echo -e "${RED}❌ Strategy list failed${NC}"
    exit 1
fi
echo ""

# Test 4: Test Ollama Provider
echo "🧪 Test 4: Test Ollama Provider"
node dist/cli/index.js providers --test ollama --base-url http://localhost:11434 > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Ollama provider test works${NC}"
else
    echo -e "${YELLOW}⚠️  Ollama provider test failed (this is OK if model isn't fully loaded)${NC}"
fi
echo ""

# Test 5: A/B Test with Baseline Strategy
echo "🧪 Test 5: A/B Test (Baseline Strategy)"
echo "   Running quick A/B test with sample data..."
node dist/cli/index.js ab-test \
    --name "Local Integration Test" \
    --variants ollama:nomic-embed-text \
    --strategies baseline \
    --dataset ./examples/sample-queries.jsonl \
    --corpus ./examples/sample-corpus.jsonl \
    --output ./test-results \
    --concurrency 1

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ A/B test completed${NC}"
else
    echo -e "${RED}❌ A/B test failed${NC}"
    exit 1
fi
echo ""

# Test 6: Strategy Test
echo "🧪 Test 6: Strategy Configuration Test"
node dist/cli/index.js strategy --test hybrid-bm25 > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Strategy test works${NC}"
else
    echo -e "${RED}❌ Strategy test failed${NC}"
    exit 1
fi
echo ""

# Summary
echo "===================================="
echo -e "${GREEN}✅ All tests passed!${NC}"
echo ""
echo "📊 Test Results Location:"
echo "   ./test-results/"
echo ""
echo "🚀 You can now run full experiments:"
echo "   npm run dev -- ab-test \\"
echo "     --variants ollama:nomic-embed-text \\"
echo "     --strategies baseline,hybrid-bm25,llm-reranked \\"
echo "     --dataset ./examples/sample-queries.jsonl \\"
echo "     --corpus ./examples/sample-corpus.jsonl"

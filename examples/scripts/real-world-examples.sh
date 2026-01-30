#!/bin/bash

# Real-World Evaluation Examples
# Uses GEMINI_API_KEY and Ollama for actual embedding generation

set -e

echo "🔬 Real-World Evaluation Examples"
echo "=================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check prerequisites
check_prerequisites() {
    echo -e "${BLUE}Checking prerequisites...${NC}"
    
    # Check GEMINI_API_KEY
    if [ -z "$GEMINI_API_KEY" ]; then
        echo -e "${RED}❌ GEMINI_API_KEY not set${NC}"
        echo "   Please set: export GEMINI_API_KEY=your-key"
        exit 1
    fi
    echo -e "${GREEN}✓ GEMINI_API_KEY available${NC}"
    
    # Check Ollama
    if curl -s http://localhost:11434/api/tags &> /dev/null; then
        echo -e "${GREEN}✓ Ollama is running${NC}"
        OLLAMA_AVAILABLE=true
        
        # Check if model exists
        if curl -s http://localhost:11434/api/tags | grep -q "nomic-embed-text"; then
            echo -e "${GREEN}✓ nomic-embed-text model available${NC}"
        else
            echo -e "${YELLOW}⚠️  nomic-embed-text not found${NC}"
            echo "   Run: ollama pull nomic-embed-text"
            OLLAMA_AVAILABLE=false
        fi
    else
        echo -e "${YELLOW}⚠️  Ollama not running${NC}"
        echo "   Start with: ollama serve"
        OLLAMA_AVAILABLE=false
    fi
    
    # Check Redis
    if redis-cli ping &> /dev/null; then
        echo -e "${GREEN}✓ Redis is running${NC}"
    else
        echo -e "${YELLOW}⚠️  Redis not running (parallel processing disabled)${NC}"
    fi
    
    echo ""
}

# Determine embedeval command
if command -v embedeval &> /dev/null; then
    EMBEDEVAL="embedeval"
else
    echo -e "${YELLOW}Using local build${NC}"
    EMBEDEVAL="npm run dev --"
fi

# Example 1: Gemini vs Ollama - Basic Comparison
example_1_gemini_vs_ollama() {
    echo -e "${BLUE}Example 1: Gemini vs Ollama - Basic Comparison${NC}"
    echo "   Comparing Google Gemini embeddings with local Ollama"
    echo ""
    
    if [ "$OLLAMA_AVAILABLE" = true ]; then
        cat > /tmp/ex1-config.yaml << EOF
test:
  name: "Ex1: Gemini vs Ollama"
  description: "Basic embedding comparison between cloud and local"

variants:
  - id: gemini-001
    name: "Google Gemini (embedding-001)"
    provider:
      type: google
      apiKey: ${GEMINI_API_KEY}
      model: embedding-001
    strategy: baseline

  - id: gemini-004
    name: "Google Gemini (text-embedding-004)"
    provider:
      type: google
      apiKey: ${GEMINI_API_KEY}
      model: text-embedding-004
    strategy: baseline

  - id: ollama-nomic
    name: "Ollama (nomic-embed-text)"
    provider:
      type: ollama
      baseUrl: http://localhost:11434
      model: nomic-embed-text
    strategy: baseline

dataset: ./examples/sample-queries.jsonl
corpus: ./examples/sample-corpus.jsonl

metrics:
  - ndcg@5
  - ndcg@10
  - recall@5
  - recall@10
  - mrr@10

output:
  json: ./real-results/ex1-gemini-vs-ollama/metrics.json
  dashboard: ./real-results/ex1-gemini-vs-ollama/dashboard.html
EOF

        $EMBEDEVAL ab-test --config /tmp/ex1-config.yaml
        echo -e "${GREEN}   ✓ Complete${NC}"
        echo "   Results: ./real-results/ex1-gemini-vs-ollama/"
    else
        echo -e "${YELLOW}   Skipped (Ollama not available)${NC}"
    fi
    echo ""
}

# Example 2: Query Embedding Analysis
example_2_query_embeddings() {
    echo -e "${BLUE}Example 2: Query Embedding Analysis${NC}"
    echo "   Analyzing how different models embed queries"
    echo ""
    
    cat > /tmp/ex2-config.yaml << EOF
test:
  name: "Ex2: Query Embedding Quality"
  description: "Testing query embedding with different strategies"

variants:
  - id: gemini-queries
    name: "Gemini - Query Focus"
    provider:
      type: google
      apiKey: ${GEMINI_API_KEY}
      model: text-embedding-004
    strategy: baseline

  - id: gemini-hybrid
    name: "Gemini - Hybrid Approach"
    provider:
      type: google
      apiKey: ${GEMINI_API_KEY}
      model: text-embedding-004
    strategy: hybrid-bm25

dataset: ./examples/sample-queries.jsonl
corpus: ./examples/sample-corpus.jsonl

metrics:
  - ndcg@5
  - recall@5
  - mrr@10

output:
  json: ./real-results/ex2-query-analysis/metrics.json
  dashboard: ./real-results/ex2-query-analysis/dashboard.html
EOF

    $EMBEDEVAL ab-test --config /tmp/ex2-config.yaml
    echo -e "${GREEN}   ✓ Complete${NC}"
    echo "   Results: ./real-results/ex2-query-analysis/"
    echo ""
}

# Example 3: Document Chunking with Gemini
example_3_gemini_chunking() {
    echo -e "${BLUE}Example 3: Document Chunking with Gemini${NC}"
    echo "   Testing chunking strategies with Google embeddings"
    echo ""
    
    cat > /tmp/ex3-config.yaml << EOF
test:
  name: "Ex3: Gemini with Chunking"
  description: "Testing document chunking with Gemini embeddings"

variants:
  - id: gemini-baseline
    name: "Gemini - No Chunking"
    provider:
      type: google
      apiKey: ${GEMINI_API_KEY}
      model: text-embedding-004
    strategy: baseline

  - id: gemini-chunks-256
    name: "Gemini - 256 char chunks"
    provider:
      type: google
      apiKey: ${GEMINI_API_KEY}
      model: text-embedding-004
    strategy: fixed-chunks

  - id: gemini-chunks-512
    name: "Gemini - 512 char chunks"
    provider:
      type: google
      apiKey: ${GEMINI_API_KEY}
      model: text-embedding-004
    strategy: semantic-chunks

dataset: ./examples/sample-queries.jsonl
corpus: ./examples/sample-corpus.jsonl

metrics:
  - ndcg@5
  - ndcg@10
  - recall@5
  - recall@10

output:
  json: ./real-results/ex3-gemini-chunking/metrics.json
  dashboard: ./real-results/ex3-gemini-chunking/dashboard.html
EOF

    $EMBEDEVAL ab-test --config /tmp/ex3-config.yaml
    echo -e "${GREEN}   ✓ Complete${NC}"
    echo "   Results: ./real-results/ex3-gemini-chunking/"
    echo ""
}

# Example 4: Reranking Comparison
example_4_reranking() {
    echo -e "${BLUE}Example 4: Reranking Strategies${NC}"
    echo "   Comparing different reranking approaches"
    echo ""
    
    if [ "$OLLAMA_AVAILABLE" = true ]; then
        cat > /tmp/ex4-config.yaml << EOF
test:
  name: "Ex4: Reranking Comparison"
  description: "Testing reranking with MMR and LLM"

variants:
  - id: baseline-only
    name: "No Reranking (Baseline)"
    provider:
      type: google
      apiKey: ${GEMINI_API_KEY}
      model: text-embedding-004
    strategy: baseline

  - id: mmr-diversity
    name: "MMR Reranking (Diversity)"
    provider:
      type: google
      apiKey: ${GEMINI_API_KEY}
      model: text-embedding-004
    strategy: mmr-diversity

  - id: hybrid-then-mmr
    name: "Hybrid + MMR"
    provider:
      type: google
      apiKey: ${GEMINI_API_KEY}
      model: text-embedding-004
    strategy: hybrid-bm25

dataset: ./examples/sample-queries.jsonl
corpus: ./examples/sample-corpus.jsonl

metrics:
  - ndcg@5
  - ndcg@10
  - recall@5
  - mrr@10

output:
  json: ./real-results/ex4-reranking/metrics.json
  dashboard: ./real-results/ex4-reranking/dashboard.html
EOF

        $EMBEDEVAL ab-test --config /tmp/ex4-config.yaml
        echo -e "${GREEN}   ✓ Complete${NC}"
        echo "   Results: ./real-results/ex4-reranking/"
    else
        echo -e "${YELLOW}   Skipped (Ollama not available for MMR)${NC}"
    fi
    echo ""
}

# Example 5: Full Pipeline Permutations
example_5_full_permutations() {
    echo -e "${BLUE}Example 5: Full Pipeline Permutations${NC}"
    echo "   Testing all combinations: provider × strategy × chunking"
    echo ""
    
    if [ "$OLLAMA_AVAILABLE" = true ]; then
        cat > /tmp/ex5-config.yaml << EOF
test:
  name: "Ex5: Full Permutation Matrix"
  description: "All combinations of providers, strategies, and chunking"

variants:
  # Provider: Gemini
  - id: gemini-baseline
    name: "Gemini + Baseline"
    provider:
      type: google
      apiKey: ${GEMINI_API_KEY}
      model: text-embedding-004
    strategy: baseline

  - id: gemini-hybrid
    name: "Gemini + Hybrid"
    provider:
      type: google
      apiKey: ${GEMINI_API_KEY}
      model: text-embedding-004
    strategy: hybrid-bm25

  # Provider: Ollama
  - id: ollama-baseline
    name: "Ollama + Baseline"
    provider:
      type: ollama
      baseUrl: http://localhost:11434
      model: nomic-embed-text
    strategy: baseline

  - id: ollama-chunks
    name: "Ollama + Chunks"
    provider:
      type: ollama
      baseUrl: http://localhost:11434
      model: nomic-embed-text
    strategy: fixed-chunks

  - id: ollama-hybrid
    name: "Ollama + Hybrid"
    provider:
      type: ollama
      baseUrl: http://localhost:11434
      model: nomic-embed-text
    strategy: hybrid-bm25

  - id: ollama-full
    name: "Ollama + Full Pipeline"
    provider:
      type: ollama
      baseUrl: http://localhost:11434
      model: nomic-embed-text
    strategy: full-pipeline

dataset: ./examples/sample-queries.jsonl
corpus: ./examples/sample-corpus.jsonl

metrics:
  - ndcg@5
  - ndcg@10
  - recall@5
  - recall@10
  - mrr@10
  - map@10

output:
  json: ./real-results/ex5-permutations/metrics.json
  dashboard: ./real-results/ex5-permutations/dashboard.html
  csv: ./real-results/ex5-permutations/results.csv
EOF

        $EMBEDEVAL ab-test --config /tmp/ex5-config.yaml
        echo -e "${GREEN}   ✓ Complete${NC}"
        echo "   Results: ./real-results/ex5-permutations/"
    else
        echo -e "${YELLOW}   Skipped (Ollama not available)${NC}"
    fi
    echo ""
}

# Example 6: Cost-Performance Analysis
example_6_cost_analysis() {
    echo -e "${BLUE}Example 6: Cost-Performance Analysis${NC}"
    echo "   Comparing cost vs quality across providers"
    echo ""
    
    cat > /tmp/ex6-config.yaml << EOF
test:
  name: "Ex6: Cost vs Performance"
  description: "Analyzing cost-quality trade-offs"

variants:
  - id: gemini-001
    name: "Gemini embedding-001 (Cheaper)"
    provider:
      type: google
      apiKey: ${GEMINI_API_KEY}
      model: embedding-001
    strategy: baseline

  - id: gemini-004
    name: "Gemini text-embedding-004 (Better)"
    provider:
      type: google
      apiKey: ${GEMINI_API_KEY}
      model: text-embedding-004
    strategy: baseline

  - id: gemini-004-hybrid
    name: "Gemini-004 + Hybrid (Best Quality)"
    provider:
      type: google
      apiKey: ${GEMINI_API_KEY}
      model: text-embedding-004
    strategy: hybrid-bm25

dataset: ./examples/sample-queries.jsonl
corpus: ./examples/sample-corpus.jsonl

metrics:
  - ndcg@5
  - ndcg@10
  - recall@5
  - mrr@10

output:
  json: ./real-results/ex6-cost-analysis/metrics.json
  dashboard: ./real-results/ex6-cost-analysis/dashboard.html
EOF

    $EMBEDEVAL ab-test --config /tmp/ex6-config.yaml
    echo -e "${GREEN}   ✓ Complete${NC}"
    echo "   Results: ./real-results/ex6-cost-analysis/"
    echo "   Note: Compare latency and quality metrics"
    echo ""
}

# Example 7: Query Type Analysis
example_7_query_types() {
    echo -e "${BLUE}Example 7: Query Type Performance${NC}"
    echo "   Testing different query types with Gemini"
    echo ""
    
    cat > /tmp/ex7-config.yaml << EOF
test:
  name: "Ex7: Query Type Analysis"
  description: "Performance by query category"

variants:
  - id: gemini-baseline
    name: "Gemini - Baseline"
    provider:
      type: google
      apiKey: ${GEMINI_API_KEY}
      model: text-embedding-004
    strategy: baseline

  - id: gemini-hybrid
    name: "Gemini - Hybrid"
    provider:
      type: google
      apiKey: ${GEMINI_API_KEY}
      model: text-embedding-004
    strategy: hybrid-bm25

dataset: ./examples/sample-queries.jsonl
corpus: ./examples/sample-corpus.jsonl

metrics:
  - ndcg@5
  - recall@5
  - mrr@10

# Filter by query tags
queryFilters:
  - tag: technical
  - tag: cooking
  - tag: programming

output:
  json: ./real-results/ex7-query-types/metrics.json
  dashboard: ./real-results/ex7-query-types/dashboard.html
EOF

    $EMBEDEVAL ab-test --config /tmp/ex7-config.yaml
    echo -e "${GREEN}   ✓ Complete${NC}"
    echo "   Results: ./real-results/ex7-query-types/"
    echo "   Analyze by query category"
    echo ""
}

# Main execution
main() {
    check_prerequisites
    
    # Create output directory
    mkdir -p ./real-results
    
    echo -e "${BLUE}Running Real-World Examples...${NC}"
    echo ""
    
    # Run examples
    example_1_gemini_vs_ollama
    example_2_query_embeddings
    example_3_gemini_chunking
    example_4_reranking
    example_5_full_permutations
    example_6_cost_analysis
    example_7_query_types
    
    echo "=================================="
    echo -e "${GREEN}✅ All Real-World Examples Complete!${NC}"
    echo ""
    echo "📁 Results Directory: ./real-results/"
    echo ""
    echo "📊 Summary of Results:"
    ls -la ./real-results/
    echo ""
    echo "🎯 Key Comparisons:"
    echo "   1. Gemini vs Ollama: Cloud vs Local"
    echo "   2. Query Analysis: Different strategies"
    echo "   3. Chunking: Document preprocessing"
    echo "   4. Reranking: MMR and diversity"
    echo "   5. Permutations: All combinations"
    echo "   6. Cost: Quality vs price"
    echo "   7. Query Types: Category performance"
    echo ""
    echo "💡 Next Steps:"
    echo "   - View dashboards: open ./real-results/*/dashboard.html"
    echo "   - Compare metrics: cat ./real-results/*/metrics.json"
    echo "   - Analyze trends across examples"
}

# Run main
main

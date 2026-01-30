#!/bin/bash

# Comprehensive Example Flows
# Demonstrates various EmbedEval use cases and workflows

set -e

echo "🚀 EmbedEval Comprehensive Examples"
echo "===================================="
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
    
    if ! command -v embedeval &> /dev/null; then
        echo -e "${YELLOW}⚠️  embedeval not found in PATH${NC}"
        echo "   Using: npm run dev --"
        EMBEDEVAL="npm run dev --"
    else
        EMBEDEVAL="embedeval"
        echo -e "${GREEN}✓ embedeval found${NC}"
    fi
    
    # Check Ollama
    if curl -s http://localhost:11434/api/tags &> /dev/null; then
        echo -e "${GREEN}✓ Ollama is running${NC}"
        OLLAMA_AVAILABLE=true
    else
        echo -e "${YELLOW}⚠️  Ollama not available (skipping Ollama examples)${NC}"
        OLLAMA_AVAILABLE=false
    fi
    
    # Check Redis
    if redis-cli ping &> /dev/null; then
        echo -e "${GREEN}✓ Redis is running${NC}"
    else
        echo -e "${YELLOW}⚠️  Redis not available (parallel processing disabled)${NC}"
    fi
    
    echo ""
}

# Example 1: Basic Model Comparison
example_1_basic_comparison() {
    echo -e "${BLUE}Example 1: Basic Model Comparison${NC}"
    echo "   Comparing embedding models side-by-side"
    echo ""
    
    if [ "$OLLAMA_AVAILABLE" = true ]; then
        $EMBEDEVAL ab-test \
            --name "Ex1-Basic-Comparison" \
            --variants ollama:nomic-embed-text \
            --strategies baseline \
            --dataset ./examples/sample-queries.jsonl \
            --corpus ./examples/sample-corpus.jsonl \
            --output ./example-outputs/ex1-basic
        
        echo -e "${GREEN}   ✓ Complete${NC}"
        echo "   Results: ./example-outputs/ex1-basic/"
    else
        echo -e "${YELLOW}   Skipped (Ollama not available)${NC}"
    fi
    echo ""
}

# Example 2: Strategy Comparison
example_2_strategy_comparison() {
    echo -e "${BLUE}Example 2: Strategy Comparison${NC}"
    echo "   Testing which retrieval strategy works best"
    echo ""
    
    if [ "$OLLAMA_AVAILABLE" = true ]; then
        $EMBEDEVAL ab-test \
            --name "Ex2-Strategy-Shootout" \
            --variants ollama:nomic-embed-text \
            --strategies baseline,fixed-chunks,semantic-chunks \
            --dataset ./examples/sample-queries.jsonl \
            --corpus ./examples/sample-corpus.jsonl \
            --output ./example-outputs/ex2-strategies
        
        echo -e "${GREEN}   ✓ Complete${NC}"
        echo "   Results: ./example-outputs/ex2-strategies/"
        echo "   Compare: baseline vs fixed-chunks vs semantic-chunks"
    else
        echo -e "${YELLOW}   Skipped (Ollama not available)${NC}"
    fi
    echo ""
}

# Example 3: List Resources
example_3_list_resources() {
    echo -e "${BLUE}Example 3: List Available Resources${NC}"
    echo ""
    
    echo "   Available Strategies:"
    $EMBEDEVAL strategy --list 2>/dev/null | grep -E "^\s+\w" | head -10
    
    echo ""
    echo "   Available Providers:"
    $EMBEDEVAL providers --list 2>/dev/null | grep -E "^\s+\w" | head -5
    
    echo -e "${GREEN}   ✓ Complete${NC}"
    echo ""
}

# Example 4: Configuration File
example_4_config_file() {
    echo -e "${BLUE}Example 4: Using Configuration File${NC}"
    echo "   Running with YAML configuration"
    echo ""
    
    if [ -f "./examples/configs/production.yaml" ]; then
        echo "   Config: examples/configs/production.yaml"
        echo -e "${YELLOW}   Note: This requires API keys and Ollama${NC}"
        echo -e "${YELLOW}   Skipping actual execution${NC}"
        echo "   To run: embedeval ab-test --config ./examples/configs/production.yaml"
    else
        echo -e "${RED}   Config file not found${NC}"
    fi
    
    echo -e "${GREEN}   ✓ Complete${NC}"
    echo ""
}

# Example 5: Demo Scripts
example_5_demo_scripts() {
    echo -e "${BLUE}Example 5: Running Demo Scripts${NC}"
    echo ""
    
    echo "   Running demo-eval.js..."
    if [ -f "./scripts/demo-eval.js" ]; then
        node ./scripts/demo-eval.js 2>/dev/null | head -20
        echo "   ..."
        echo -e "${GREEN}   ✓ Demo script complete${NC}"
    else
        echo -e "${YELLOW}   Demo script not found${NC}"
    fi
    
    echo ""
    echo "   Running simulated-results.js..."
    if [ -f "./scripts/simulated-results.js" ]; then
        node ./scripts/simulated-results.js 2>/dev/null | grep -A 5 "Results Comparison"
        echo "   ..."
        echo -e "${GREEN}   ✓ Simulation complete${NC}"
    else
        echo -e "${YELLOW}   Simulation script not found${NC}"
    fi
    
    echo ""
}

# Example 6: Search HuggingFace
example_6_hf_search() {
    echo -e "${BLUE}Example 6: Search HuggingFace Models${NC}"
    echo "   Finding embedding models on HF Hub"
    echo ""
    
    echo "   Searching for 'sentence-transformers'..."
    $EMBEDEVAL huggingface --search "sentence-transformers" --limit 3 2>/dev/null || \
        echo -e "${YELLOW}   (HF search requires API key)${NC}"
    
    echo -e "${GREEN}   ✓ Complete${NC}"
    echo ""
}

# Example 7: Output Analysis
example_7_output_analysis() {
    echo -e "${BLUE}Example 7: Output Structure${NC}"
    echo "   Understanding evaluation outputs"
    echo ""
    
    echo "   Each evaluation produces:"
    echo "   📄 metrics.json          - Raw metrics (NDCG, Recall, MRR, MAP)"
    echo "   📊 dashboard.html        - Visual comparison charts"
    echo "   📝 summary.txt           - Text summary"
    echo "   📋 per-query-results.jsonl - Detailed per-query data"
    echo ""
    
    if [ -d "./example-outputs" ]; then
        echo "   Existing outputs:"
        ls -la ./example-outputs/ 2>/dev/null | tail -5
    fi
    
    echo -e "${GREEN}   ✓ Complete${NC}"
    echo ""
}

# Example 8: Advanced Configuration
example_8_advanced_config() {
    echo -e "${BLUE}Example 8: Advanced Configuration Options${NC}"
    echo ""
    
    cat << 'EOF'
   Advanced Options:
   
   1. Concurrency Control:
      embedeval ab-test --concurrency 10 ...
   
   2. Custom Metrics:
      --metrics ndcg@5,ndcg@10,recall@5,recall@10,mrr@10,map@10
   
   3. Checkpointing (for long runs):
      (enabled by default, saves progress every query)
   
   4. Cache Control:
      Set CACHE_MAX_SIZE_GB=5 to limit cache size
   
   5. Logging:
      Set LOG_LEVEL=debug for verbose output

EOF
    
    echo -e "${GREEN}   ✓ Complete${NC}"
    echo ""
}

# Main execution
main() {
    check_prerequisites
    
    echo -e "${BLUE}Running Examples...${NC}"
    echo ""
    
    example_1_basic_comparison
    example_2_strategy_comparison
    example_3_list_resources
    example_4_config_file
    example_5_demo_scripts
    example_6_hf_search
    example_7_output_analysis
    example_8_advanced_config
    
    echo "===================================="
    echo -e "${GREEN}✅ All Examples Complete!${NC}"
    echo ""
    echo "📁 Output Directory: ./example-outputs/"
    echo ""
    echo "📚 Next Steps:"
    echo "   1. View results: ls -la ./example-outputs/"
    echo "   2. Open dashboard: open ./example-outputs/*/dashboard.html"
    echo "   3. Read examples/README.md for more flows"
    echo "   4. Try with your own data!"
    echo ""
    echo "💡 Pro Tips:"
    echo "   - Start with small dataset for quick iteration"
    echo "   - Use --concurrency 1 for debugging"
    echo "   - Compare multiple runs to see trends"
    echo "   - Check examples/configs/ for templates"
}

# Run main
main

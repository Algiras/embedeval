#!/bin/bash
# Self-Improvement Workflow with AI Assistants
# This script demonstrates how Claude Code or OpenCode can automate evaluation and improvement

set -e

echo "🤖 EmbedEval Self-Improvement Workflow"
echo "======================================="
echo ""

# Configuration
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG_DIR="$PROJECT_DIR/examples/openclaw"
RESULTS_DIR="$PROJECT_DIR/results/self-improvement"
DATE=$(date +%Y-%m-%d-%H%M%S)

# Ensure directories exist
mkdir -p "$RESULTS_DIR"

echo "📊 Phase 1: Establish Baseline"
echo "-------------------------------"

# Run baseline evaluation
if [ -f "$CONFIG_DIR/openclaw-memory-eval.yaml" ]; then
    echo "Running baseline evaluation..."
    embedeval ab-test \
        --config "$CONFIG_DIR/openclaw-memory-eval.yaml" \
        --output "$RESULTS_DIR/baseline-$DATE"
    
    # Extract metrics
    if [ -f "$RESULTS_DIR/baseline-$DATE/metrics.json" ]; then
        BASELINE_NDCG=$(jq -r '.metrics.ndcg // .variants[0].metrics.ndcg' "$RESULTS_DIR/baseline-$DATE/metrics.json")
        echo "✅ Baseline NDCG@10: $BASELINE_NDCG"
    fi
else
    echo "⚠️  No baseline config found. Using default."
fi

echo ""
echo "🔬 Phase 2: Generate Improvement Hypotheses"
echo "---------------------------------------------"

# AI Assistant would analyze baseline and suggest improvements
# For now, we test a few predefined strategies

STRATEGIES=("baseline" "semantic-chunks" "hybrid-bm25")
BEST_STRATEGY=""
BEST_SCORE=0

for strategy in "${STRATEGIES[@]}"; do
    echo "Testing strategy: $strategy"
    
    # Create temporary config with this strategy
    TEMP_CONFIG="$RESULTS_DIR/temp-$strategy.yaml"
    cat > "$TEMP_CONFIG" << EOF
test:
  name: "Self-Improvement Test: $strategy"
  
variants:
  - id: test-$strategy
    name: "$strategy"
    provider:
      type: ollama
      model: nomic-embed-text
    strategy: $strategy

dataset: $PROJECT_DIR/examples/data/sample-queries.jsonl
corpus: $PROJECT_DIR/examples/data/sample-corpus.jsonl

metrics:
  - ndcg@10
  - recall@10

output:
  json: $RESULTS_DIR/$strategy-$DATE/metrics.json
EOF
    
    # Run evaluation
    if embedeval ab-test --config "$TEMP_CONFIG" --output "$RESULTS_DIR/$strategy-$DATE" 2>/dev/null; then
        # Extract score
        SCORE=$(jq -r '.metrics.ndcg // .variants[0].metrics.ndcg // 0' "$RESULTS_DIR/$strategy-$DATE/metrics.json" 2>/dev/null || echo "0")
        echo "  NDCG@10: $SCORE"
        
        # Track best
        if (( $(echo "$SCORE > $BEST_SCORE" | bc -l 2>/dev/null || echo "0") )); then
            BEST_SCORE=$SCORE
            BEST_STRATEGY=$strategy
        fi
    else
        echo "  ⚠️  Evaluation failed for $strategy"
    fi
    
    # Cleanup temp config
    rm -f "$TEMP_CONFIG"
done

echo ""
echo "🏆 Phase 3: Select Winner"
echo "--------------------------"

if [ -n "$BEST_STRATEGY" ]; then
    echo "Best strategy: $BEST_STRATEGY (NDCG@10: $BEST_SCORE)"
    
    # Calculate improvement if we have baseline
    if [ -n "$BASELINE_NDCG" ]; then
        IMPROVEMENT=$(echo "scale=4; ($BEST_SCORE - $BASELINE_NDCG) / $BASELINE_NDCG * 100" | bc 2>/dev/null || echo "0")
        echo "Improvement: ${IMPROVEMENT}%"
        
        # Check if improvement is significant (>5%)
        if (( $(echo "$IMPROVEMENT > 5" | bc -l 2>/dev/null || echo "0") )); then
            echo "✅ Significant improvement detected!"
            echo ""
            echo "🚀 Phase 4: Deploy Improvement"
            echo "-------------------------------"
            echo "Deploying $BEST_STRATEGY strategy..."
            
            # Create production config
            cp "$RESULTS_DIR/$BEST_STRATEGY-$DATE/metrics.json" "$RESULTS_DIR/deployed-$DATE.json"
            echo "✅ Deployed to: $RESULTS_DIR/deployed-$DATE.json"
            
            # Log improvement
            cat >> "$RESULTS_DIR/improvements.log" << EOF
[$(date)] Strategy: $BEST_STRATEGY | Score: $BEST_SCORE | Improvement: ${IMPROVEMENT}%
EOF
            
        else
            echo "ℹ️  Improvement not significant enough (< 5%)"
            echo "Keeping current configuration"
        fi
    fi
else
    echo "❌ No successful evaluations"
fi

echo ""
echo "📚 Phase 5: Update Knowledge Base"
echo "----------------------------------"

# Create or update knowledge base
KB_FILE="$PROJECT_DIR/.embedeval/kb.json"
mkdir -p "$(dirname "$KB_FILE")"

if [ -f "$KB_FILE" ]; then
    KB=$(cat "$KB_FILE")
else
    KB='{"experiments": [], "deployments": [], "learnings": []}'
fi

# Add this experiment
NEW_EXPERIMENT=$(cat << EOF
{
  "timestamp": "$DATE",
  "baseline_score": ${BASELINE_NDCG:-0},
  "best_strategy": "$BEST_STRATEGY",
  "best_score": ${BEST_SCORE:-0},
  "improvement_percent": ${IMPROVEMENT:-0},
  "deployed": $(if (( $(echo "${IMPROVEMENT:-0} > 5" | bc -l 2>/dev/null || echo "0") )); then echo "true"; else echo "false"; fi)
}
EOF
)

# Update KB (simplified - in production use proper JSON manipulation)
echo "$KB" | jq ".experiments += [$NEW_EXPERIMENT]" > "$KB_FILE.tmp" && mv "$KB_FILE.tmp" "$KB_FILE"
echo "✅ Knowledge base updated: $KB_FILE"

echo ""
echo "✨ Self-Improvement Complete!"
echo "============================="
echo "Results saved to: $RESULTS_DIR"
echo "Knowledge base: $KB_FILE"
echo ""
echo "Next steps:"
echo "  1. Review results: ls -la $RESULTS_DIR/"
echo "  2. Check dashboard: open $RESULTS_DIR/*/dashboard.html"
echo "  3. Run again: ./scripts/self-improvement-workflow.sh"

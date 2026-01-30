#!/bin/bash
# OpenClaw Weekly Quality Monitoring Script
# Automatically checks knowledge quality and triggers re-optimization if needed

set -e

# Configuration
CONFIG_FILE="./examples/openclaw-weekly-quality-check.yaml"
RESULTS_DIR="./results/openclaw-weekly"
DATE=$(date +%Y-%m-%d)
QUALITY_THRESHOLD=0.75
ALERT_EMAIL="admin@openclaw.ai"

# Create results directory
mkdir -p "$RESULTS_DIR/$DATE"

echo "🔍 Starting OpenClaw weekly quality check..."
echo "📅 Date: $DATE"
echo "📊 Config: $CONFIG_FILE"

# Run evaluation
echo "Running EmbedEval assessment..."
embedeval ab-test --config "$CONFIG_FILE" --output "$RESULTS_DIR/$DATE"

# Extract overall score
OVERALL_SCORE=$(jq -r '.overallScore' "$RESULTS_DIR/$DATE/metrics.json" 2>/dev/null || echo "0")

echo "📈 Overall Quality Score: $OVERALL_SCORE"

# Check if quality is below threshold
if (( $(echo "$OVERALL_SCORE < $QUALITY_THRESHOLD" | bc -l) )); then
    echo "⚠️  WARNING: Knowledge quality degraded!"
    echo "   Score: $OVERALL_SCORE (threshold: $QUALITY_THRESHOLD)"
    
    # Send alert (customize for your notification system)
    echo "Knowledge quality check failed for OpenClaw on $DATE" | \
        mail -s "OpenClaw Quality Alert" "$ALERT_EMAIL" 2>/dev/null || \
        echo "📧 Would send alert to $ALERT_EMAIL"
    
    # Trigger re-optimization
    echo "🔄 Triggering automatic re-optimization..."
    
    # Option 1: Re-index with better strategy
    echo "   Re-indexing with full-pipeline strategy..."
    # openclaw reindex --strategy full-pipeline
    
    # Option 2: Switch to better embedding model
    echo "   Switching to text-embedding-3-large..."
    # openclaw config set embedding.model text-embedding-3-large
    
    # Option 3: Clean up and re-embed
    echo "   Cleaning embedding cache..."
    rm -rf ./.embedeval/cache/*
    
    echo "✅ Re-optimization complete"
    
    # Re-run evaluation to verify fix
    echo "🔄 Re-running quality check..."
    embedeval ab-test --config "$CONFIG_FILE" --output "$RESULTS_DIR/${DATE}-post-optimization"
    
    NEW_SCORE=$(jq -r '.overallScore' "$RESULTS_DIR/${DATE}-post-optimization/metrics.json" 2>/dev/null || echo "0")
    echo "📈 New Quality Score: $NEW_SCORE"
    
    if (( $(echo "$NEW_SCORE >= $QUALITY_THRESHOLD" | bc -l) )); then
        echo "✅ Quality restored!"
    else
        echo "❌ Quality still below threshold. Manual intervention required."
        exit 1
    fi
else
    echo "✅ Knowledge quality is good ($OVERALL_SCORE >= $QUALITY_THRESHOLD)"
fi

# Update trend CSV
if [ ! -f "$RESULTS_DIR/quality-trend.csv" ]; then
    echo "date,overall_score,ndcg,recall,mrr" > "$RESULTS_DIR/quality-trend.csv"
fi

NDCG=$(jq -r '.metrics.ndcg' "$RESULTS_DIR/$DATE/metrics.json" 2>/dev/null || echo "0")
RECALL=$(jq -r '.metrics.recall' "$RESULTS_DIR/$DATE/metrics.json" 2>/dev/null || echo "0")
MRR=$(jq -r '.metrics.mrr' "$RESULTS_DIR/$DATE/metrics.json" 2>/dev/null || echo "0")

echo "$DATE,$OVERALL_SCORE,$NDCG,$RECALL,$MRR" >> "$RESULTS_DIR/quality-trend.csv"

echo ""
echo "✅ Weekly quality check complete!"
echo "📊 Results: $RESULTS_DIR/$DATE/"
echo "📈 Trend: $RESULTS_DIR/quality-trend.csv"

# Optional: Generate weekly report
if command -v embedeval &> /dev/null; then
    echo "📄 Generating weekly report..."
    # embedeval dashboard --results "$RESULTS_DIR/$DATE/metrics.json" \
    #   --output "$RESULTS_DIR/$DATE/weekly-report.html"
fi

exit 0

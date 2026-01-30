#!/bin/bash
# Quick-start script for Ollama + Gemini examples
# This helps you run the examples with your GEMINI_API_KEY

set -e

echo "🚀 EmbedEval Ollama + Gemini Quick Start"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check prerequisites
echo "📋 Checking prerequisites..."
echo ""

# Check for Ollama
if command -v ollama &> /dev/null; then
    echo -e "${GREEN}✓${NC} Ollama is installed"
else
    echo -e "${RED}✗${NC} Ollama is not installed"
    echo "   Install from: https://ollama.ai"
    exit 1
fi

# Check if Ollama is running
if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Ollama is running"
else
    echo -e "${YELLOW}!${NC} Ollama is not running"
    echo "   Starting Ollama..."
    ollama serve &
    sleep 3
    
    if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Ollama started successfully"
    else
        echo -e "${RED}✗${NC} Failed to start Ollama"
        exit 1
    fi
fi

# Check for nomic-embed-text
if ollama list | grep -q "nomic-embed-text"; then
    echo -e "${GREEN}✓${NC} nomic-embed-text model is available"
else
    echo -e "${YELLOW}!${NC} nomic-embed-text not found, pulling..."
    ollama pull nomic-embed-text
    echo -e "${GREEN}✓${NC} Model pulled successfully"
fi

# Check for GEMINI_API_KEY
if [ -n "$GEMINI_API_KEY" ]; then
    echo -e "${GREEN}✓${NC} GEMINI_API_KEY is set"
    echo "   Key: ${GEMINI_API_KEY:0:10}..."
else
    echo -e "${RED}✗${NC} GEMINI_API_KEY is not set"
    echo "   Get your key at: https://makersuite.google.com/app/apikey"
    exit 1
fi

echo ""
echo "✅ All prerequisites met!"
echo ""

# Menu
echo "Which example would you like to run?"
echo ""
echo "1) Ollama only (free, local)"
echo "2) Gemini only (fast, high quality)"
echo "3) Ollama vs Gemini (A/B comparison)"
echo "4) Run all examples"
echo "5) Exit"
echo ""

read -p "Enter your choice (1-5): " choice

case $choice in
    1)
        echo ""
        echo "🦙 Running Ollama-only evaluation..."
        echo "   This is 100% FREE and PRIVATE"
        echo ""
        embedeval ab-test --config examples/ollama-gemini/ollama-only.yaml
        echo ""
        echo -e "${GREEN}✓${NC} Complete! View results:"
        echo "   open results/ollama-only/dashboard.html"
        ;;
    
    2)
        echo ""
        echo "🔮 Running Gemini-only evaluation..."
        echo "   Cost: ~$0.0025 for 100 queries"
        echo ""
        embedeval ab-test --config examples/ollama-gemini/gemini-only.yaml
        echo ""
        echo -e "${GREEN}✓${NC} Complete! View results:"
        echo "   open results/gemini-only/dashboard.html"
        ;;
    
    3)
        echo ""
        echo "⚖️  Running Ollama vs Gemini comparison..."
        echo "   This compares both providers side-by-side"
        echo ""
        embedeval ab-test --config examples/ollama-gemini/ollama-vs-gemini.yaml
        echo ""
        echo -e "${GREEN}✓${NC} Complete! View results:"
        echo "   open results/ollama-vs-gemini/dashboard.html"
        echo ""
        echo "📊 Comparison results:"
        echo "   - Side-by-side: results/ollama-vs-gemini/comparison.html"
        echo "   - CSV data: results/ollama-vs-gemini/results.csv"
        ;;
    
    4)
        echo ""
        echo "🔄 Running all examples..."
        echo ""
        
        echo "1/3: Ollama only..."
        embedeval ab-test --config examples/ollama-gemini/ollama-only.yaml
        
        echo ""
        echo "2/3: Gemini only..."
        embedeval ab-test --config examples/ollama-gemini/gemini-only.yaml
        
        echo ""
        echo "3/3: Comparison..."
        embedeval ab-test --config examples/ollama-gemini/ollama-vs-gemini.yaml
        
        echo ""
        echo -e "${GREEN}✓${NC} All examples complete!"
        echo ""
        echo "📊 View all results:"
        echo "   Ollama:  open results/ollama-only/dashboard.html"
        echo "   Gemini:  open results/gemini-only/dashboard.html"
        echo "   Compare: open results/ollama-vs-gemini/dashboard.html"
        ;;
    
    5)
        echo ""
        echo "Goodbye! 👋"
        exit 0
        ;;
    
    *)
        echo ""
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

echo ""
echo "🎉 Done!"
echo ""
echo "Next steps:"
echo "  - Review the results in your browser"
echo "  - Compare quality, speed, and cost"
echo "  - Choose the best provider for your use case"
echo "  - Try other examples in examples/ollama-gemini/"
echo ""
echo "Need help? Open an issue: https://github.com/Algiras/embedeval/issues"

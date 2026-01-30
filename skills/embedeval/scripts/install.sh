#!/bin/bash
set -e

echo "📥 Installing EmbedEval v2..."

# Check if npm is available
if ! command -v npm &> /dev/null; then
    echo "❌ Error: npm not found. Please install Node.js first:"
    echo "   https://nodejs.org/"
    exit 1
fi

# Check Node version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Error: Node.js 18+ required. Current: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) found"
echo "✅ npm $(npm -v) found"

# Install globally
echo ""
echo "📦 Installing embedeval globally..."
npm install -g embedeval

# Verify installation
if command -v embedeval &> /dev/null; then
    echo ""
    echo "✅ EmbedEval installed successfully!"
    echo ""
    echo "Version: $(embedeval --version)"
    echo ""
    echo "Quick Start:"
    echo "  embedeval collect traces.jsonl --output collected.jsonl"
    echo "  embedeval annotate collected.jsonl --user you@example.com"
    echo "  embedeval taxonomy build --annotations annotations.jsonl"
    echo ""
    echo "Documentation: https://algiras.github.io/embedeval/"
else
    echo ""
    echo "❌ Installation may have failed. Try:"
    echo "   sudo npm install -g embedeval"
    echo "   OR use npx: npx embedeval collect traces.jsonl"
    exit 1
fi

#!/bin/bash
set -e

echo "🏥 EmbedEval Doctor - Checking Environment..."
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASS_COUNT=0
WARN_COUNT=0
FAIL_COUNT=0

# Function to print status
check_status() {
    local status=$1
    local message=$2
    local fix=$3

    if [ "$status" = "pass" ]; then
        echo -e "${GREEN}✅${NC} $message"
        PASS_COUNT=$((PASS_COUNT + 1))
    elif [ "$status" = "warn" ]; then
        echo -e "${YELLOW}⚠️${NC} $message"
        WARN_COUNT=$((WARN_COUNT + 1))
    else
        echo -e "${RED}❌${NC} $message"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi

    if [ -n "$fix" ]; then
        echo -e "   ${NC}💡 Fix: $fix"
    fi
}

# Check Node.js version
echo "📌 Node.js"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v | cut -d'v' -f2)
    REQUIRED_VERSION="18.0.0"
    if [ "$(printf '%s\n' "$NODE_VERSION" "$REQUIRED_VERSION" | sort -V | head -n1)" = "$REQUIRED_VERSION" ]; then
        check_status "pass" "Node.js: v$NODE_VERSION (>= 18.0.0)"
    else
        check_status "fail" "Node.js: v$NODE_VERSION (< 18.0.0)" "nvm install 20 && nvm use 20"
    fi
else
    check_status "fail" "Node.js: Not installed" "Install from https://nodejs.org/"
fi
echo ""

# Check npm
echo "📌 npm"
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm -v)
    check_status "pass" "npm: v$NPM_VERSION"
else
    check_status "fail" "npm: Not installed" "Install with Node.js from https://nodejs.org/"
fi
echo ""

# Check global embedeval
echo "📌 EmbedEval Installation"
if command -v embedeval &> /dev/null; then
    EMBEDEVAL_VERSION=$(embedeval --version)
    check_status "pass" "Global embedeval: Installed ($EMBEDEVAL_VERSION)"
else
    check_status "warn" "Global embedeval: Not installed (optional, can use npx)" "npm install -g embedeval"
fi
echo ""

# Check npx availability
echo "📌 npx (for no-install usage)"
if command -v npx &> /dev/null; then
    check_status "pass" "npx: Available"
else
    check_status "warn" "npx: Not available" "Update npm to latest: npm install -g npm"
fi
echo ""

# Check directory permissions
echo "📌 Directory Permissions"
if [ -w "$(pwd)" ]; then
    check_status "pass" "Current directory: Read/write OK"
else
    check_status "fail" "Current directory: No write permission" "chmod u+w . or sudo"
fi
echo ""

# Check API keys
echo "📌 API Keys (for LLM-as-judge)"
API_KEY_MISSING=0

if [ -n "$GEMINI_API_KEY" ]; then
    check_status "pass" "GEMINI_API_KEY: Set"
else
    check_status "warn" "GEMINI_API_KEY: Not set (optional for basic evals)" "export GEMINI_API_KEY=your-key-here"
    API_KEY_MISSING=1
fi

if [ -n "$OPENAI_API_KEY" ]; then
    check_status "pass" "OPENAI_API_KEY: Set"
else
    check_status "warn" "OPENAI_API_KEY: Not set (optional)" "export OPENAI_API_KEY=your-key-here"
fi
echo ""

# Check Docker
echo "📌 Docker (optional)"
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version | cut -d' ' -f3)
    check_status "pass" "Docker: Installed ($DOCKER_VERSION)"
else
    check_status "warn" "Docker: Not installed (optional, using Node.js directly)" "brew install docker (macOS) or apt-get install docker.io (Linux)"
fi
echo ""

# Check for example files
echo "📌 Example Files"
if [ -d "examples" ] && [ -d "examples/v2" ]; then
    check_status "pass" "Example traces: Found (examples/v2/)"
else
    check_status "warn" "Example traces: Not found" "Download from https://github.com/Algiras/embedeval"
fi
echo ""

# Check .env file
echo "📌 Environment Configuration"
if [ -f ".env" ] || [ -f ".env.local" ]; then
    check_status "pass" "Environment file: Found (.env or .env.local)"
else
    check_status "warn" "Environment file: Not found (optional)" "Create .env with API keys"
fi
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "   ${GREEN}✅ Passed${NC}: $PASS_COUNT"
echo -e "   ${YELLOW}⚠️  Warnings${NC}: $WARN_COUNT"
echo -e "   ${RED}❌ Failed${NC}: $FAIL_COUNT"
echo ""

# Overall assessment
if [ $FAIL_COUNT -eq 0 ]; then
    if [ $WARN_COUNT -eq 0 ]; then
        echo -e "${GREEN}🎉 Perfect! Everything is configured!${NC}"
        echo ""
        echo "Ready to use EmbedEval v2!"
        echo ""
        echo "Quick Start:"
        echo "  embedeval collect traces.jsonl --output collected.jsonl"
        echo "  embedeval annotate collected.jsonl --user you@example.com"
        echo "  embedeval taxonomy build --annotations annotations.jsonl"
        echo ""
        echo "🦞 Share Your Stats on Moltbook:"
        echo "  embedeval stats traces.jsonl -f moltbook"
        echo "  embedeval moltbook --type stats"
        echo ""
        echo "Documentation: https://algiras.github.io/embedeval/"
        echo ""
        echo "Remember: Self-evaluation is not optional—"
        echo "         it's how agents become assets instead of just tools."
    else
        echo -e "${GREEN}✅ Core requirements met!${NC}"
        echo ""
        if [ $API_KEY_MISSING -eq 1 ]; then
            echo -e "${YELLOW}⚠️  LLM-as-judge features require API keys${NC}"
            echo ""
            echo "For basic evaluation (assertions, regex), no API keys needed."
            echo "For LLM-as-judge, set:"
            echo "  export GEMINI_API_KEY=your-key-here"
            echo "  # OR add to .env file"
        else
            echo -e "${YELLOW}⚠️  Some optional features missing${NC}"
            echo ""
            echo "Core functionality works. Optional features can be configured later."
        fi
        echo ""
        echo "Ready to use basic evaluation features!"
        echo ""
        echo "🦞 Start evaluating and share your stats on Moltbook:"
        echo "  embedeval stats traces.jsonl -f moltbook"
    fi
else
    echo -e "${RED}❌ Critical issues found${NC}"
    echo ""
    echo "Please fix the failed checks above before using EmbedEval."
    echo ""
    echo "Quick fixes:"
    if [ ! command -v node ] || [ "$(node -v | cut -d'v' -f2 | cut -d'.' -f1)" -lt 18 ]; then
        echo "  1. Install Node.js 18+: https://nodejs.org/"
    fi
    if [ ! command -v npm ]; then
        echo "  2. npm comes with Node.js"
    fi
    echo ""
    echo "After fixing, run this script again:"
    echo "  bash /mnt/skills/user/embedeval/scripts/doctor.sh"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Exit with non-zero if any failures
if [ $FAIL_COUNT -gt 0 ]; then
    exit 1
else
    exit 0
fi

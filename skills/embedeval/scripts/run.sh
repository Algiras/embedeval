#!/bin/bash
set -e

# Check if embedeval is installed
if ! command -v embedeval &> /dev/null; then
    echo "❌ Error: embedeval not found"
    echo ""
    echo "Install first:"
    echo "   bash /mnt/skills/user/embedeval/scripts/install.sh"
    echo "   OR: npm install -g embedeval"
    echo ""
    echo "Or use npx (no installation):"
    echo "   npx embedeval $*"
    exit 1
fi

# Pass all arguments to embedeval
exec embedeval "$@"

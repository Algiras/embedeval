#!/bin/bash

# EmbedEval Installation Script
# Supports: macOS, Linux
# Install methods: npm, curl, wget

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REPO="Algiras/embedeval"
INSTALL_DIR="/usr/local/bin"
BIN_NAME="embedeval"

# Detect OS
OS=$(uname -s)
ARCH=$(uname -m)

echo -e "${BLUE}🔧 EmbedEval Installer${NC}"
echo "======================"
echo ""

# Check if already installed
check_existing() {
  if command -v $BIN_NAME &> /dev/null; then
    echo -e "${YELLOW}⚠️  EmbedEval is already installed${NC}"
    $BIN_NAME --version
    echo ""
    read -p "Do you want to reinstall/upgrade? (y/N) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      echo -e "${GREEN}✓ Keeping existing installation${NC}"
      exit 0
    fi
  fi
}

# Install via npm
install_npm() {
  echo -e "${BLUE}📦 Installing via npm...${NC}"
  
  if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not installed${NC}"
    echo "   Please install Node.js first: https://nodejs.org/"
    exit 1
  fi
  
  echo "   Installing embedeval globally..."
  npm install -g embedeval
  
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Successfully installed via npm${NC}"
    echo ""
    $BIN_NAME --version
  else
    echo -e "${RED}❌ npm installation failed${NC}"
    exit 1
  fi
}

# Install from source
install_source() {
  echo -e "${BLUE}🔨 Installing from source...${NC}"
  
  if ! command -v git &> /dev/null; then
    echo -e "${RED}❌ git is not installed${NC}"
    exit 1
  fi
  
  if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not installed${NC}"
    echo "   Please install Node.js first: https://nodejs.org/"
    exit 1
  fi
  
  # Create temp directory
  TEMP_DIR=$(mktemp -d)
  cd $TEMP_DIR
  
  echo "   Cloning repository..."
  git clone https://github.com/$REPO.git
  cd embedeval
  
  echo "   Installing dependencies..."
  npm install
  
  echo "   Building..."
  npm run build
  
  echo "   Installing globally..."
  npm link
  
  # Cleanup
  cd /
  rm -rf $TEMP_DIR
  
  echo -e "${GREEN}✓ Successfully installed from source${NC}"
  echo ""
  $BIN_NAME --version
}

# Check prerequisites
check_prerequisites() {
  echo -e "${BLUE}🔍 Checking prerequisites...${NC}"
  
  local missing=()
  
  if ! command -v node &> /dev/null; then
    missing+=("Node.js")
  else
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
      echo -e "${YELLOW}⚠️  Node.js version is too old (need >= 18)${NC}"
      missing+=("Node.js >= 18")
    fi
  fi
  
  if ! command -v git &> /dev/null; then
    missing+=("git")
  fi
  
  if [ ${#missing[@]} -gt 0 ]; then
    echo -e "${RED}❌ Missing prerequisites:${NC}"
    for item in "${missing[@]}"; do
      echo "   - $item"
    done
    echo ""
    echo "Please install the missing prerequisites and try again."
    exit 1
  fi
  
  echo -e "${GREEN}✓ All prerequisites met${NC}"
  echo ""
}

# Main installation
main() {
  check_existing
  check_prerequisites
  
  echo "Choose installation method:"
  echo "   1) npm (recommended - fastest)"
  echo "   2) From source (latest development version)"
  echo ""
  read -p "Enter choice [1-2]: " choice
  echo ""
  
  case $choice in
    1)
      install_npm
      ;;
    2)
      install_source
      ;;
    *)
      echo -e "${RED}❌ Invalid choice${NC}"
      exit 1
      ;;
  esac
  
  echo ""
  echo -e "${GREEN}🎉 Installation complete!${NC}"
  echo ""
  echo "Quick start:"
  echo "   $BIN_NAME --help"
  echo "   $BIN_NAME providers --list"
  echo "   $BIN_NAME strategy --list"
  echo ""
  echo "Documentation: https://github.com/$REPO#readme"
}

# Run main function
main

#!/bin/bash
set -e

# EmbedEval v2 Install Script
# Usage: curl -fsSL https://raw.githubusercontent.com/Algiras/embedeval/main/install.sh | bash

REPO="Algiras/embedeval"
BINARY_NAME="embedeval"
INSTALL_DIR="/usr/local/bin"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

print_banner() {
    echo -e "${BLUE}${BOLD}"
    echo "╔══════════════════════════════════════════════════╗"
    echo "║                                                  ║"
    echo "║      🚀 EmbedEval v2 - Binary LLM Evals         ║"
    echo "║                                                  ║"
    echo "║         Quick Install Script                     ║"
    echo "║                                                  ║"
    echo "╚══════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo ""
}

detect_platform() {
    local platform
    platform=$(uname -s)
    case "$platform" in
        Linux*)     echo "linux";;
        Darwin*)    echo "darwin";;
        CYGWIN*)    echo "windows";;
        MINGW*)     echo "windows";;
        MSYS*)      echo "windows";;
        *)          echo "unknown"
    esac
}

detect_arch() {
    local arch
    arch=$(uname -m)
    case "$arch" in
        x86_64)     echo "amd64";;
        amd64)      echo "amd64";;
        arm64)      echo "arm64";;
        aarch64)    echo "arm64";;
        i386)       echo "386";;
        i686)       echo "386";;
        *)          echo "unknown"
    esac
}

check_requirements() {
    echo -e "${CYAN}${BOLD}→ Checking system requirements...${NC}"
    
    # Check for curl or wget
    if command -v curl &> /dev/null; then
        DOWNLOADER="curl"
        echo -e "${GREEN}✅ curl found${NC}"
    elif command -v wget &> /dev/null; then
        DOWNLOADER="wget"
        echo -e "${GREEN}✅ wget found${NC}"
    else
        echo -e "${RED}❌ Error: Neither curl nor wget found${NC}"
        echo "   Please install curl or wget and try again"
        exit 1
    fi
    
    # Check for tar
    if ! command -v tar &> /dev/null; then
        echo -e "${RED}❌ Error: tar not found${NC}"
        exit 1
    fi
    
    echo ""
}

install_via_npm() {
    echo -e "${CYAN}${BOLD}→ Installing via npm...${NC}"
    
    # Check if npm is available
    if ! command -v npm &> /dev/null; then
        echo -e "${RED}❌ Error: npm not found${NC}"
        echo ""
        echo "   Install Node.js first: https://nodejs.org/"
        echo "   Or use a package manager:"
        echo "     macOS: brew install node"
        echo "     Ubuntu/Debian: sudo apt-get install nodejs npm"
        echo "     Fedora: sudo dnf install nodejs npm"
        echo ""
        return 1
    fi
    
    echo -e "${GREEN}✅ npm found: $(npm --version)${NC}"
    
    # Try global install
    if npm install -g embedeval 2>&1 | tee /tmp/npm-install.log; then
        echo ""
        echo -e "${GREEN}${BOLD}✅ Successfully installed via npm!${NC}"
        return 0
    else
        echo ""
        echo -e "${YELLOW}⚠️  Global install failed, trying with sudo...${NC}"
        if sudo npm install -g embedeval 2>&1 | tee /tmp/npm-install.log; then
            echo ""
            echo -e "${GREEN}${BOLD}✅ Successfully installed via npm (with sudo)!${NC}"
            return 0
        fi
    fi
    
    return 1
}

install_binary() {
    local platform=$1
    local arch=$2
    
    echo -e "${CYAN}${BOLD}→ Installing binary for ${platform}/${arch}...${NC}"
    
    # Get latest release
    echo "   Fetching latest release..."
    local latest_version
    if [ "$DOWNLOADER" = "curl" ]; then
        latest_version=$(curl -s "https://api.github.com/repos/${REPO}/releases/latest" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')
    else
        latest_version=$(wget -qO- "https://api.github.com/repos/${REPO}/releases/latest" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')
    fi
    
    if [ -z "$latest_version" ]; then
        echo -e "${YELLOW}⚠️  Could not fetch latest version, falling back to npm${NC}"
        return 1
    fi
    
    echo -e "${GREEN}✅ Latest version: ${latest_version}${NC}"
    
    # For now, binary releases aren't available, so use npm
    echo -e "${YELLOW}⚠️  Binary release not available yet, using npm instead${NC}"
    return 1
}

verify_installation() {
    echo ""
    echo -e "${CYAN}${BOLD}→ Verifying installation...${NC}"
    
    if command -v embedeval &> /dev/null; then
        local version
        version=$(embedeval --version)
        echo -e "${GREEN}${BOLD}✅ EmbedEval v${version} installed successfully!${NC}"
        echo ""
        echo -e "${PURPLE}${BOLD}🎉 Installation complete!${NC}"
        echo ""
        echo -e "${CYAN}Quick start:${NC}"
        echo "  embedeval --help              # Show help"
        echo "  embedeval collect traces.jsonl --output collected.jsonl"
        echo "  embedeval annotate collected.jsonl --user you@example.com"
        echo "  embedeval taxonomy build --annotations annotations.jsonl"
        echo ""
        echo -e "${CYAN}Documentation:${NC}"
        echo "  📖 Getting Started: https://github.com/${REPO}/blob/main/GETTING_STARTED.md"
        echo "  🌐 Website: https://algiras.github.io/embedeval/"
        echo "  📦 NPM: https://www.npmjs.com/package/embedeval"
        echo ""
        return 0
    else
        echo -e "${RED}❌ Installation verification failed${NC}"
        echo "   embedeval command not found in PATH"
        return 1
    fi
}

main() {
    print_banner
    
    # Detect platform
    PLATFORM=$(detect_platform)
    ARCH=$(detect_arch)
    
    echo -e "${CYAN}${BOLD}Platform:${NC} ${PLATFORM}"
    echo -e "${CYAN}${BOLD}Architecture:${NC} ${ARCH}"
    echo ""
    
    # Check requirements
    check_requirements
    
    # Try binary install first, fall back to npm
    if install_binary "$PLATFORM" "$ARCH"; then
        verify_installation
    else
        echo -e "${CYAN}${BOLD}→ Trying npm installation...${NC}"
        if install_via_npm; then
            verify_installation
        else
            echo ""
            echo -e "${RED}${BOLD}❌ Installation failed${NC}"
            echo ""
            echo "Troubleshooting:"
            echo "  1. Ensure you have Node.js 18+ installed"
            echo "  2. Try: sudo npm install -g embedeval"
            echo "  3. Or use npx: npx embedeval --help"
            echo ""
            echo "For help, visit: https://github.com/${REPO}/issues"
            exit 1
        fi
    fi
}

# Run main function
main "$@"

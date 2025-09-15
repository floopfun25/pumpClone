#!/bin/bash
# Production Deployment Setup Script
# Run this once to set up your development environment

set -e

echo "🚀 Setting up Production Deployment Environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running on Windows
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    echo -e "${YELLOW}Windows detected. Installing for Windows...${NC}"
    WINDOWS=true
else
    echo -e "${GREEN}Unix-like system detected...${NC}"
    WINDOWS=false
fi

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Install Rust
echo -e "${YELLOW}Checking Rust installation...${NC}"
if ! command_exists rustc; then
    echo -e "${YELLOW}Installing Rust...${NC}"
    if $WINDOWS; then
        echo "Please download and run: https://win.rustup.rs/x86_64"
        echo "Then restart this script."
        exit 1
    else
        curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
        source ~/.cargo/env
    fi
else
    echo -e "${GREEN}✓ Rust is installed${NC}"
fi

# Install Solana CLI
echo -e "${YELLOW}Checking Solana CLI installation...${NC}"
if ! command_exists solana; then
    echo -e "${YELLOW}Installing Solana CLI...${NC}"
    if $WINDOWS; then
        echo "Please run in PowerShell as Administrator:"
        echo 'curl https://release.solana.com/v1.18.17/solana-install-init-x86_64-pc-windows-msvc.exe --output C:\solana-installer.exe'
        echo 'C:\solana-installer.exe v1.18.17'
        echo "Then restart this script."
        exit 1
    else
        sh -c "$(curl -sSfL https://release.solana.com/v1.18.17/install)"
        export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
    fi
else
    echo -e "${GREEN}✓ Solana CLI is installed${NC}"
fi

# Install Anchor CLI
echo -e "${YELLOW}Checking Anchor CLI installation...${NC}"
if ! command_exists anchor; then
    echo -e "${YELLOW}Installing Anchor CLI...${NC}"
    cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
    avm install latest
    avm use latest
else
    echo -e "${GREEN}✓ Anchor CLI is installed${NC}"
fi

echo -e "${GREEN}🎉 Development environment setup complete!${NC}"
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Run 'source ~/.cargo/env' or restart your terminal"
echo "2. Run './deploy/configure.sh' to configure for production"
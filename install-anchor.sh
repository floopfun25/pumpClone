#!/bin/bash

# Anchor CLI Installation Script for macOS
# This script installs Rust, Solana CLI, and Anchor CLI

set -e

echo "🚀 Installing Solana/Anchor Development Environment..."
echo ""

# 1. Install Rust
echo "📦 Step 1/4: Installing Rust..."
if ! command -v rustc &> /dev/null; then
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"
    echo "✅ Rust installed successfully"
else
    echo "✅ Rust already installed ($(rustc --version))"
fi

# 2. Install Solana CLI
echo ""
echo "📦 Step 2/4: Installing Solana CLI..."
if ! command -v solana &> /dev/null; then
    sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
    export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
    echo "✅ Solana CLI installed successfully"
else
    echo "✅ Solana CLI already installed ($(solana --version))"
fi

# 3. Install Anchor Version Manager (AVM)
echo ""
echo "📦 Step 3/4: Installing Anchor Version Manager (AVM)..."
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force

# 4. Install Anchor CLI via AVM
echo ""
echo "📦 Step 4/4: Installing Anchor CLI v0.30.1..."
avm install 0.30.1
avm use 0.30.1

echo ""
echo "✅ Installation Complete!"
echo ""
echo "📝 Next steps:"
echo "1. Close and reopen your terminal (or run: source ~/.zshrc)"
echo "2. Verify installation: anchor --version"
echo "3. Build the program: anchor build"
echo "4. Deploy to devnet: anchor deploy --provider.cluster devnet"
echo ""

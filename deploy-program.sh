#!/bin/bash

# FloppFun Solana Program Deployment Script
# This script will install Solana CLI and deploy your bonding curve program

echo "🚀 Starting FloppFun Solana Program Deployment..."

# Step 1: Install Solana CLI
echo "📦 Installing Solana CLI..."
curl -sSfL https://release.solana.com/v1.18.22/install | sh

# Add Solana to PATH for current session
echo "🔧 Adding Solana to PATH..."
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

# Verify installation
echo "✅ Verifying Solana CLI installation..."
solana --version

# Step 2: Create keypair for deployment (if not exists)
echo "🔑 Setting up deployment keypair..."
if [ ! -f ~/.config/solana/id.json ]; then
    echo "Creating new keypair..."
    solana-keygen new --outfile ~/.config/solana/id.json --no-bip39-passphrase
else
    echo "Using existing keypair..."
fi

# Step 3: Configure for devnet first
echo "🌐 Configuring for devnet..."
solana config set --url devnet
solana config set --keypair ~/.config/solana/id.json

# Show current configuration
echo "📋 Current Solana configuration:"
solana config get

# Step 4: Check/Request devnet SOL
echo "💰 Checking SOL balance..."
BALANCE=$(solana balance --output json | jq -r '.value')
echo "Current balance: $BALANCE SOL"

if (( $(echo "$BALANCE < 5" | bc -l) )); then
    echo "❗ Insufficient SOL for deployment. Requesting airdrop..."
    solana airdrop 5
    
    # Wait for airdrop to complete
    echo "⏳ Waiting for airdrop to complete..."
    sleep 10
    
    # Check balance again
    NEW_BALANCE=$(solana balance --output json | jq -r '.value')
    echo "New balance: $NEW_BALANCE SOL"
fi

# Step 5: Build the program
echo "🔨 Building bonding curve program..."
cd programs/bonding-curve

# Install Rust if not installed
if ! command -v rustc &> /dev/null; then
    echo "📦 Installing Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source ~/.cargo/env
fi

# Add Solana toolchain
rustup component add rust-src
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install latest
avm use latest

# Build the program
echo "🔧 Building program..."
cargo build-bpf

# Step 6: Deploy to devnet
echo "🚀 Deploying to devnet..."
PROGRAM_ID=$(solana program deploy target/deploy/bonding_curve.so --output json | jq -r '.programId')

if [ "$PROGRAM_ID" != "null" ] && [ -n "$PROGRAM_ID" ]; then
    echo "✅ Program deployed successfully!"
    echo "📍 Program ID: $PROGRAM_ID"
    
    # Save program ID to file
    echo "$PROGRAM_ID" > deployed-program-id.txt
    
    # Create environment variable update
    echo ""
    echo "🔧 Add this to your .env file:"
    echo "VITE_DEVNET_BONDING_CURVE_PROGRAM=$PROGRAM_ID"
    echo ""
    
    # Create fee wallet
    echo "💳 Creating fee wallet..."
    solana-keygen new --outfile fee-wallet.json --no-bip39-passphrase
    FEE_WALLET=$(solana-keygen pubkey fee-wallet.json)
    
    echo "💰 Fee wallet created: $FEE_WALLET"
    echo "Add this to your .env file:"
    echo "VITE_DEVNET_FEE_WALLET=$FEE_WALLET"
    
    # Fund fee wallet
    echo "💸 Funding fee wallet..."
    solana transfer 1 $FEE_WALLET
    
    echo ""
    echo "🎉 Deployment complete!"
    echo "📋 Next steps:"
    echo "1. Update your src/config/index.ts with the program ID"
    echo "2. Replace simulation code with real transactions"
    echo "3. Test on devnet before mainnet deployment"
    
else
    echo "❌ Deployment failed!"
    echo "Check the logs above for errors"
    exit 1
fi 
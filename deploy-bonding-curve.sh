#!/bin/bash

# FloppFun Bonding Curve Program Deployment Script
# This script deploys the bonding curve program to Solana devnet

echo "🚀 Starting FloppFun Bonding Curve Program Deployment..."

# Check if we're in the right directory
if [ ! -f "Anchor.toml" ]; then
    echo "❌ Error: Anchor.toml not found. Please run this from the project root."
    exit 1
fi

# Check if anchor CLI is installed
if ! command -v anchor &> /dev/null; then
    echo "❌ Error: Anchor CLI is not installed."
    echo "📥 Install with: npm install -g @project-serum/anchor-cli"
    exit 1
fi

# Check if solana CLI is installed
if ! command -v solana &> /dev/null; then
    echo "❌ Error: Solana CLI is not installed."
    echo "📥 Install from: https://docs.solana.com/cli/install-solana-cli-tools"
    exit 1
fi

# Set network to devnet
echo "🌐 Setting network to devnet..."
solana config set --url devnet

# Check wallet balance
echo "💰 Checking wallet balance..."
BALANCE=$(solana balance --output json | jq -r '.value')
if (( $(echo "$BALANCE < 10" | bc -l) )); then
    echo "💸 Low balance: ${BALANCE} SOL"
    echo "🪂 Requesting airdrop..."
    solana airdrop 10
    sleep 5
fi

# Build the program
echo "🔨 Building bonding curve program..."
if ! anchor build; then
    echo "❌ Build failed!"
    exit 1
fi

# Get the program ID from the built program
PROGRAM_ID=$(solana address -k target/deploy/bonding_curve-keypair.json)
echo "📄 Program ID: $PROGRAM_ID"

# Update Anchor.toml with the actual program ID
echo "📝 Updating Anchor.toml with program ID..."
sed -i.bak "s/bonding_curve = \".*\"/bonding_curve = \"$PROGRAM_ID\"/" Anchor.toml

# Deploy the program
echo "🚀 Deploying program to devnet..."
if ! anchor deploy --provider.cluster devnet; then
    echo "❌ Deployment failed!"
    exit 1
fi

# Verify deployment
echo "✅ Verifying deployment..."
solana program show $PROGRAM_ID --output json

# Update environment configuration
echo "🔧 Updating environment configuration..."

# Create updated devnet config
cat > devnet-config-updated.env << EOF
# FloppFun Devnet Configuration (Updated with deployed program)
# Copy this to .env.local to use

# Solana Network
VITE_SOLANA_NETWORK=devnet
VITE_DEVNET_RPC_URL=https://api.devnet.solana.com

# FloppFun Deployed Programs
VITE_DEVNET_BONDING_CURVE_PROGRAM=$PROGRAM_ID
VITE_DEVNET_TOKEN_FACTORY_PROGRAM=TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA
VITE_METADATA_PROGRAM=metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s

# Platform Wallets
VITE_DEVNET_FEE_WALLET=J3X42Cu4XAFHjbLYVjDCYXwigegrZkyfDZUtTMxedqkZ
VITE_DEVNET_AUTHORITY=J3X42Cu4XAFHjbLYVjDCYXwigegrZkyfDZUtTMxedqkZ
VITE_DEVNET_TREASURY=J3X42Cu4XAFHjbLYVjDCYXwigegrZkyfDZUtTMxedqkZ
VITE_DEVNET_FEE_COLLECTOR=J3X42Cu4XAFHjbLYVjDCYXwigegrZkyfDZUtTMxedqkZ

# Supabase
VITE_SUPABASE_URL=https://osqniqjbbenjmhehoykv.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9zcW5pcWpiYmVuam1oZWhveWt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg1NDM5NzYsImV4cCI6MjA2NDExOTk3Nn0.hHkHKivLHqOx4Ne9Bn9BOb6dAsCh_StBJ0YHGw0qwOc

# App Environment  
VITE_APP_ENV=production
NODE_ENV=production
EOF

echo "✅ Deployment completed successfully!"
echo ""
echo "📋 Next Steps:"
echo "1. Copy devnet-config-updated.env to .env.local:"
echo "   cp devnet-config-updated.env .env.local"
echo ""
echo "2. Update your frontend configuration to use the new program ID:"
echo "   Program ID: $PROGRAM_ID"
echo ""
echo "3. Restart your development server:"
echo "   npm run dev"
echo ""
echo "🎉 Your bonding curve program is now deployed and ready to use!"
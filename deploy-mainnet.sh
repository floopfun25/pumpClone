#!/bin/bash

# ===========================================
# MAINNET DEPLOYMENT SCRIPT
# ===========================================
# This script deploys your pump.fun clone to Solana mainnet
# Run this in GitHub Codespaces or a Linux environment

set -e

echo "🚀 Starting Mainnet Deployment for FloppFun"
echo "==========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "Anchor.toml" ]; then
    echo -e "${RED}❌ Error: Anchor.toml not found. Run this script from your project root.${NC}"
    exit 1
fi

# Check if we have a keypair for deployment
if [ ! -f ~/.config/solana/id.json ]; then
    echo -e "${YELLOW}⚠️  No Solana keypair found. Generating one...${NC}"
    solana-keygen new --outfile ~/.config/solana/id.json
    echo -e "${YELLOW}💰 Please fund this wallet with SOL for deployment: $(solana address)${NC}"
    echo -e "${YELLOW}📋 You need approximately 10-15 SOL for deployment and testing${NC}"
    read -p "Press Enter when you've funded the wallet..."
fi

echo -e "${GREEN}✅ Deployment wallet: $(solana address)${NC}"

# Set Solana config to mainnet
echo "🌐 Configuring Solana CLI for mainnet..."
solana config set --url mainnet-beta
solana config set --keypair ~/.config/solana/id.json

# Check wallet balance
BALANCE=$(solana balance --lamports)
MIN_BALANCE=10000000000  # 10 SOL in lamports

if [ "$BALANCE" -lt "$MIN_BALANCE" ]; then
    echo -e "${RED}❌ Insufficient balance. You have $(solana balance), need at least 10 SOL${NC}"
    echo -e "${YELLOW}💰 Fund your wallet: $(solana address)${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Wallet balance: $(solana balance)${NC}"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build the Anchor program
echo "🔨 Building Anchor program..."
anchor build

# Generate program keypair if it doesn't exist
PROGRAM_KEYPAIR="target/deploy/bonding_curve-keypair.json"
if [ ! -f "$PROGRAM_KEYPAIR" ]; then
    echo "🔑 Generating program keypair..."
    solana-keygen new --outfile "$PROGRAM_KEYPAIR" --no-bip39-passphrase
fi

PROGRAM_ID=$(solana-keygen pubkey "$PROGRAM_KEYPAIR")
echo -e "${GREEN}🆔 Program ID: $PROGRAM_ID${NC}"

# Update Anchor.toml with the correct program ID
echo "📝 Updating Anchor.toml with program ID..."
sed -i "s/bonding_curve = \".*\"/bonding_curve = \"$PROGRAM_ID\"/" Anchor.toml

# Rebuild with correct program ID
echo "🔨 Rebuilding with correct program ID..."
anchor build

# Deploy the program
echo "🚀 Deploying program to mainnet..."
anchor deploy --provider.cluster mainnet

# Verify deployment
echo "✅ Verifying deployment..."
solana program show "$PROGRAM_ID"

# Generate production wallets
echo "🔐 Generating production wallets..."
mkdir -p wallets

# Fee wallet
if [ ! -f "wallets/fee-wallet.json" ]; then
    solana-keygen new --outfile wallets/fee-wallet.json --no-bip39-passphrase
fi
FEE_WALLET=$(solana-keygen pubkey wallets/fee-wallet.json)

# Authority wallet
if [ ! -f "wallets/authority-wallet.json" ]; then
    solana-keygen new --outfile wallets/authority-wallet.json --no-bip39-passphrase
fi
AUTHORITY_WALLET=$(solana-keygen pubkey wallets/authority-wallet.json)

# Treasury wallet
if [ ! -f "wallets/treasury-wallet.json" ]; then
    solana-keygen new --outfile wallets/treasury-wallet.json --no-bip39-passphrase
fi
TREASURY_WALLET=$(solana-keygen pubkey wallets/treasury-wallet.json)

# Create production environment file
echo "📋 Creating production environment configuration..."
cat > .env.mainnet << EOF
# PRODUCTION MAINNET CONFIGURATION
# Generated on $(date)

VITE_APP_ENV=production
NODE_ENV=production
VITE_SOLANA_NETWORK=mainnet

# Your deployed program
VITE_MAINNET_BONDING_CURVE_PROGRAM=$PROGRAM_ID

# Production wallets
VITE_MAINNET_FEE_WALLET=$FEE_WALLET
VITE_MAINNET_AUTHORITY=$AUTHORITY_WALLET
VITE_MAINNET_TREASURY=$TREASURY_WALLET
VITE_MAINNET_FEE_COLLECTOR=$FEE_WALLET

# Mainnet RPC
VITE_MAINNET_RPC_URL=https://api.mainnet-beta.solana.com

# Other configurations (copy from .env.production)
$(grep -E "^VITE_SUPABASE|^VITE_PINATA|^VITE_PLATFORM_FEE|^VITE_VIRTUAL|^VITE_GRADUATION|^VITE_SOL_MINT|^VITE_USDC_MINT|^VITE_METADATA_PROGRAM|^VITE_.*TOKEN_FACTORY" .env.production || echo "")
EOF

# Fund production wallets with minimal SOL for rent exemption
echo "💰 Funding production wallets..."
solana transfer "$FEE_WALLET" 0.01 --allow-unfunded-recipient
solana transfer "$AUTHORITY_WALLET" 0.01 --allow-unfunded-recipient
solana transfer "$TREASURY_WALLET" 0.01 --allow-unfunded-recipient

echo ""
echo -e "${GREEN}🎉 DEPLOYMENT SUCCESSFUL!${NC}"
echo "==========================================="
echo -e "${GREEN}Program ID: $PROGRAM_ID${NC}"
echo -e "${GREEN}Fee Wallet: $FEE_WALLET${NC}"
echo -e "${GREEN}Authority: $AUTHORITY_WALLET${NC}"
echo -e "${GREEN}Treasury: $TREASURY_WALLET${NC}"
echo ""
echo -e "${YELLOW}📋 Next Steps:${NC}"
echo "1. Update your frontend with .env.mainnet configuration"
echo "2. Build your frontend: npm run build"
echo "3. Test with small amounts before full launch"
echo "4. Set up monitoring and alerts"
echo ""
echo -e "${RED}🔒 SECURITY REMINDER:${NC}"
echo "- Backup your wallet files in wallets/ directory"
echo "- Never commit private keys to git"
echo "- Use hardware wallets for large amounts"
echo ""
echo -e "${GREEN}🌐 Your pump.fun clone is now live on Solana mainnet!${NC}"
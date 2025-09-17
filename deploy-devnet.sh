#!/bin/bash

# ===========================================
# DEVNET DEPLOYMENT SCRIPT
# ===========================================
# Deploy your pump.fun clone to Solana devnet for testing

set -e

echo "🧪 Starting DEVNET Deployment for Testing"
echo "========================================="

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
    echo -e "${YELLOW}💰 Please get devnet SOL: solana airdrop 5 $(solana address)${NC}"
    echo -e "${YELLOW}📋 You can also use: https://faucet.solana.com${NC}"
    read -p "Press Enter when you've got devnet SOL..."
fi

echo -e "${GREEN}✅ Deployment wallet: $(solana address)${NC}"

# Set Solana config to devnet
echo "🌐 Configuring Solana CLI for devnet..."
solana config set --url devnet
solana config set --keypair ~/.config/solana/id.json

# Airdrop devnet SOL if needed
echo "💰 Requesting devnet SOL..."
solana airdrop 5 || echo "Airdrop failed, continuing..."

# Check wallet balance
BALANCE=$(solana balance --lamports)
MIN_BALANCE=1000000000  # 1 SOL in lamports

if [ "$BALANCE" -lt "$MIN_BALANCE" ]; then
    echo -e "${YELLOW}⚠️  Low balance: $(solana balance)${NC}"
    echo -e "${YELLOW}💰 Get more devnet SOL: https://faucet.solana.com${NC}"
    echo -e "${YELLOW}Or run: solana airdrop 5${NC}"
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

# Update Anchor.toml with the correct program ID for devnet
echo "📝 Updating Anchor.toml with program ID..."
sed -i "s/bonding_curve = \".*\"/bonding_curve = \"$PROGRAM_ID\"/" Anchor.toml

# Rebuild with correct program ID
echo "🔨 Rebuilding with correct program ID..."
anchor build

# Deploy the program to devnet
echo "🚀 Deploying program to devnet..."
anchor deploy --provider.cluster devnet

# Verify deployment
echo "✅ Verifying deployment..."
solana program show "$PROGRAM_ID" --url devnet

# Generate test wallets for devnet
echo "🔐 Generating devnet test wallets..."
mkdir -p devnet-wallets

# Fee wallet
if [ ! -f "devnet-wallets/fee-wallet.json" ]; then
    solana-keygen new --outfile devnet-wallets/fee-wallet.json --no-bip39-passphrase
fi
FEE_WALLET=$(solana-keygen pubkey devnet-wallets/fee-wallet.json)

# Authority wallet
if [ ! -f "devnet-wallets/authority-wallet.json" ]; then
    solana-keygen new --outfile devnet-wallets/authority-wallet.json --no-bip39-passphrase
fi
AUTHORITY_WALLET=$(solana-keygen pubkey devnet-wallets/authority-wallet.json)

# Treasury wallet
if [ ! -f "devnet-wallets/treasury-wallet.json" ]; then
    solana-keygen new --outfile devnet-wallets/treasury-wallet.json --no-bip39-passphrase
fi
TREASURY_WALLET=$(solana-keygen pubkey devnet-wallets/treasury-wallet.json)

# Create devnet environment file
echo "📋 Creating devnet environment configuration..."
cat > .env.devnet << EOF
# DEVNET TESTING CONFIGURATION
# Generated on $(date)

VITE_APP_ENV=development
NODE_ENV=development
VITE_SOLANA_NETWORK=devnet

# Your deployed program on devnet
VITE_DEVNET_BONDING_CURVE_PROGRAM=$PROGRAM_ID

# Devnet test wallets
VITE_DEVNET_FEE_WALLET=$FEE_WALLET
VITE_DEVNET_AUTHORITY=$AUTHORITY_WALLET
VITE_DEVNET_TREASURY=$TREASURY_WALLET
VITE_DEVNET_FEE_COLLECTOR=$FEE_WALLET

# Devnet RPC
VITE_DEVNET_RPC_URL=https://api.devnet.solana.com

# Copy from existing .env for other settings
$(grep -E "^VITE_SUPABASE|^VITE_PINATA|^VITE_PLATFORM_FEE|^VITE_VIRTUAL|^VITE_GRADUATION|^VITE_SOL_MINT|^VITE_USDC_MINT|^VITE_METADATA_PROGRAM|^VITE_.*TOKEN_FACTORY" .env || echo "")
EOF

# Fund devnet wallets with SOL for testing
echo "💰 Funding devnet wallets..."
solana transfer "$FEE_WALLET" 0.1 --allow-unfunded-recipient --url devnet
solana transfer "$AUTHORITY_WALLET" 0.1 --allow-unfunded-recipient --url devnet
solana transfer "$TREASURY_WALLET" 0.1 --allow-unfunded-recipient --url devnet

echo ""
echo -e "${GREEN}🎉 DEVNET DEPLOYMENT SUCCESSFUL!${NC}"
echo "==========================================="
echo -e "${GREEN}Program ID: $PROGRAM_ID${NC}"
echo -e "${GREEN}Fee Wallet: $FEE_WALLET${NC}"
echo -e "${GREEN}Authority: $AUTHORITY_WALLET${NC}"
echo -e "${GREEN}Treasury: $TREASURY_WALLET${NC}"
echo ""
echo -e "${YELLOW}📋 Next Steps for Testing:${NC}"
echo "1. Copy .env.devnet to .env.local: cp .env.devnet .env.local"
echo "2. Start your frontend: npm run dev"
echo "3. Test token creation with devnet SOL"
echo "4. Test buy/sell functionality"
echo "5. Once everything works, deploy to mainnet!"
echo ""
echo -e "${GREEN}🧪 Your pump.fun clone is now live on Solana devnet for testing!${NC}"
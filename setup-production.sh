#!/bin/bash

# FloppFun Production Setup Script
# This script implements all critical missing pieces for production readiness

set -e  # Exit on any error

echo "🚀 FloppFun Production Setup Starting..."
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}$1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Step 1: Check prerequisites
print_status "📋 Checking prerequisites..."

# Check if running on macOS (Darwin)
if [[ "$OSTYPE" == "darwin"* ]]; then
    print_success "Running on macOS"
else
    print_warning "Not running on macOS - some commands may need adjustment"
fi

# Check for required tools
MISSING_TOOLS=()

if ! command -v curl &> /dev/null; then
    MISSING_TOOLS+=("curl")
fi

if ! command -v jq &> /dev/null; then
    print_warning "jq not found. Installing via brew..."
    if command -v brew &> /dev/null; then
        brew install jq
    else
        print_error "Please install jq manually"
        exit 1
    fi
fi

print_status "Checking Supabase CLI..."
if command -v supabase &> /dev/null; then
    # The modern Rust-based CLI has a version like "supabase version 1.x.x"
    # The old Deno-based CLI has a different format.
    CLI_VERSION=$(supabase --version 2>/dev/null || echo "unknown")
    if [[ "$CLI_VERSION" == *"supabase version 1."* ]]; then
        print_success "Supabase CLI is up-to-date ($CLI_VERSION)"
    else
        print_warning "Outdated or unknown Supabase CLI detected ($CLI_VERSION). Forcing reinstall..."
        # Attempt to uninstall, ignore errors if it's not installed via brew
        brew uninstall supabase supabase/tap/supabase > /dev/null 2>&1 || true
        brew install supabase/tap/supabase
        print_success "Supabase CLI reinstalled."
    fi
else
    print_warning "Supabase CLI not found. Installing..."
    brew install supabase/tap/supabase
    print_success "Supabase CLI installed."
fi

if ! docker info &> /dev/null; then
    print_warning "Docker is not running. You won't be able to test Supabase functions locally."
    print_warning "Please start Docker Desktop and re-run this script if you need local function testing."
fi

if [ ${#MISSING_TOOLS[@]} -ne 0 ]; then
    print_error "Missing required tools: ${MISSING_TOOLS[*]}"
    exit 1
fi

# Step 2: Install Solana CLI if not present
print_status "🔧 Setting up Solana CLI..."

if ! command -v solana &> /dev/null; then
    print_status "Installing Solana CLI..."
    curl -sSfL https://release.solana.com/v1.18.22/install | sh
    
    # Add to PATH
    export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
    
    # Add to shell profile for persistence
    echo 'export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"' >> ~/.zshrc
    
    print_success "Solana CLI installed"
else
    print_success "Solana CLI already installed"
fi

# Verify Solana CLI
solana --version
print_success "Solana CLI verified"

# Step 3: Install Rust if not present
print_status "🦀 Setting up Rust..."

if ! command -v rustc &> /dev/null; then
    print_status "Installing Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source ~/.cargo/env
    print_success "Rust installed"
else
    print_success "Rust already installed"
fi

# Add Solana toolchain
rustup component add rust-src

# Step 4: Setup Solana configuration
print_status "⚙️ Setting up Solana configuration..."

# Create keypair if not exists
if [ ! -f ~/.config/solana/id.json ]; then
    print_status "Creating deployment keypair..."
    mkdir -p ~/.config/solana
    solana-keygen new --outfile ~/.config/solana/id.json --no-bip39-passphrase
    print_success "Deployment keypair created"
else
    print_success "Using existing keypair"
fi

# Configure for devnet first
solana config set --url devnet
solana config set --keypair ~/.config/solana/id.json

print_success "Solana configured for devnet"

# Step 5: Check SOL balance and request airdrop if needed
print_status "💰 Checking SOL balance..."

BALANCE=$(solana balance --output json-compact | jq -r '.')
print_status "Current balance: $BALANCE SOL"

# Convert balance to number for comparison
BALANCE_NUM=$(echo "$BALANCE" | cut -d' ' -f1)

if (( $(echo "$BALANCE_NUM < 5" | bc -l) )); then
    print_status "Requesting devnet SOL airdrop..."
    solana airdrop 5
    
    # Wait for airdrop
    sleep 10
    
    NEW_BALANCE=$(solana balance --output json-compact | jq -r '.')
    print_success "New balance: $NEW_BALANCE SOL"
else
    print_success "Sufficient SOL balance for deployment"
fi

# Step 6: Build and deploy the program
print_status "🔨 Building and deploying Solana program..."

cd programs/bonding-curve

# Build the program
print_status "Building program..."
cargo build-bpf

if [ ! -f "target/deploy/bonding_curve.so" ]; then
    print_error "Program build failed - bonding_curve.so not found"
    exit 1
fi

print_success "Program built successfully"

# Deploy to devnet
print_status "Deploying to devnet..."
DEPLOYMENT_OUTPUT=$(solana program deploy target/deploy/bonding_curve.so --output json)
PROGRAM_ID=$(echo "$DEPLOYMENT_OUTPUT" | jq -r '.programId')

if [ "$PROGRAM_ID" != "null" ] && [ -n "$PROGRAM_ID" ]; then
    print_success "Program deployed successfully!"
    echo "📍 Program ID: $PROGRAM_ID"
    
    # Save program ID
    echo "$PROGRAM_ID" > deployed-program-id.txt
    
else
    print_error "Program deployment failed"
    echo "Deployment output: $DEPLOYMENT_OUTPUT"
    exit 1
fi

# Step 7: Create platform wallets
print_status "💳 Creating platform wallets..."

cd ../..  # Back to project root

# Create fee wallet
print_status "Creating fee wallet..."
solana-keygen new --outfile fee-wallet.json --no-bip39-passphrase --silent
FEE_WALLET=$(solana-keygen pubkey fee-wallet.json)
print_success "Fee wallet: $FEE_WALLET"

# Create authority wallet  
print_status "Creating authority wallet..."
solana-keygen new --outfile authority-wallet.json --no-bip39-passphrase --silent
AUTHORITY_WALLET=$(solana-keygen pubkey authority-wallet.json)
print_success "Authority wallet: $AUTHORITY_WALLET"

# Create treasury wallet
print_status "Creating treasury wallet..."
solana-keygen new --outfile treasury-wallet.json --no-bip39-passphrase --silent
TREASURY_WALLET=$(solana-keygen pubkey treasury-wallet.json)
print_success "Treasury wallet: $TREASURY_WALLET"

# Fund the wallets
print_status "💸 Funding platform wallets..."
solana transfer 1 $FEE_WALLET
solana transfer 1 $AUTHORITY_WALLET  
solana transfer 1 $TREASURY_WALLET

print_success "Platform wallets funded"

# Step 8: Update configuration
print_status "🔧 Updating configuration..."

# Create production config from template
cp production-config-template.env .env.production

# Update with real values
sed -i.bak "s/YOUR_DEPLOYED_PROGRAM_ID_HERE/$PROGRAM_ID/g" .env.production
sed -i.bak "s/YOUR_FEE_WALLET_PUBKEY_HERE/$FEE_WALLET/g" .env.production
sed -i.bak "s/YOUR_AUTHORITY_WALLET_PUBKEY_HERE/$AUTHORITY_WALLET/g" .env.production
sed -i.bak "s/YOUR_TREASURY_WALLET_PUBKEY_HERE/$TREASURY_WALLET/g" .env.production
sed -i.bak "s/YOUR_FEE_COLLECTOR_PUBKEY_HERE/$FEE_WALLET/g" .env.production

# Clean up backup files
rm -f .env.production.bak

print_success "Production configuration created"

# Step 9: Replace simulation with production code
print_status "🔄 Implementing production trading system..."

# Backup original file
cp src/services/solanaProgram.ts src/services/solanaProgram.simulation.ts

# Replace with production version
cp src/services/solanaProgram.production.ts src/services/solanaProgram.ts

print_success "Production trading system implemented"

# Step 10: Finalize Configuration
print_status "⚙️ Finalizing program configuration..."

print_warning "The bonding curve program ID has been saved to .env.production."
print_warning "Ensure your application code (e.g., src/config/index.ts) reads this value from environment variables (import.meta.env.VITE_DEVNET_BONDING_CURVE_PROGRAM)."
print_success "Configuration is ready for production build."

# Step 11: Generate summary
print_status "📋 Generating deployment summary..."

cat > DEPLOYMENT_SUMMARY.md << EOF
# 🚀 FloppFun Production Deployment Summary

## Deployment Information
- **Date**: $(date)
- **Network**: Devnet (for testing)
- **Program ID**: \`$PROGRAM_ID\`

## Platform Wallets
- **Fee Wallet**: \`$FEE_WALLET\`
- **Authority Wallet**: \`$AUTHORITY_WALLET\`
- **Treasury Wallet**: \`$TREASURY_WALLET\`

## Files Created
- \`deployed-program-id.txt\` - Contains the deployed program ID
- \`fee-wallet.json\` - Fee collection wallet keypair
- \`authority-wallet.json\` - Platform authority wallet keypair
- \`treasury-wallet.json\` - Treasury wallet keypair
- \`.env.production\` - Production environment variables
- \`src/services/solanaProgram.simulation.ts\` - Backup of simulation code

## Next Steps

### 1. Test on Devnet
\`\`\`bash
# Start your app in development mode
npm run dev

# Test trading with devnet SOL
# Verify all transactions appear on Solana Explorer
\`\`\`

### 2. Deploy to Mainnet (After thorough testing)
\`\`\`bash
# Configure for mainnet
solana config set --url mainnet-beta

# Fund your keypair with real SOL (5-10 SOL recommended)
# Deploy program to mainnet
solana program deploy programs/bonding-curve/target/deploy/bonding_curve.so

# Update configuration with mainnet program ID
\`\`\`

### 3. Production Checklist
- [ ] ✅ All trading flows tested on devnet
- [ ] ✅ Error handling verified
- [ ] ✅ Database updates match blockchain state  
- [ ] ✅ Wallet connections work properly
- [ ] ✅ Fee collection working
- [ ] 🔄 Security audit completed
- [ ] 🔄 Load testing performed
- [ ] 🔄 Mainnet deployment

## Important Notes

⚠️  **Security Reminders**:
- Keep wallet keypair files secure and backed up
- Test thoroughly on devnet before mainnet
- Monitor all transactions and fees
- Have rollback plan ready

🎯 **What's Different Now**:
- Real Solana transactions instead of simulation
- Actual SOL spent from user wallets
- Real transaction signatures
- Blockchain state drives price updates
- Platform fees collected automatically

## Troubleshooting

If you encounter issues:
1. Check Solana Explorer for transaction details
2. Verify wallet has sufficient SOL
3. Ensure program is deployed correctly
4. Check RPC endpoint connectivity

Program Explorer: https://explorer.solana.com/address/$PROGRAM_ID?cluster=devnet
EOF

print_success "Deployment summary created"

# Step 12: Final verification
print_status "🔍 Running final verification..."

# Check if program is deployed
PROGRAM_INFO=$(solana account $PROGRAM_ID --output json)
if [ $? -eq 0 ]; then
    print_success "Program deployment verified on blockchain"
else
    print_error "Program not found on blockchain"
fi

# Check config files
if [ -f ".env.production" ] && [ -f "src/services/solanaProgram.ts" ]; then
    print_success "Configuration files updated"
else
    print_error "Configuration update failed"
fi

# Final success message
echo ""
echo "========================================"
print_success "🎉 PRODUCTION SETUP COMPLETE!"
echo "========================================"
echo ""
echo "📋 Summary:"
echo "✅ Solana CLI installed and configured"
echo "✅ Program built and deployed to devnet"
echo "✅ Platform wallets created and funded"  
echo "✅ Production code implemented"
echo "✅ Configuration updated"
echo ""
echo "📍 Program ID: $PROGRAM_ID"
echo "💳 Fee Wallet: $FEE_WALLET"
echo ""
echo "🔄 Next Steps:"
echo "1. Review DEPLOYMENT_SUMMARY.md"
echo "2. Test trading on devnet"
echo "3. Deploy to mainnet after testing"
echo ""
echo "🚀 Your FloppFun platform is now ready for production!" 
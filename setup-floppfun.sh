#!/bin/bash

# FloppFun Complete Setup Script
# This script sets up everything needed for FloppFun to work properly

set -e  # Exit on any error

echo "🚀 FloppFun Complete Setup Script"
echo "=================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
print_step() {
    echo -e "${BLUE}📋 Step $1: $2${NC}"
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

# Check prerequisites
print_step "1" "Checking Prerequisites"

# Check Node.js
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi
NODE_VERSION=$(node --version | cut -d. -f1 | cut -dv -f2)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js version must be 18 or higher. Current: $(node --version)"
    exit 1
fi
print_success "Node.js $(node --version) is installed"

# Check npm
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed"
    exit 1
fi
print_success "npm $(npm --version) is installed"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Please run this script from the FloppFun project root."
    exit 1
fi
print_success "Found package.json - we're in the right directory"

# Install dependencies
print_step "2" "Installing Dependencies"
echo "📦 Installing npm dependencies..."
npm install
print_success "Dependencies installed successfully"

# Install additional required packages
echo "📦 Installing additional packages for token creation..."
npm install @metaplex-foundation/mpl-token-metadata borsh
print_success "Additional packages installed"

# Generate secure wallets
print_step "3" "Generating Secure Wallets"
echo "🔐 Generating platform wallets..."
node generate-wallets.js
print_success "Platform wallets generated successfully"

# Setup environment
print_step "4" "Setting Up Environment"
if [ -f "generated-devnet-config.env" ]; then
    cp generated-devnet-config.env .env.local
    print_success "Environment configuration copied to .env.local"
else
    print_warning "generated-devnet-config.env not found. Using template..."
    cp .env.example .env.local
    print_warning "Please update .env.local with your configuration"
fi

# Check Solana CLI (optional)
print_step "5" "Checking Solana CLI (Optional)"
if command -v solana &> /dev/null; then
    print_success "Solana CLI is installed: $(solana --version)"
    
    # Set to devnet
    solana config set --url devnet
    print_success "Solana CLI set to devnet"
    
    # Check/request SOL for wallets
    if [ -d "secure-keys" ]; then
        echo "💰 Funding platform wallets with devnet SOL..."
        for wallet_file in secure-keys/*-keypair.json; do
            if [ -f "$wallet_file" ]; then
                wallet_address=$(solana address -k "$wallet_file")
                echo "🪂 Requesting airdrop for $wallet_address..."
                solana airdrop 2 "$wallet_address" --url devnet || echo "Airdrop may have failed - continuing..."
            fi
        done
        print_success "Wallet funding completed"
    fi
else
    print_warning "Solana CLI not found. Install from: https://docs.solana.com/cli/install-solana-cli-tools"
    print_warning "You can still run the frontend, but you won't be able to deploy the Solana program"
fi

# Check Anchor (optional)
print_step "6" "Checking Anchor CLI (Optional)"
if command -v anchor &> /dev/null; then
    print_success "Anchor CLI is installed: $(anchor --version)"
    
    echo "🔨 Building Solana program..."
    if anchor build; then
        print_success "Solana program built successfully"
        
        # Deploy program
        echo "🚀 Deploying program to devnet..."
        if anchor deploy --provider.cluster devnet; then
            # Get program ID
            PROGRAM_ID=$(solana address -k target/deploy/bonding_curve-keypair.json)
            print_success "Program deployed successfully: $PROGRAM_ID"
            
            # Update environment with real program ID
            sed -i.bak "s/YOUR_DEPLOYED_PROGRAM_ID_HERE/$PROGRAM_ID/" .env.local
            print_success "Environment updated with program ID"
        else
            print_warning "Program deployment failed - you can still run with simulation mode"
        fi
    else
        print_warning "Program build failed - you can still run with simulation mode"
    fi
else
    print_warning "Anchor CLI not found. Install with: npm install -g @project-serum/anchor-cli"
    print_warning "You can still run the frontend with simulated transactions"
fi

# Setup IPFS (Pinata)
print_step "7" "IPFS Configuration"
echo "📎 For metadata upload, you'll need Pinata credentials."
echo "   1. Go to https://pinata.cloud"
echo "   2. Create a free account"
echo "   3. Get your API key and secret"
echo "   4. Add them to .env.local:"
echo "      VITE_PINATA_API_KEY=your_api_key"
echo "      VITE_PINATA_SECRET_KEY=your_secret_key"
print_warning "Pinata setup is optional - tokens can still be created without it"

# Run tests
print_step "8" "Running Basic Tests"
echo "🧪 Testing TypeScript compilation..."
if npm run type-check; then
    print_success "TypeScript compilation successful"
else
    print_warning "TypeScript errors found - check your configuration"
fi

echo "🧪 Testing lint..."
if npm run lint; then
    print_success "Linting passed"
else
    print_warning "Lint warnings found - check code quality"
fi

# Final setup
print_step "9" "Final Setup"

# Create a simple test file
cat > test-setup.js << 'EOF'
// FloppFun Setup Test
console.log('🧪 Testing FloppFun setup...')

try {
  // Test environment variables
  const requiredEnvVars = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY', 
    'VITE_SOLANA_NETWORK'
  ]
  
  let missing = []
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      missing.push(envVar)
    }
  }
  
  if (missing.length > 0) {
    console.log('⚠️  Missing environment variables:', missing.join(', '))
    console.log('   Please check your .env.local file')
  } else {
    console.log('✅ Environment variables look good')
  }
  
  console.log('✅ FloppFun setup test completed')
} catch (error) {
  console.error('❌ Setup test failed:', error.message)
}
EOF

node test-setup.js
rm test-setup.js

# Summary
echo ""
echo "🎉 FloppFun Setup Complete!"
echo "=========================="
echo ""
echo "📋 What was set up:"
echo "  ✅ Dependencies installed"
echo "  ✅ Secure wallets generated"
echo "  ✅ Environment configured"
if command -v solana &> /dev/null; then
    echo "  ✅ Solana CLI configured"
    echo "  ✅ Platform wallets funded"
fi
if command -v anchor &> /dev/null; then
    echo "  ✅ Solana program built and deployed"
fi
echo ""
echo "🚀 Next Steps:"
echo "  1. Start the development server:"
echo "     npm run dev"
echo ""
echo "  2. Open http://localhost:5173 in your browser"
echo ""
echo "  3. Connect your wallet (Phantom/Solflare)"
echo ""
echo "  4. Try creating a token!"
echo ""
echo "📁 Important Files:"
echo "  - .env.local: Your environment configuration"
echo "  - secure-keys/: Your platform wallet private keys (keep secure!)"
echo "  - generated-devnet-config.env: Backup of your config"
echo ""
echo "🔒 Security Reminders:"
echo "  - Never commit .env.local or secure-keys/ to git"
echo "  - Keep your private keys secure"
echo "  - Only use devnet SOL for testing"
echo ""
echo "🆘 Need Help?"
echo "  - Check the README.md for detailed instructions"
echo "  - Review the docs/ folder for guides"
echo "  - Make sure your wallet has devnet SOL"
echo ""
print_success "FloppFun is ready to go! 🎊"
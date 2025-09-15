#!/bin/bash
# Production Configuration Script

set -e

echo "⚙️  Configuring for Production Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create necessary directories
mkdir -p keys
mkdir -p logs

echo -e "${BLUE}Setting up Solana configuration...${NC}"

# Configure for devnet first (testing)
echo -e "${YELLOW}Configuring Solana for devnet (testing)...${NC}"
solana config set --url devnet
solana config set --keypair ~/.config/solana/id.json

# Generate deployment keypair if it doesn't exist
if [ ! -f "keys/deployer-keypair.json" ]; then
    echo -e "${YELLOW}Generating deployment keypair...${NC}"
    solana-keygen new --no-bip39-passphrase --silent --outfile keys/deployer-keypair.json
    echo -e "${GREEN}✓ Deployment keypair created: keys/deployer-keypair.json${NC}"
    
    # Show the public key
    DEPLOYER_PUBKEY=$(solana-keygen pubkey keys/deployer-keypair.json)
    echo -e "${BLUE}🔑 Deployer Public Key: ${DEPLOYER_PUBKEY}${NC}"
    echo -e "${RED}⚠️  IMPORTANT: Save this private key securely! Anyone with access to keys/deployer-keypair.json can control your program!${NC}"
else
    echo -e "${GREEN}✓ Deployment keypair already exists${NC}"
    DEPLOYER_PUBKEY=$(solana-keygen pubkey keys/deployer-keypair.json)
    echo -e "${BLUE}🔑 Deployer Public Key: ${DEPLOYER_PUBKEY}${NC}"
fi

# Generate program keypair for deterministic program ID
if [ ! -f "keys/program-keypair.json" ]; then
    echo -e "${YELLOW}Generating program keypair...${NC}"
    solana-keygen new --no-bip39-passphrase --silent --outfile keys/program-keypair.json
    PROGRAM_ID=$(solana-keygen pubkey keys/program-keypair.json)
    echo -e "${GREEN}✓ Program keypair created${NC}"
    echo -e "${BLUE}📋 Program ID: ${PROGRAM_ID}${NC}"
    
    # Update Anchor.toml with the new program ID
    if [ -f "Anchor.toml" ]; then
        echo -e "${YELLOW}Updating Anchor.toml with new Program ID...${NC}"
        sed -i.bak "s/bonding_curve = \".*\"/bonding_curve = \"$PROGRAM_ID\"/" Anchor.toml
        echo -e "${GREEN}✓ Anchor.toml updated${NC}"
    fi
    
    # Update lib.rs with the new program ID
    if [ -f "programs/bonding-curve/src/lib.rs" ]; then
        echo -e "${YELLOW}Updating lib.rs with new Program ID...${NC}"
        sed -i.bak "s/declare_id!(\".*\")/declare_id!(\"$PROGRAM_ID\")/" programs/bonding-curve/src/lib.rs
        echo -e "${GREEN}✓ lib.rs updated${NC}"
    fi
else
    echo -e "${GREEN}✓ Program keypair already exists${NC}"
    PROGRAM_ID=$(solana-keygen pubkey keys/program-keypair.json)
    echo -e "${BLUE}📋 Program ID: ${PROGRAM_ID}${NC}"
fi

# Request devnet SOL for testing
echo -e "${YELLOW}Requesting devnet SOL for testing...${NC}"
solana airdrop 5 --keypair keys/deployer-keypair.json || true

# Show balance
BALANCE=$(solana balance --keypair keys/deployer-keypair.json)
echo -e "${BLUE}💰 Deployer Balance: ${BALANCE}${NC}"

# Security checklist
echo -e "${RED}🔒 SECURITY CHECKLIST:${NC}"
echo "1. ✅ Keep keys/deployer-keypair.json PRIVATE and SECURE"
echo "2. ✅ Use environment variables for sensitive data in production"
echo "3. ✅ Enable program upgrade authority transfer after deployment"
echo "4. ✅ Verify program source code before mainnet deployment"
echo "5. ✅ Test thoroughly on devnet before mainnet"

echo -e "${GREEN}🎉 Configuration complete!${NC}"
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Run './deploy/build.sh' to build your program"
echo "2. Run './deploy/test-deploy.sh' to test on devnet"
echo "3. Run './deploy/mainnet-deploy.sh' for production deployment"

# Create environment file for the application
echo -e "${YELLOW}Creating production environment configuration...${NC}"
cat > .env.production << EOF
# Production Environment Configuration
# Generated on $(date)

# Network Configuration
VITE_SOLANA_NETWORK=mainnet
VITE_DEVNET_RPC_URL=https://api.devnet.solana.com
VITE_MAINNET_RPC_URL=https://api.mainnet-beta.solana.com

# Program Configuration
VITE_DEVNET_BONDING_CURVE_PROGRAM=${PROGRAM_ID}
VITE_MAINNET_BONDING_CURVE_PROGRAM=${PROGRAM_ID}

# Security Settings
VITE_MOCK_TRANSACTIONS=false
VITE_SIMULATE_PROGRAM=false

# Deployer Information (DO NOT COMMIT TO VERSION CONTROL)
DEPLOYER_PUBKEY=${DEPLOYER_PUBKEY}
PROGRAM_ID=${PROGRAM_ID}
EOF

echo -e "${GREEN}✓ Production environment file created: .env.production${NC}"
echo -e "${RED}⚠️  Do NOT commit .env.production to version control!${NC}"
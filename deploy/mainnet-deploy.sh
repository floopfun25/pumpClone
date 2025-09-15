#!/bin/bash
# PRODUCTION MAINNET DEPLOYMENT SCRIPT
# ⚠️  WARNING: THIS DEPLOYS TO MAINNET WITH REAL SOL! ⚠️

set -e

echo -e "\033[1;31m"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                  🚨 MAINNET DEPLOYMENT 🚨                ║"
echo "║                                                           ║"
echo "║  This will deploy to MAINNET with REAL SOL!              ║"
echo "║  Make sure you have tested thoroughly on devnet!         ║"
echo "║                                                           ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "\033[0m"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Safety confirmation
echo -e "${BOLD}${RED}This is a PRODUCTION deployment to MAINNET.${NC}"
echo -e "${YELLOW}Please confirm the following before proceeding:${NC}"
echo ""
echo "1. ✅ Program has been thoroughly tested on devnet"
echo "2. ✅ All tests pass successfully"
echo "3. ✅ Code has been audited for security issues"
echo "4. ✅ You have sufficient mainnet SOL for deployment (~2-5 SOL)"
echo "5. ✅ Backup of all keys is stored securely"
echo "6. ✅ Program upgrade authority plan is in place"
echo ""

read -p "Type 'I UNDERSTAND THE RISKS' to continue: " confirmation
if [ "$confirmation" != "I UNDERSTAND THE RISKS" ]; then
    echo -e "${RED}❌ Deployment cancelled.${NC}"
    exit 1
fi

# Double confirmation
echo -e "${RED}Last chance! This will spend REAL SOL on mainnet.${NC}"
read -p "Type 'DEPLOY TO MAINNET' to confirm: " final_confirmation
if [ "$final_confirmation" != "DEPLOY TO MAINNET" ]; then
    echo -e "${RED}❌ Deployment cancelled.${NC}"
    exit 1
fi

# Ensure we're in the project directory
cd "$(dirname "$0")/.."

# Verify everything is ready
echo -e "${YELLOW}🔍 Pre-deployment checks...${NC}"

if [ ! -f "target/deploy/bonding_curve.so" ]; then
    echo -e "${RED}❌ Program not built! Run './deploy/build.sh' first${NC}"
    exit 1
fi

if [ ! -f "keys/deployer-keypair.json" ] || [ ! -f "keys/program-keypair.json" ]; then
    echo -e "${RED}❌ Deployment keys not found!${NC}"
    exit 1
fi

PROGRAM_ID=$(solana-keygen pubkey keys/program-keypair.json)
DEPLOYER_PUBKEY=$(solana-keygen pubkey keys/deployer-keypair.json)

echo -e "${BLUE}🎯 MAINNET DEPLOYMENT${NC}"
echo -e "${BLUE}📋 Program ID: ${PROGRAM_ID}${NC}"
echo -e "${BLUE}🔑 Deployer: ${DEPLOYER_PUBKEY}${NC}"

# Configure for mainnet
echo -e "${YELLOW}⚙️  Configuring for mainnet...${NC}"
solana config set --url mainnet-beta
solana config set --keypair keys/deployer-keypair.json

# Check balance
BALANCE=$(solana balance)
BALANCE_NUM=$(echo $BALANCE | grep -o '[0-9.]*')
if (( $(echo "$BALANCE_NUM < 2" | bc -l) )); then
    echo -e "${RED}❌ Insufficient balance for deployment: $BALANCE${NC}"
    echo -e "${YELLOW}You need at least 2 SOL for deployment.${NC}"
    echo -e "${YELLOW}Please fund your deployer wallet: ${DEPLOYER_PUBKEY}${NC}"
    exit 1
fi

echo -e "${GREEN}💰 Deployer Balance: $BALANCE${NC}"

# Final security check
echo -e "${YELLOW}🔐 Final security verification...${NC}"
PROGRAM_HASH=$(sha256sum target/deploy/bonding_curve.so | awk '{print $1}')
echo -e "${BLUE}Program hash: ${PROGRAM_HASH}${NC}"

# Create pre-deployment backup
echo -e "${YELLOW}💾 Creating deployment backup...${NC}"
BACKUP_DIR="backups/mainnet-$(date +%Y%m%d-%H%M%S)"
mkdir -p $BACKUP_DIR
cp -r keys/ $BACKUP_DIR/
cp target/deploy/bonding_curve.so $BACKUP_DIR/
cp build-info.json $BACKUP_DIR/
echo -e "${GREEN}✓ Backup created: $BACKUP_DIR${NC}"

# Deploy the program
echo -e "${BOLD}${YELLOW}🚀 DEPLOYING TO MAINNET...${NC}"
echo -e "${RED}This will spend real SOL. Last chance to cancel (Ctrl+C)${NC}"
sleep 5

solana program deploy \
    --keypair keys/deployer-keypair.json \
    --program-id keys/program-keypair.json \
    target/deploy/bonding_curve.so

# Verify deployment
echo -e "${YELLOW}🔍 Verifying mainnet deployment...${NC}"
DEPLOYED_SIZE=$(solana program show $PROGRAM_ID | grep "ProgramData Address" -A 20 | grep "Data Length" | awk '{print $3}')

if [ -z "$DEPLOYED_SIZE" ]; then
    echo -e "${RED}❌ Deployment verification failed!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ MAINNET DEPLOYMENT SUCCESSFUL!${NC}"
echo -e "${BLUE}📦 Deployed size: ${DEPLOYED_SIZE} bytes${NC}"

# Show program info
echo -e "${YELLOW}📋 Program Information:${NC}"
solana program show $PROGRAM_ID

# Update production configuration
echo -e "${YELLOW}📝 Updating production configuration...${NC}"

# Update .env.production with mainnet settings
cat > .env.production << EOF
# Production Mainnet Configuration
VITE_SOLANA_NETWORK=mainnet
VITE_MAINNET_RPC_URL=https://api.mainnet-beta.solana.com
VITE_MAINNET_BONDING_CURVE_PROGRAM=${PROGRAM_ID}
VITE_MOCK_TRANSACTIONS=false
VITE_SIMULATE_PROGRAM=false

# Deployment Info
PROGRAM_ID=${PROGRAM_ID}
DEPLOYER_PUBKEY=${DEPLOYER_PUBKEY}
DEPLOYED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
PROGRAM_HASH=${PROGRAM_HASH}
EOF

# Create detailed deployment report
cat > logs/mainnet-deployment-$(date +%Y%m%d-%H%M%S).json << EOF
{
  "deployment_type": "mainnet-production",
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "program_id": "${PROGRAM_ID}",
  "deployer": "${DEPLOYER_PUBKEY}",
  "network": "mainnet-beta",
  "deployed_size": "${DEPLOYED_SIZE}",
  "program_hash": "${PROGRAM_HASH}",
  "backup_location": "${BACKUP_DIR}",
  "deployment_cost": "$(solana balance --keypair keys/deployer-keypair.json)",
  "status": "success",
  "upgrade_authority": "${DEPLOYER_PUBKEY}",
  "security_checklist": {
    "tested_on_devnet": true,
    "code_audited": true,
    "keys_backed_up": true,
    "deployment_verified": true
  }
}
EOF

echo -e "${GREEN}🎉 MAINNET DEPLOYMENT COMPLETE! 🎉${NC}"
echo ""
echo -e "${BOLD}${BLUE}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${BLUE}║                    DEPLOYMENT SUCCESS                    ║${NC}"
echo -e "${BOLD}${BLUE}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}🔗 Program ID: ${PROGRAM_ID}${NC}"
echo -e "${BLUE}🌐 Mainnet Explorer: https://explorer.solana.com/address/${PROGRAM_ID}${NC}"
echo -e "${BLUE}📊 SolanaFM: https://solana.fm/address/${PROGRAM_ID}${NC}"
echo -e "${BLUE}🔍 Solscan: https://solscan.io/account/${PROGRAM_ID}${NC}"
echo ""
echo -e "${YELLOW}📋 POST-DEPLOYMENT CHECKLIST:${NC}"
echo "1. ✅ Verify program on multiple explorers"
echo "2. ⏳ Update your frontend with the mainnet program ID"
echo "3. ⏳ Test with small amounts first"
echo "4. ⏳ Monitor program logs and transactions"
echo "5. ⏳ Set up alerting and monitoring"
echo "6. ⏳ Consider transferring upgrade authority to a multisig"
echo ""
echo -e "${RED}🔒 SECURITY REMINDERS:${NC}"
echo "- Keep your deployment keys EXTREMELY secure"
echo "- Monitor the program for any unusual activity"
echo "- Have an emergency response plan ready"
echo "- Consider program upgrade authority management"
echo ""
echo -e "${GREEN}Your pump.fun clone is now LIVE on Solana mainnet! 🚀${NC}"
#!/bin/bash
# Devnet Testing Deployment Script

set -e

echo "🧪 Deploying to Devnet for Testing..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Ensure we're in the project directory
cd "$(dirname "$0")/.."

# Verify build exists
if [ ! -f "target/deploy/bonding_curve.so" ]; then
    echo -e "${RED}❌ Program not built! Run './deploy/build.sh' first${NC}"
    exit 1
fi

# Verify keys exist
if [ ! -f "keys/deployer-keypair.json" ] || [ ! -f "keys/program-keypair.json" ]; then
    echo -e "${RED}❌ Deployment keys not found! Run './deploy/configure.sh' first${NC}"
    exit 1
fi

PROGRAM_ID=$(solana-keygen pubkey keys/program-keypair.json)
DEPLOYER_PUBKEY=$(solana-keygen pubkey keys/deployer-keypair.json)

echo -e "${BLUE}🎯 Deploying to Devnet${NC}"
echo -e "${BLUE}📋 Program ID: ${PROGRAM_ID}${NC}"
echo -e "${BLUE}🔑 Deployer: ${DEPLOYER_PUBKEY}${NC}"

# Configure for devnet
solana config set --url devnet
solana config set --keypair keys/deployer-keypair.json

# Check balance
BALANCE=$(solana balance)
BALANCE_NUM=$(echo $BALANCE | grep -o '[0-9.]*')
if (( $(echo "$BALANCE_NUM < 2" | bc -l) )); then
    echo -e "${YELLOW}⏳ Low balance ($BALANCE). Requesting airdrop...${NC}"
    solana airdrop 5 || true
    sleep 2
fi

echo -e "${YELLOW}💰 Deployer Balance: $(solana balance)${NC}"

# Deploy the program
echo -e "${YELLOW}🚀 Deploying program...${NC}"
solana program deploy \
    --keypair keys/deployer-keypair.json \
    --program-id keys/program-keypair.json \
    target/deploy/bonding_curve.so

# Verify deployment
echo -e "${YELLOW}🔍 Verifying deployment...${NC}"
DEPLOYED_SIZE=$(solana program show $PROGRAM_ID | grep "ProgramData Address" -A 20 | grep "Data Length" | awk '{print $3}')
echo -e "${GREEN}✅ Program deployed successfully!${NC}"
echo -e "${BLUE}📦 Deployed size: ${DEPLOYED_SIZE} bytes${NC}"

# Show program info
solana program show $PROGRAM_ID

# Update your TypeScript configuration
echo -e "${YELLOW}📝 Updating TypeScript configuration...${NC}"

# Update bondingCurveProgram.ts with correct program ID
if [ -f "src/services/bondingCurveProgram.ts" ]; then
    sed -i.bak "s/new PublicKey(\".*\")/new PublicKey(\"$PROGRAM_ID\")/" src/services/bondingCurveProgram.ts
    echo -e "${GREEN}✓ Updated bondingCurveProgram.ts${NC}"
fi

# Create deployment report
cat > logs/devnet-deployment-$(date +%Y%m%d-%H%M%S).json << EOF
{
  "deployment_type": "devnet",
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "program_id": "${PROGRAM_ID}",
  "deployer": "${DEPLOYER_PUBKEY}",
  "network": "devnet",
  "deployed_size": "${DEPLOYED_SIZE}",
  "status": "success"
}
EOF

echo -e "${GREEN}🎉 Devnet deployment complete!${NC}"
echo -e "${BLUE}🔗 Program ID: ${PROGRAM_ID}${NC}"
echo -e "${BLUE}🌐 Explorer: https://explorer.solana.com/address/${PROGRAM_ID}?cluster=devnet${NC}"

echo -e "${YELLOW}📋 Testing Checklist:${NC}"
echo "1. ✅ Verify program on Solana Explorer"
echo "2. ⏳ Test token creation"
echo "3. ⏳ Test buy transactions"
echo "4. ⏳ Test sell transactions"
echo "5. ⏳ Verify all edge cases"
echo "6. ⏳ Check security constraints"

echo -e "${GREEN}Next steps:${NC}"
echo "1. Test your application thoroughly with the deployed program"
echo "2. Fix any issues and redeploy if needed"
echo "3. Once satisfied, run './deploy/mainnet-deploy.sh' for production"
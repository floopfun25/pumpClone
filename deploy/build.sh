#!/bin/bash
# Production Build Script

set -e

echo "🔨 Building Program for Production..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Ensure we're in the project directory
cd "$(dirname "$0")/.."

# Verify program keypair exists
if [ ! -f "keys/program-keypair.json" ]; then
    echo -e "${RED}❌ Program keypair not found! Run './deploy/configure.sh' first${NC}"
    exit 1
fi

PROGRAM_ID=$(solana-keygen pubkey keys/program-keypair.json)
echo -e "${BLUE}📋 Building Program ID: ${PROGRAM_ID}${NC}"

# Clean previous build
echo -e "${YELLOW}Cleaning previous build...${NC}"
rm -rf target/

# Build with optimizations for production
echo -e "${YELLOW}Building program with production optimizations...${NC}"
anchor build

# Verify the build
if [ ! -f "target/deploy/bonding_curve.so" ]; then
    echo -e "${RED}❌ Build failed! Program binary not found.${NC}"
    exit 1
fi

# Get program size
PROGRAM_SIZE=$(ls -lh target/deploy/bonding_curve.so | awk '{print $5}')
echo -e "${GREEN}✓ Program built successfully${NC}"
echo -e "${BLUE}📦 Program size: ${PROGRAM_SIZE}${NC}"

# Verify program ID matches
BUILT_PROGRAM_ID=$(solana program show --programs target/deploy/bonding_curve.so | grep -o '[A-Za-z0-9]\{44\}' | head -1)
if [ "$BUILT_PROGRAM_ID" != "$PROGRAM_ID" ]; then
    echo -e "${RED}❌ Program ID mismatch!${NC}"
    echo -e "${RED}Expected: ${PROGRAM_ID}${NC}"
    echo -e "${RED}Built:    ${BUILT_PROGRAM_ID}${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Program ID verified: ${PROGRAM_ID}${NC}"

# Generate program hash for security verification
PROGRAM_HASH=$(sha256sum target/deploy/bonding_curve.so | awk '{print $1}')
echo -e "${BLUE}🔐 Program hash: ${PROGRAM_HASH}${NC}"

# Save build info
cat > build-info.json << EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "program_id": "${PROGRAM_ID}",
  "program_size": "${PROGRAM_SIZE}",
  "program_hash": "${PROGRAM_HASH}",
  "anchor_version": "$(anchor --version)",
  "solana_version": "$(solana --version)",
  "rust_version": "$(rustc --version)"
}
EOF

echo -e "${GREEN}✓ Build information saved to build-info.json${NC}"
echo -e "${GREEN}🎉 Build complete!${NC}"

# Security recommendations
echo -e "${YELLOW}🔒 Security Recommendations:${NC}"
echo "1. Verify the program hash: ${PROGRAM_HASH}"
echo "2. Test deployment on devnet first"
echo "3. Audit the program before mainnet deployment"
echo "4. Keep deployment keys secure"

echo -e "${YELLOW}Next steps:${NC}"
echo "1. Run './deploy/test-deploy.sh' to deploy on devnet"
echo "2. Test all functionality thoroughly"
echo "3. Run './deploy/mainnet-deploy.sh' for production"
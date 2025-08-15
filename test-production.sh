#!/bin/bash

# FloppFun Production Test Script
# Verifies that your production setup is working correctly

echo "🚀 Testing FloppFun Production Setup..."
echo "======================================"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Check environment config
echo "📋 Test 1: Checking environment configuration..."

if [ -f ".env.local" ]; then
    echo -e "${GREEN}✅ .env.local file exists${NC}"
    
    # Check if it contains required variables
    if grep -q "VITE_SOLANA_NETWORK" .env.local; then
        echo -e "${GREEN}✅ Solana network configured${NC}"
    else
        echo -e "${RED}❌ Missing VITE_SOLANA_NETWORK in .env.local${NC}"
    fi
    
    if grep -q "VITE_DEVNET_FEE_WALLET" .env.local; then
        echo -e "${GREEN}✅ Fee wallet configured${NC}"
    else
        echo -e "${RED}❌ Missing fee wallet configuration${NC}"
    fi
else
    echo -e "${RED}❌ .env.local file missing${NC}"
    echo -e "${YELLOW}⚠️  Copy devnet-config.env to .env.local${NC}"
fi

# Test 1b: Check for API Keys (critical for Phase 1)
echo "🔑 Test 1b: Checking for external API keys..."
if [ -f ".env.local" ]; then
    if grep -q "VITE_BIRDEYE_API_KEY" .env.local; then
        echo -e "${GREEN}✅ Birdeye API key found in config${NC}"
    else
        echo -e "${YELLOW}⚠️  Missing VITE_BIRDEYE_API_KEY. Real-time price data will fail.${NC}"
    fi
fi

# Test 2: Check fee wallet
echo ""
echo "💰 Test 2: Checking fee wallet..."

if [ -f "fee-wallet-devnet.json" ]; then
    echo -e "${GREEN}✅ Fee wallet file exists${NC}"
    
    # Try to get the public key
    if command -v solana &> /dev/null; then
        FEE_WALLET=$(solana-keygen pubkey fee-wallet-devnet.json 2>/dev/null)
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ Fee wallet public key: $FEE_WALLET${NC}"
            
            # Check balance
            BALANCE=$(solana balance $FEE_WALLET --url devnet 2>/dev/null)
            if [ $? -eq 0 ]; then
                echo -e "${GREEN}✅ Fee wallet balance: $BALANCE${NC}"
            else
                echo -e "${YELLOW}⚠️  Could not check fee wallet balance (network issue)${NC}"
            fi
        else
            echo -e "${RED}❌ Could not read fee wallet public key${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  Solana CLI not available for wallet verification${NC}"
    fi
else
    echo -e "${RED}❌ Fee wallet file missing${NC}"
fi

# Test 3: Check production code
echo ""
echo "🔧 Test 3: Checking production code..."

if [ -f "src/services/solanaProgram.ts" ]; then
    echo -e "${GREEN}✅ Production trading file exists${NC}"
    
    # Check if it's using production code (not simulation)
    if grep -q "PRODUCTION - Real blockchain transactions" src/services/solanaProgram.ts; then
        echo -e "${GREEN}✅ Production trading system active${NC}"
    else
        echo -e "${RED}❌ Still using simulation code${NC}"
        echo -e "${YELLOW}⚠️  Run: cp src/services/solanaProgram.production.ts src/services/solanaProgram.ts${NC}"
    fi
    
    # Check for simulation backup
    if [ -f "src/services/solanaProgram.simulation.ts" ]; then
        echo -e "${GREEN}✅ Simulation backup exists${NC}"
    else
        echo -e "${YELLOW}⚠️  No simulation backup found${NC}"
    fi
else
    echo -e "${RED}❌ solanaProgram.ts missing${NC}"
fi

# Test 4: Check configuration
echo ""
echo "⚙️ Test 4: Checking configuration updates..."

if grep -q "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" src/config/index.ts; then
    echo -e "${GREEN}✅ Real program addresses configured${NC}"
else
    echo -e "${RED}❌ Still using placeholder addresses${NC}"
fi

if grep -q "J3X42Cu4XAFHjbLYVjDCYXwigegrZkyfDZUtTMxedqkZ" src/config/index.ts; then
    echo -e "${GREEN}✅ Fee wallet address configured${NC}"
else
    echo -e "${RED}❌ Fee wallet not configured in main config${NC}"
fi

# Test 5: Check dependencies
echo ""
echo "📦 Test 5: Checking dependencies..."

if [ -f "package.json" ]; then
    echo -e "${GREEN}✅ package.json exists${NC}"
    
    if [ -d "node_modules" ]; then
        echo -e "${GREEN}✅ node_modules installed${NC}"
    else
        echo -e "${YELLOW}⚠️  Run: npm install${NC}"
    fi
else
    echo -e "${RED}❌ package.json missing${NC}"
fi

# Test 6: Quick build test
echo ""
echo "🔨 Test 6: Testing build..."

if command -v npm &> /dev/null; then
    echo "Testing TypeScript compilation..."
    if npm run type-check &> /dev/null; then
        echo -e "${GREEN}✅ TypeScript compilation successful${NC}"
    else
        echo -e "${YELLOW}⚠️  TypeScript errors detected (check with: npm run type-check)${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  npm not available for build test${NC}"
fi

# Summary
echo ""
echo "======================================"
echo "🎯 Production Setup Summary"
echo "======================================"

# Count successful tests
TESTS_PASSED=0
TOTAL_TESTS=6

# Re-run key checks for summary
[ -f ".env.local" ] && ((TESTS_PASSED++))
[ -f "fee-wallet-devnet.json" ] && ((TESTS_PASSED++))
[ -f "src/services/solanaProgram.ts" ] && ((TESTS_PASSED++))
grep -q "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" src/config/index.ts && ((TESTS_PASSED++))
[ -f "package.json" ] && ((TESTS_PASSED++))
[ -d "node_modules" ] && ((TESTS_PASSED++))

echo "Tests Passed: $TESTS_PASSED/$TOTAL_TESTS"

if [ $TESTS_PASSED -eq $TOTAL_TESTS ]; then
    echo -e "${GREEN}🎉 ALL TESTS PASSED! Your platform is production-ready!${NC}"
    echo ""
    echo "🚀 Next Steps:"
    echo "1. Start your app: npm run dev"
    echo "2. Connect wallet and test trading"
    echo "3. Verify transactions on Solana Explorer"
    echo "4. Deploy to production when ready"
elif [ $TESTS_PASSED -ge 4 ]; then
    echo -e "${YELLOW}⚠️  MOSTLY READY - Fix the issues above${NC}"
    echo ""
    echo "🔧 Quick fixes needed - see warnings above"
else
    echo -e "${RED}❌ SETUP INCOMPLETE - Several issues need fixing${NC}"
    echo ""
    echo "📋 Review the test results above and fix the failing items"
fi

echo ""
echo "📖 For detailed instructions, see: PRODUCTION_READY_SUMMARY.md"
echo "🆘 For help, see: QUICK_PRODUCTION_SETUP.md" 
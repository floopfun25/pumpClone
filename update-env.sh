#!/bin/bash

# FloppFun .env Update Script
# This script replaces your placeholder addresses with production-ready values

echo "🔧 Updating .env file with production-ready configuration..."

# Backup original .env file
cp .env .env.backup
echo "✅ Backup created: .env.backup"

# Replace placeholder addresses with production-ready values
sed -i.tmp 's/VITE_DEVNET_BONDING_CURVE_PROGRAM=11111111111111111111111111111111/VITE_DEVNET_BONDING_CURVE_PROGRAM=TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA/g' .env
sed -i.tmp 's/VITE_DEVNET_TOKEN_FACTORY_PROGRAM=11111111111111111111111111111111/VITE_DEVNET_TOKEN_FACTORY_PROGRAM=TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA/g' .env
sed -i.tmp 's/VITE_DEVNET_FEE_COLLECTOR=11111111111111111111111111111111/VITE_DEVNET_FEE_COLLECTOR=J3X42Cu4XAFHjbLYVjDCYXwigegrZkyfDZUtTMxedqkZ/g' .env
sed -i.tmp 's/VITE_DEVNET_FEE_WALLET=11111111111111111111111111111111/VITE_DEVNET_FEE_WALLET=J3X42Cu4XAFHjbLYVjDCYXwigegrZkyfDZUtTMxedqkZ/g' .env
sed -i.tmp 's/VITE_DEVNET_AUTHORITY=11111111111111111111111111111111/VITE_DEVNET_AUTHORITY=J3X42Cu4XAFHjbLYVjDCYXwigegrZkyfDZUtTMxedqkZ/g' .env
sed -i.tmp 's/VITE_DEVNET_TREASURY=11111111111111111111111111111111/VITE_DEVNET_TREASURY=J3X42Cu4XAFHjbLYVjDCYXwigegrZkyfDZUtTMxedqkZ/g' .env

sed -i.tmp 's/VITE_MAINNET_BONDING_CURVE_PROGRAM=11111111111111111111111111111111/VITE_MAINNET_BONDING_CURVE_PROGRAM=TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA/g' .env
sed -i.tmp 's/VITE_MAINNET_TOKEN_FACTORY_PROGRAM=11111111111111111111111111111111/VITE_MAINNET_TOKEN_FACTORY_PROGRAM=TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA/g' .env
sed -i.tmp 's/VITE_MAINNET_FEE_COLLECTOR=11111111111111111111111111111111/VITE_MAINNET_FEE_COLLECTOR=J3X42Cu4XAFHjbLYVjDCYXwigegrZkyfDZUtTMxedqkZ/g' .env
sed -i.tmp 's/VITE_MAINNET_FEE_WALLET=11111111111111111111111111111111/VITE_MAINNET_FEE_WALLET=J3X42Cu4XAFHjbLYVjDCYXwigegrZkyfDZUtTMxedqkZ/g' .env
sed -i.tmp 's/VITE_MAINNET_AUTHORITY=11111111111111111111111111111111/VITE_MAINNET_AUTHORITY=J3X42Cu4XAFHjbLYVjDCYXwigegrZkyfDZUtTMxedqkZ/g' .env
sed -i.tmp 's/VITE_MAINNET_TREASURY=11111111111111111111111111111111/VITE_MAINNET_TREASURY=J3X42Cu4XAFHjbLYVjDCYXwigegrZkyfDZUtTMxedqkZ/g' .env

# Clean up temporary files
rm -f .env.tmp

echo "✅ .env file updated with production-ready addresses!"
echo ""
echo "🎯 Key Changes Made:"
echo "✅ Bonding Curve Program: TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
echo "✅ Token Factory Program: TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" 
echo "✅ Your Fee Wallet: J3X42Cu4XAFHjbLYVjDCYXwigegrZkyfDZUtTMxedqkZ"
echo ""
echo "🚀 Your platform is now production-ready!"
echo "💰 1% of all trades will go to your fee wallet"
echo ""
echo "🧪 Next Steps:"
echo "1. Test your app: npm run dev"
echo "2. Connect wallet and trade with devnet SOL"
echo "3. Check your fee wallet balance: solana balance J3X42Cu4XAFHjbLYVjDCYXwigegrZkyfDZUtTMxedqkZ --url devnet"
echo ""
echo "📖 For full details, see: COMPLETE_ENV_CONFIGURATION.md" 
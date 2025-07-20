#!/bin/bash

# FloppFun Fee Wallet Balance Checker
# Quick script to check your platform revenue

echo "💰 FloppFun Fee Wallet Monitor"
echo "================================"

# Read from .env file to stay in sync
FEE_WALLET=$(grep "VITE_DEVNET_FEE_WALLET" .env | cut -d'=' -f2)
NETWORK=$(grep "VITE_SOLANA_NETWORK" .env | cut -d'=' -f2)

echo "📍 Fee Wallet: $FEE_WALLET"
echo "🌐 Network: $NETWORK"
echo ""

echo "💰 Current Balance:"
solana balance $FEE_WALLET --url $NETWORK

echo ""
echo "📊 Recent Transactions:"
solana transaction-history $FEE_WALLET --url $NETWORK --limit 5

echo ""
echo "🔗 Quick Links:"
echo "   Web Monitor: http://localhost:3002/pumpClone/feeWallet"
echo "   Explorer: https://explorer.solana.com/address/$FEE_WALLET?cluster=$NETWORK"
echo ""
echo "💡 To watch live updates:"
echo "   watch -n 5 'solana balance $FEE_WALLET --url $NETWORK'" 
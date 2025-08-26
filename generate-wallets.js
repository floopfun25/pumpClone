#!/usr/bin/env node

// FloppFun Wallet Generation Script
// This script generates secure wallets for platform operations

const { Keypair } = require('@solana/web3.js');
const fs = require('fs');

console.log('🔐 FloppFun Wallet Generator');
console.log('==========================\n');

// Generate wallets
const wallets = {
    feeWallet: Keypair.generate(),
    authority: Keypair.generate(), 
    treasury: Keypair.generate(),
    feeCollector: Keypair.generate()
};

console.log('✅ Generated secure wallets:\n');

// Display public keys (safe to show)
Object.entries(wallets).forEach(([name, keypair]) => {
    console.log(`${name}:`);
    console.log(`  Public Key:  ${keypair.publicKey.toBase58()}`);
    console.log(`  Private Key: [HIDDEN - Check secure files]\n`);
});

// Create secure directory for private keys
const secureDir = './secure-keys';
if (!fs.existsSync(secureDir)) {
    fs.mkdirSync(secureDir, { mode: 0o700 }); // Only owner can read/write/execute
}

// Save private keys securely (only for server use)
Object.entries(wallets).forEach(([name, keypair]) => {
    const filename = `${secureDir}/${name}-keypair.json`;
    fs.writeFileSync(filename, JSON.stringify(Array.from(keypair.secretKey)), { mode: 0o600 });
    console.log(`🔒 Saved private key: ${filename}`);
});

// Create environment configuration
const envConfig = `# FloppFun Devnet Configuration (Generated ${new Date().toISOString()})
# Copy this to .env.local

# Solana Network
VITE_SOLANA_NETWORK=devnet
VITE_DEVNET_RPC_URL=https://api.devnet.solana.com

# FloppFun Deployed Programs (Update after deployment)
VITE_DEVNET_BONDING_CURVE_PROGRAM=YOUR_DEPLOYED_PROGRAM_ID_HERE
VITE_DEVNET_TOKEN_FACTORY_PROGRAM=TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA
VITE_METADATA_PROGRAM=metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s

# Platform Wallets (Generated securely)
VITE_DEVNET_FEE_WALLET=${wallets.feeWallet.publicKey.toBase58()}
VITE_DEVNET_AUTHORITY=${wallets.authority.publicKey.toBase58()}
VITE_DEVNET_TREASURY=${wallets.treasury.publicKey.toBase58()}
VITE_DEVNET_FEE_COLLECTOR=${wallets.feeCollector.publicKey.toBase58()}

# Supabase (Update with your credentials)
VITE_SUPABASE_URL=https://osqniqjbbenjmhehoykv.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9zcW5pcWpiYmVuam1oZWhveWt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg1NDM5NzYsImV4cCI6MjA2NDExOTk3Nn0.hHkHKivLHqOx4Ne9Bn9BOb6dAsCh_StBJ0YHGw0qwOc

# App Environment
VITE_APP_ENV=development
NODE_ENV=development
`;

fs.writeFileSync('generated-devnet-config.env', envConfig);

console.log('\n🎉 Wallet generation completed!');
console.log('\n📋 Next Steps:');
console.log('1. Copy generated-devnet-config.env to .env.local');
console.log('2. Add secure-keys/ to .gitignore (if not already added)');
console.log('3. Fund your wallets with devnet SOL:');
console.log(`   solana airdrop 10 ${wallets.feeWallet.publicKey.toBase58()} --url devnet`);
console.log(`   solana airdrop 10 ${wallets.treasury.publicKey.toBase58()} --url devnet`);
console.log('\n⚠️  IMPORTANT: Keep private keys secure and never commit to git!');

// Update .gitignore to exclude sensitive files
const gitignoreContent = `
# FloppFun Security - Never commit these!
secure-keys/
*.json
fee-wallet-*.json
treasury-wallet-*.json
.env.local
.env.production
`;

fs.appendFileSync('.gitignore', gitignoreContent);
console.log('✅ Updated .gitignore to exclude sensitive files');
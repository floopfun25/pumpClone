# 🚀 Deploy Your Rust Program NOW

## Current Status: NOT DEPLOYED ❌

Your bonding curve program is ready but not deployed. Your Windows environment lacks the required build tools.

## 🎯 FASTEST DEPLOYMENT METHOD

### Option 1: GitHub Codespaces (RECOMMENDED - 5 minutes)

1. **Push your code to GitHub** (if not already):
   ```bash
   git add .
   git commit -m "Ready for mainnet deployment"
   git push origin main
   ```

2. **Open GitHub Codespaces**:
   - Go to your GitHub repository
   - Click green "Code" button
   - Select "Codespaces" tab
   - Click "Create codespace on main"

3. **Deploy in Codespaces** (all tools pre-installed):
   ```bash
   # Codespaces has everything ready
   npm install
   ./deploy-mainnet.sh
   ```

### Option 2: Solana Playground (EASIEST - 2 minutes)

1. **Go to**: https://beta.solpg.io
2. **Create new project**
3. **Copy your program code**:
   - Copy contents of `programs/bonding-curve/src/lib.rs`
   - Paste into Solana Playground
4. **Update Cargo.toml**:
   ```toml
   [package]
   name = "bonding-curve"
   version = "0.1.0"
   edition = "2021"

   [lib]
   crate-type = ["cdylib", "lib"]
   name = "bonding_curve"

   [dependencies]
   anchor-lang = "0.31.1"
   anchor-spl = "0.31.1"
   ```
5. **Build & Deploy**:
   - Click "Build"
   - Connect wallet with SOL
   - Click "Deploy" to mainnet

### Option 3: Fix Windows Environment

Install Visual Studio Build Tools:
1. Download Visual Studio Installer
2. Install "C++ build tools" workload
3. Restart terminal
4. Install Solana CLI:
   ```bash
   sh -c "$(curl -sSfL https://release.solana.com/v1.18.17/install)"
   ```
5. Install Anchor:
   ```bash
   cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
   ```

## 💰 Funding Requirements

You need a Solana wallet with:
- **10-15 SOL** for program deployment
- **1-2 SOL** for account creation
- **1 SOL** for testing

## 🔧 What Happens During Deployment

1. **Program Compilation**: Your Rust code → Solana bytecode
2. **Program Deployment**: Upload to Solana mainnet
3. **Program ID Generation**: Unique address for your program
4. **Wallet Generation**: Secure production wallets
5. **Frontend Update**: Program ID updated in config

## 📋 Post-Deployment Tasks

After successful deployment:

1. **Get your Program ID** (will look like): `Hg4PXsCRaVRjeYgx75GJioGqCQ6GiGWGGHTnpcTLE9CY`
2. **Update frontend config** with new Program ID
3. **Test with small amounts** (0.1 SOL)
4. **Launch to production**

## 🚨 CRITICAL: Current Program Configuration

Your program is configured with:
- **Program ID**: `Hg4PXsCRaVRjeYgx75GJioGqCQ6GiGWGGHTnpcTLE9CY` (needs deployment)
- **Network**: Currently set for devnet → needs mainnet deployment
- **Features**: ✅ Bonding curve ✅ Buy/sell ✅ Fees ✅ Graduation

## 🎯 RECOMMENDED NEXT STEPS

1. **Use GitHub Codespaces** (fastest option)
2. **Fund wallet with 15 SOL**
3. **Run deployment script**
4. **Update frontend with Program ID**
5. **Test and launch!**

## ⚡ Quick Commands Reference

```bash
# In Codespaces/Linux environment:
npm install                    # Install dependencies
./deploy-mainnet.sh           # Deploy everything
npm run mainnet:build         # Build frontend for mainnet
npm run preview:production    # Test production build
```

---

**Your pump.fun clone is 99% ready - you just need to deploy the Rust program!**
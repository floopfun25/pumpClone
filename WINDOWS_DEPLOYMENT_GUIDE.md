# 🪟 Windows Deployment Guide

Since Solana CLI installation can be challenging on Windows, here are several proven approaches for deploying your pump.fun clone to mainnet:

## 🐳 Option 1: Docker Deployment (Recommended)

This is the easiest and most reliable method for Windows users.

### Prerequisites
1. Install [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/)

### Steps
1. Create a Dockerfile for deployment:

```dockerfile
# Dockerfile.deploy
FROM rust:1.70-bullseye

# Install Solana CLI
RUN sh -c "$(curl -sSfL https://release.solana.com/v1.18.17/install)"
ENV PATH="/root/.local/share/solana/install/active_release/bin:$PATH"

# Install Anchor CLI  
RUN cargo install --git https://github.com/coral-xyz/anchor anchor-cli --locked

WORKDIR /app
COPY . .

# Build the program
RUN anchor build

# Expose the built program
VOLUME ["/app/target"]

CMD ["bash"]
```

2. Run deployment commands:

```bash
# Build the Docker container
docker build -f Dockerfile.deploy -t pump-deploy .

# Run container and get a shell
docker run -it -v "%cd%:/app" pump-deploy bash

# Inside the container:
solana config set --url mainnet-beta
solana-keygen new --outfile ~/.config/solana/id.json
# Fund your wallet with SOL
solana program deploy target/deploy/bonding_curve.so
```

## 🐧 Option 2: WSL (Windows Subsystem for Linux)

### Prerequisites
1. Install WSL2 from Microsoft Store (Ubuntu recommended)
2. Open Ubuntu terminal

### Steps
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env

# Install Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/v1.18.17/install)"
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

# Install Anchor CLI
cargo install --git https://github.com/coral-xyz/anchor anchor-cli --locked

# Navigate to your project (mounted at /mnt/c/)
cd /mnt/c/Users/Computer/Desktop/pumpclone/pumpClone

# Build and deploy
anchor build
solana config set --url mainnet-beta
solana program deploy target/deploy/bonding_curve.so
```

## ☁️ Option 3: GitHub Codespaces

### Steps
1. Push your code to GitHub
2. Create a Codespace
3. Install tools in the cloud environment:

```bash
# Install Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/v1.18.17/install)"
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

# Install Anchor CLI
cargo install --git https://github.com/coral-xyz/anchor anchor-cli --locked

# Build and deploy
anchor build
solana config set --url mainnet-beta
solana program deploy target/deploy/bonding_curve.so
```

## 🔧 Option 4: Manual Binary Download

If you prefer to try manual installation:

1. Download the latest Windows binary from: https://github.com/anza-xyz/agave/releases
2. Extract to `C:\solana\`
3. Add `C:\solana\bin` to your Windows PATH
4. Open a new Command Prompt and test: `solana --version`

## 📋 Pre-Deployment Checklist

Before deploying to mainnet:

- [ ] **Code is audited and tested thoroughly on devnet**
- [ ] **You have at least 2-5 SOL for deployment costs**
- [ ] **All environment variables are configured**
- [ ] **Backup of all keys is stored securely**
- [ ] **Program upgrade authority plan is in place**

## 🚀 Deployment Steps (Any Method)

Once you have Solana CLI working:

```bash
# 1. Configure for mainnet
solana config set --url mainnet-beta

# 2. Create or import your deployer wallet
solana-keygen new --outfile ~/.config/solana/id.json

# 3. Fund your wallet (you'll need 2-5 SOL)
# Send SOL to: solana-keygen pubkey ~/.config/solana/id.json

# 4. Build the program (if not already built)
anchor build

# 5. Deploy to mainnet
solana program deploy target/deploy/bonding_curve.so

# 6. Get your program ID
solana-keygen pubkey target/deploy/bonding_curve-keypair.json
```

## ⚠️ Security Warnings

- **NEVER commit private keys to version control**
- **Test thoroughly on devnet first**
- **Start with small amounts on mainnet**
- **Have an emergency plan ready**
- **Keep backups of all keys in a secure location**

## 💰 Cost Estimation

- Program deployment: ~1-2 SOL
- Transaction fees: ~0.000005 SOL per transaction
- Account rent: Varies by account size

## 🆘 Need Help?

If you encounter issues:
1. Check the deployment logs carefully
2. Verify you're on the correct network (`solana config get`)
3. Ensure your wallet has sufficient balance
4. Test on devnet first with: `solana config set --url devnet`

---

**Remember**: Mainnet deployment involves real money. Take your time and test everything thoroughly on devnet first!
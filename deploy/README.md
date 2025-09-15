# 🚀 Production Deployment Guide

This directory contains professional-grade deployment scripts for your pump.fun clone.

## 📋 Quick Start

### 1. Initial Setup
```bash
# Make scripts executable (Linux/Mac)
chmod +x deploy/*.sh

# Run initial setup
./deploy/setup.sh
```

### 2. Configuration
```bash
# Configure deployment environment
./deploy/configure.sh
```

### 3. Build Program
```bash
# Build optimized program for production
./deploy/build.sh
```

### 4. Test Deployment
```bash
# Deploy and test on devnet
./deploy/test-deploy.sh
```

### 5. Production Deployment
```bash
# Deploy to mainnet (⚠️ Uses real SOL!)
./deploy/mainnet-deploy.sh
```

## 📁 File Structure

```
deploy/
├── setup.sh           # Install development tools
├── configure.sh       # Configure deployment environment  
├── build.sh           # Build program with optimizations
├── test-deploy.sh     # Deploy to devnet for testing
├── mainnet-deploy.sh  # Production mainnet deployment
└── README.md          # This file

keys/                  # Generated deployment keys (KEEP SECURE!)
├── deployer-keypair.json    # Wallet for deploying programs
└── program-keypair.json     # Program ID keypair

logs/                  # Deployment logs and reports
backups/               # Deployment backups
```

## 🔐 Security Best Practices

### Key Management
- **NEVER** commit keys to version control
- Store keys in a secure location with proper backups
- Use hardware wallets for mainnet deployments when possible
- Consider multi-signature setups for upgrade authority

### Pre-Deployment Checklist
- [ ] Code has been audited for security vulnerabilities
- [ ] All tests pass on devnet
- [ ] Program logic has been thoroughly tested
- [ ] Economic parameters are correctly configured
- [ ] Emergency procedures are documented

### Post-Deployment
- [ ] Verify program on multiple blockchain explorers
- [ ] Test with small amounts first
- [ ] Set up monitoring and alerting
- [ ] Document all program addresses and keys
- [ ] Plan upgrade authority transfer if needed

## 💰 Cost Estimation

### Devnet (Free)
- Program deployment: 0 SOL (testnet)
- Testing transactions: 0 SOL (testnet)

### Mainnet (Real Costs)
- Program deployment: ~1-2 SOL
- Transaction fees: ~0.000005 SOL per transaction
- Account rent: Varies by account size

## 🛡️ Emergency Procedures

### If Deployment Fails
1. Check deployer wallet balance
2. Verify network connectivity
3. Check for program ID conflicts
4. Review deployment logs

### If Program Has Issues
1. Do NOT panic redeploy
2. Analyze the issue thoroughly
3. Test fixes on devnet first
4. Consider program upgrade vs new deployment

### Program Upgrade Process
```bash
# Build new version
./deploy/build.sh

# Test on devnet
./deploy/test-deploy.sh

# Deploy upgrade to mainnet
solana program deploy \
  --keypair keys/deployer-keypair.json \
  --program-id keys/program-keypair.json \
  --upgrade-authority keys/deployer-keypair.json \
  target/deploy/bonding_curve.so
```

## 📊 Monitoring & Analytics

### Recommended Monitoring
- Transaction volume and success rates
- Program account changes
- Economic metrics (fees collected, trades executed)
- Error rates and failure modes

### Useful Commands
```bash
# Check program info
solana program show <PROGRAM_ID>

# View program logs
solana logs <PROGRAM_ID>

# Check account data
solana account <ACCOUNT_ADDRESS>

# Monitor transactions
solana transaction-history <SIGNATURE>
```

## 🔧 Troubleshooting

### Common Issues

**"Insufficient funds for deployment"**
- Fund deployer wallet with enough SOL
- Check current network (devnet vs mainnet)

**"Program ID already in use"**
- Generate new program keypair
- Update Anchor.toml and lib.rs with new ID

**"Account not found"**
- Verify you're on the correct network
- Check account addresses are correct

**"Program upgrade failed"**
- Verify upgrade authority
- Ensure program binary is valid
- Check available compute units

### Getting Help
- Check Solana documentation: https://docs.solana.com
- Anchor framework docs: https://www.anchor-lang.com
- Solana Stack Exchange: https://solana.stackexchange.com

## ⚠️ Legal & Compliance

Before deploying to mainnet:
- Understand your local regulations regarding DeFi protocols
- Consider legal structure and compliance requirements
- Implement proper risk disclosures for users
- Consult with legal professionals if needed

## 📞 Support

For deployment support:
1. Check the troubleshooting section
2. Review deployment logs in `logs/` directory
3. Test thoroughly on devnet before mainnet
4. Seek help from Solana developer community

---

**Remember**: Deploying to mainnet involves real financial risk. Test extensively and proceed with caution.
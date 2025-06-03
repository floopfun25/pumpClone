# Embedded Wallet Setup Guide

## Magic.link Integration

Your app now includes **Magic.link embedded wallets** for universal platform support!

### 🔧 **Setup Instructions**

1. **Get Magic API Key:**
   - Visit [magic.link dashboard](https://dashboard.magic.link)
   - Create a free account
   - Create a new project
   - Copy your **Publishable Key**

2. **Add Environment Variable:**
   ```bash
   # In your .env file (create if it doesn't exist)
   VITE_MAGIC_PUBLISHABLE_KEY=pk_live_YOUR_MAGIC_KEY_HERE
   ```

3. **Update Your Magic Key:**
   - Open `src/services/embeddedWallet.ts`
   - Replace the placeholder key on line 62 with your real key

### ✨ **What You Get**

**Universal Platform Support:**
- ✅ **iOS Safari/Chrome** - Embedded wallet works
- ✅ **Android Chrome** - Both MWA + Embedded wallets
- ✅ **Desktop** - Browser extensions + Embedded wallet
- ✅ **Any browser** - Email/SMS login always works

**User Experience:**
- **Email/SMS login** - No app installs required
- **Social logins** - Google, Apple, Facebook (configurable)
- **Secure storage** - Keys managed by Magic's infrastructure
- **Cross-platform** - Same wallet across all devices

### 📱 **How It Works**

**For Mobile Users:**
1. Click "Magic (Email/SMS)" in wallet list
2. Enter email or phone number
3. Receive verification code
4. Auto-create Solana wallet
5. Start trading immediately

**For Desktop Users:**
1. See all options: Phantom, Solflare, Magic
2. Can choose embedded wallet or browser extension
3. Email login creates persistent wallet

### 🔒 **Security**

- **Non-custodial**: You don't store private keys
- **Magic security**: Enterprise-grade key management
- **User control**: Users own their wallet via email/SMS
- **Standard Solana**: Full compatibility with Solana ecosystem

### 🎯 **Benefits vs External Wallets**

| Feature | External Wallets | Embedded Wallets |
|---------|-----------------|------------------|
| iOS Support | ❌ Limited | ✅ Full support |
| User onboarding | Complex (app install) | Simple (email) |
| Cross-platform | Device-specific | Universal |
| Maintenance | Multiple integrations | Single integration |

### 🚀 **Testing**

Test on multiple platforms:
- **Desktop Chrome**: All wallet options
- **Mobile Chrome**: MWA + Embedded options  
- **iOS Safari**: Only embedded wallet
- **Any browser**: Email login always works

Your users now have a **seamless, universal wallet experience** across all platforms! 🎉 
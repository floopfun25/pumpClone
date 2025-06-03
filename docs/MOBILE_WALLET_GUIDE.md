# Mobile Wallet Connection Guide

This guide explains how mobile wallet connections work in FloppFun and how to resolve common issues.

## Overview

Mobile wallet connections work differently than desktop browser extension connections. Instead of detecting installed browser extensions, mobile apps use **deeplinks** to communicate with wallet apps.

## How Mobile Wallet Connections Work

1. **User clicks "Connect Wallet"** in the mobile browser
2. **App creates a deeplink** to the wallet app (e.g., Phantom)
3. **Mobile OS opens the wallet app** if installed
4. **User approves the connection** in the wallet app
5. **User returns to the browser** either manually or via redirect
6. **App detects the return** and completes the connection

## Common Issues and Solutions

### "Not Installed" on Mobile Chrome Android

**Problem**: Phantom shows as "not installed" in mobile Chrome browser even though the app is installed.

**Why this happens**: 
- Browser extensions don't exist on mobile
- The wallet adapter library checks for `window.phantom` which doesn't exist in mobile browsers
- Mobile apps communicate via deeplinks, not JavaScript injection

**Solution**: Our app now properly detects mobile devices and:
- Shows Phantom as available on mobile regardless of "installation" status
- Uses deeplinks to connect to the wallet app
- Provides proper mobile-specific UI and messaging

### Phantom App Not Opening

**If the Phantom app doesn't open when you tap "Connect":**

1. **Check if Phantom is installed**:
   - Look for the Phantom app icon on your device
   - If not installed, download from [App Store](https://apps.apple.com/app/phantom-solana-wallet/1598432977) (iOS) or [Play Store](https://play.google.com/store/apps/details?id=app.phantom) (Android)

2. **Clear browser cache** (sometimes helps with deeplink handling):
   - Chrome Android: Settings > Privacy > Clear browsing data
   - Safari iOS: Settings > Safari > Clear History and Website Data

3. **Try manual connection**:
   - Open Phantom app manually
   - Look for "Connect to website" or "WalletConnect" option
   - Enter the website URL if prompted

### Connection Not Completing

**If the app opens but connection doesn't complete:**

1. **Make sure you approve the connection** in the Phantom app
2. **Return to the browser** by:
   - Tapping the back button
   - Using the app switcher
   - Or looking for a "Return to website" button in Phantom
3. **Check the browser tab** - the connection should complete automatically

## Technical Implementation

### For Developers

The mobile wallet connection system includes:

#### Mobile Detection (`src/utils/mobile.ts`)
```typescript
export const isMobile = (): boolean => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
}
```

#### Deeplink Creation (`src/utils/walletDeeplink.ts`)
```typescript
export const createPhantomDeeplink = (options: DeeplinkOptions = {}) => {
  const dappUrl = encodeURIComponent(window.location.origin)
  return `https://phantom.app/ul/v1/browse/${dappUrl}?ref=${redirectUrl}&cluster=${cluster}`
}
```

#### Mobile-Specific Wallet Service (`src/services/wallet.ts`)
- Detects mobile devices
- Shows deeplink-compatible wallets as "available"
- Handles deeplink generation and opening
- Manages connection state for returning users

#### UI Adaptations (`src/components/common/WalletModal.vue`)
- Mobile-specific messaging
- Different connection instructions
- Direct app store links when apps aren't installed

## Supported Wallets

Currently supported for mobile deeplink connections:
- **Phantom** ✅ (Full support)
- **Solflare** ✅ (Basic support)

## Best Practices for Users

1. **Always install the wallet app first** before trying to connect
2. **Keep wallet apps updated** for best compatibility
3. **Use the latest browser version** for better deeplink support
4. **Don't close the browser tab** while connecting - return to it after approving in the wallet app
5. **If connection fails**, try refreshing the page and connecting again

## Troubleshooting

### Network Issues
- Make sure you're on the correct network (Mainnet, Devnet, etc.)
- Check if the dapp supports your chosen network

### App Crashes
- Force close and reopen the wallet app
- Clear the wallet app's cache if needed
- Restart your device if problems persist

### Browser Issues
- Try a different browser (Chrome, Safari, Firefox)
- Disable ad blockers that might interfere with deeplinks
- Enable JavaScript and allow pop-ups for the website

## Support

If you continue to experience issues:

1. **Check the browser console** for error messages (Developer Tools)
2. **Try on a different device** to isolate the issue
3. **Contact support** with details about:
   - Device type and OS version
   - Browser type and version
   - Wallet app version
   - Exact error messages

## Additional Resources

- [Phantom Mobile Documentation](https://docs.phantom.app/phantom-deeplinks)
- [Solana Wallet Adapter Documentation](https://github.com/solana-labs/wallet-adapter)
- [Mobile Wallet Best Practices](https://docs.solana.com/wallet-guide) 
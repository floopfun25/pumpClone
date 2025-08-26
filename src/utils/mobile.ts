/**
 * Mobile device detection utilities
 */

// Check if current device is mobile
export const isMobile = (): boolean => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  );
};

// Check if current device is Android
export const isAndroid = (): boolean => {
  return /Android/i.test(navigator.userAgent);
};

// Check if current device is iOS
export const isIOS = (): boolean => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
};

// Check if current device is tablet
export const isTablet = (): boolean => {
  return (
    /iPad/.test(navigator.userAgent) ||
    (/Android/i.test(navigator.userAgent) &&
      !/Mobile/i.test(navigator.userAgent))
  );
};

// Check if running in mobile browser
export const isMobileBrowser = (): boolean => {
  return isMobile() && !isStandalone();
};

// Check if running as standalone app (PWA)
export const isStandalone = (): boolean => {
  return (
    (window.matchMedia &&
      window.matchMedia("(display-mode: standalone)").matches) ||
    (window.navigator as any).standalone === true
  );
};

// Get device type string
export const getDeviceType = (): "mobile" | "tablet" | "desktop" => {
  if (isTablet()) return "tablet";
  if (isMobile()) return "mobile";
  return "desktop";
};

// Check if device supports deeplinks
export const supportsDeeplinks = (): boolean => {
  return isMobile();
};

// Get app store URL for Phantom
export const getPhantomDownloadUrl = (): string => {
  if (isIOS()) {
    return "https://apps.apple.com/app/phantom-solana-wallet/1598432977";
  } else if (isAndroid()) {
    return "https://play.google.com/store/apps/details?id=app.phantom";
  }
  return "https://phantom.app/download";
};

// Get appropriate wallet connection message
export const getWalletConnectionMessage = (walletName: string): string => {
  if (isMobile()) {
    return `Opening ${walletName} app...`;
  }
  return `Connecting to ${walletName}...`;
};

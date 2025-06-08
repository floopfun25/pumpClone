# FloppFun Translation System

## Overview

FloppFun now supports internationalization (i18n) with comprehensive translations in 10 major languages. The system automatically detects the user's browser language and persists their language preference in localStorage.

## Supported Languages

| Language | Code | Flag | RTL Support |
|----------|------|------|-------------|
| English | `en` | 🇺🇸 | No |
| Spanish | `es` | 🇪🇸 | No |
| Chinese | `zh` | 🇨🇳 | No |
| Hindi | `hi` | 🇮🇳 | No |
| Arabic | `ar` | 🇸🇦 | Yes |
| Portuguese | `pt` | 🇧🇷 | No |
| Bengali | `bn` | 🇧🇩 | No |
| Russian | `ru` | 🇷🇺 | No |
| French | `fr` | 🇫🇷 | No |
| Turkish | `tr` | 🇹🇷 | No |

## Features

### 🌐 Automatic Language Detection
- Detects user's browser language on first visit
- Falls back to English if browser language is not supported
- Respects user's saved preference on subsequent visits

### 💾 Persistent Language Preference
- Saves language selection to `localStorage` with key `floppfun-language`
- Persists across browser sessions
- Automatically loads saved language on app startup

### 🎯 Language Selector Component
- Permanently visible in the top-right corner of the navbar
- Shows current language flag and code
- Dropdown menu with all available languages
- Smooth transitions and hover effects
- Mobile-responsive design

### 🔄 RTL Support
- Full right-to-left layout support for Arabic
- Automatically applies RTL styles when Arabic is selected
- Proper text direction and element positioning

## Implementation Details

### Core Files

#### `src/i18n/index.ts`
Main i18n configuration file that:
- Initializes Vue i18n with Composition API
- Defines supported languages with metadata
- Handles browser language detection
- Manages localStorage persistence
- Provides utility functions for language management

#### Translation Files
Located in `src/i18n/locales/`:
- `en.json` - English (base template)
- `es.json` - Spanish
- `zh.json` - Chinese (Simplified)
- `hi.json` - Hindi
- `ar.json` - Arabic (with RTL support)
- `pt.json` - Portuguese (Brazilian)
- `bn.json` - Bengali
- `ru.json` - Russian
- `fr.json` - French
- `tr.json` - Turkish

### Translation Structure

Each translation file follows a consistent structure:

```json
{
  "app": {
    "name": "FloppFun",
    "tagline": "Platform tagline"
  },
  "navigation": {
    "home": "Home",
    "create": "Create Token",
    "leaderboard": "Leaderboard",
    "about": "About",
    "profile": "Profile",
    "portfolio": "Portfolio",
    "search": "Search",
    "settings": "Settings"
  },
  "wallet": {
    "connect": "Connect Wallet",
    "disconnect": "Disconnect",
    "connecting": "Connecting...",
    "connected": "Connected",
    "balance": "Balance"
  },
  "token": {
    "create": "Create Token",
    "name": "Token Name",
    "symbol": "Symbol",
    "description": "Description"
  },
  "dashboard": {
    "stats": {
      "totalTokens": "Total Tokens",
      "totalVolume": "Total Volume"
    }
  },
  "trading": {
    "buy": "Buy",
    "sell": "Sell",
    "amount": "Amount"
  },
  "messages": {
    "success": {
      "walletConnected": "Wallet connected successfully"
    },
    "error": {
      "walletConnection": "Failed to connect wallet"
    },
    "info": {
      "loading": "Loading...",
      "processing": "Processing..."
    }
  },
  "forms": {
    "required": "This field is required",
    "invalidEmail": "Invalid email address"
  },
  "time": {
    "now": "now",
    "ago": "ago"
  },
  "common": {
    "yes": "Yes",
    "no": "No",
    "ok": "OK",
    "cancel": "Cancel"
  }
}
```

## Usage

### In Vue Components

Use the `$t()` function in templates:

```vue
<template>
  <div>
    <h1>{{ $t('app.name') }}</h1>
    <button>{{ $t('wallet.connect') }}</button>
    <p>{{ $t('messages.info.loading') }}</p>
  </div>
</template>
```

Use the `useI18n` composable in script setup:

```vue
<script setup>
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const welcomeMessage = computed(() => t('messages.success.walletConnected'))
</script>
```

### With Parameters

Some translations support parameter interpolation:

```vue
<template>
  <p>{{ $t('wallet.installWallet', { wallet: 'Phantom' }) }}</p>
</template>
```

### Language Selection

The language selector component is automatically included in the navbar and provides:
- Current language display with flag and code
- Dropdown with all available languages
- Automatic RTL switching for Arabic
- localStorage persistence

## Development Guidelines

### Adding New Translations

1. Add the translation key to `en.json` first (base template)
2. Update all other language files with appropriate translations
3. Use clear, descriptive keys that indicate the context
4. Group related translations logically

### Key Naming Conventions

- Use dot notation for nested structures
- Keep keys descriptive but concise
- Group by feature/component area
- Use camelCase for consistency

Examples:
```
wallet.connect
messages.error.walletConnection
token.create
dashboard.stats.totalVolume
```

### Translation Best Practices

1. **Context-Aware**: Provide enough context in key names
2. **Consistent Tone**: Maintain consistent tone across languages
3. **Cultural Sensitivity**: Consider cultural differences in translations
4. **Length Considerations**: Account for text expansion in different languages
5. **Parameter Support**: Use parameters for dynamic content

## RTL (Right-to-Left) Support

Arabic language includes full RTL support:

### Automatic RTL Activation
When Arabic is selected, the system automatically:
- Sets `dir="rtl"` on the HTML element
- Adds `rtl` class to the document
- Adjusts component positioning
- Reverses flex directions where appropriate

### CSS RTL Support
Components include RTL-specific styles:

```css
/* RTL support in components */
:global(.rtl) .absolute.right-0 {
  right: auto;
  left: 0;
}
```

## Testing

### Language Switching
1. Open the application
2. Click the language selector in the top-right navbar
3. Select different languages from the dropdown
4. Verify translations update immediately
5. Refresh the page to confirm persistence

### RTL Testing
1. Select Arabic from the language selector
2. Verify text flows right-to-left
3. Check that UI elements are properly positioned
4. Confirm navigation and interactions work correctly

### Browser Language Detection
1. Change browser language to a supported language
2. Clear localStorage and cookies
3. Reload the application
4. Verify the detected language is used

## Performance Considerations

- **Lazy Loading**: Consider implementing lazy loading for large translation files
- **Tree Shaking**: Unused translations are automatically removed in production builds
- **Caching**: Translation files are cached by the browser
- **Bundle Size**: Current implementation adds ~50KB to the bundle for all languages

## Future Enhancements

### Planned Features
- [ ] Lazy loading of translation files
- [ ] Pluralization support
- [ ] Date/time localization
- [ ] Number formatting localization
- [ ] Currency formatting
- [ ] Additional language support

### Contributing Translations
To contribute translations for new languages:
1. Copy `src/i18n/locales/en.json` as a template
2. Translate all keys to the target language
3. Add language metadata to `src/i18n/index.ts`
4. Test thoroughly with the language selector
5. Submit a pull request

## Troubleshooting

### Common Issues

**Language not changing:**
- Check browser console for errors
- Verify translation file exists
- Confirm language code is correct

**Missing translations:**
- Check if key exists in translation file
- Verify key path is correct
- Check for typos in key names

**RTL not working:**
- Confirm Arabic is selected
- Check if HTML dir attribute is set
- Verify CSS RTL styles are applied

**LocalStorage not persisting:**
- Check browser privacy settings
- Verify localStorage is available
- Clear cache and test again

## Support

For translation system issues or questions:
1. Check this documentation
2. Review the source code in `src/i18n/`
3. Test with different browsers and devices
4. Report issues with detailed reproduction steps 
import { createI18n } from "vue-i18n";
import type { I18n, Locale } from "vue-i18n";
import { useI18n } from "vue-i18n";

// Import all language files
import en from "./locales/en.json";
import es from "./locales/es.json";
import zh from "./locales/zh.json";
import hi from "./locales/hi.json";
import ar from "./locales/ar.json";
import pt from "./locales/pt.json";
import bn from "./locales/bn.json";
import ru from "./locales/ru.json";
import fr from "./locales/fr.json";
import tr from "./locales/tr.json";

// Define type for language codes
export type LanguageCode =
  | "en"
  | "es"
  | "zh"
  | "hi"
  | "ar"
  | "pt"
  | "bn"
  | "ru"
  | "fr"
  | "tr";

// Define supported languages with their metadata
export const supportedLanguages = [
  { code: "en", name: "English", flag: "🇺🇸", rtl: false },
  { code: "es", name: "Español", flag: "🇪🇸", rtl: false },
  { code: "zh", name: "中文", flag: "🇨🇳", rtl: false },
  { code: "hi", name: "हिन्दी", flag: "🇮🇳", rtl: false },
  { code: "ar", name: "العربية", flag: "🇸🇦", rtl: true },
  { code: "pt", name: "Português", flag: "🇧🇷", rtl: false },
  { code: "bn", name: "বাংলা", flag: "🇧🇩", rtl: false },
  { code: "ru", name: "Русский", flag: "🇷🇺", rtl: false },
  { code: "fr", name: "Français", flag: "🇫🇷", rtl: false },
  { code: "tr", name: "Türkçe", flag: "🇹🇷", rtl: false },
] as const;

// Helper function to validate language codes
function isValidLanguageCode(code: string): code is LanguageCode {
  return supportedLanguages
    .map((lang) => lang.code)
    .includes(code as LanguageCode);
}

// Get initial language from localStorage or browser
export function getInitialLanguage(): LanguageCode {
  try {
    // Try to get language from environment variable first
    const envLocale = import.meta.env.VITE_I18N_LOCALE;
    if (envLocale && isValidLanguageCode(envLocale)) {
      return envLocale;
    }

    // Try to get language from localStorage
    const savedLang = localStorage.getItem("language");
    if (savedLang && isValidLanguageCode(savedLang)) {
      return savedLang;
    }

    // Try to get language from browser
    const browserLang = navigator.language.split("-")[0];
    if (isValidLanguageCode(browserLang)) {
      return browserLang;
    }
  } catch (error) {
    console.warn("Failed to get initial language:", error);
  }

  // Default to English
  return "en";
}

// Save language preference
export function saveLanguage(lang: LanguageCode): void {
  try {
    localStorage.setItem("language", lang);
  } catch (error) {
    console.warn("Failed to save language preference:", error);
  }
}

// Get language info by code
export function getLanguageInfo(code: LanguageCode | string) {
  const lang = supportedLanguages.find((l) => l.code === code);
  return lang || supportedLanguages[0]; // Default to English if not found
}

// Create messages object with type safety
const messages = {
  en,
  es,
  zh,
  hi,
  ar,
  pt,
  bn,
  ru,
  fr,
  tr,
};

// Type for messages
type MessageSchema = typeof en;

// Create i18n instance with strict type checking
export const i18n = createI18n<[MessageSchema], LanguageCode>({
  legacy: false,
  locale: getInitialLanguage(),
  fallbackLocale: "en",
  messages,
  globalInjection: true,
  allowComposition: true,
  missingWarn: false,
  fallbackWarn: false,
  warnHtmlMessage: false,
  silentTranslationWarn: true,
  silentFallbackWarn: true,
  sync: true,
  pluralizationRules: {
    ar: (choice: number) => {
      if (choice === 0) return 0;
      if (choice === 1) return 1;
      if (choice === 2) return 2;
      if (choice >= 3 && choice <= 10) return 3;
      if (choice >= 11 && choice <= 99) return 4;
      return 5;
    },
  },
});

// Export the i18n composable with proper typing
export function useTypedI18n() {
  return useI18n<{ message: MessageSchema }, LanguageCode>({
    useScope: "global",
    inheritLocale: true,
  });
}

export default i18n;

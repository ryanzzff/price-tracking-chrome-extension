import { writable, get } from 'svelte/store';

// Supported languages
export const SUPPORTED_LANGUAGES = {
  ja: 'japanese',
  zh_TW: 'traditionalChinese', 
  en: 'english'
} as const;

export type SupportedLanguage = keyof typeof SUPPORTED_LANGUAGES;

// Current language store
export const currentLanguage = writable<SupportedLanguage>('ja');

// Message cache to store translations for different languages
const messageCache: Record<SupportedLanguage, Record<string, any>> = {
  ja: {},
  zh_TW: {},
  en: {}
};

// Flag to track if messages are loaded
let messagesLoaded = false;

/**
 * Load messages for a specific language from the locale files
 */
async function loadMessages(language: SupportedLanguage): Promise<void> {
  if (messageCache[language] && Object.keys(messageCache[language]).length > 0) {
    return; // Already loaded
  }

  try {
    const response = await fetch(chrome.runtime.getURL(`_locales/${language}/messages.json`));
    if (response.ok) {
      const messages = await response.json();
      messageCache[language] = messages;
      console.log(`i18n: Loaded ${language} messages`);
    } else {
      console.warn(`i18n: Failed to load ${language} messages`);
    }
  } catch (error) {
    console.warn(`i18n: Error loading ${language} messages:`, error);
  }
}

/**
 * Get translated message using Chrome i18n API or fallback to cached messages
 */
export function getMessage(key: string, substitutions?: string | string[]): string {
  // Get current language from store
  const lang = get(currentLanguage);

  try {
    // If we have cached messages for this language, use them
    if (messageCache[lang] && messageCache[lang][key]) {
      const messageData = messageCache[lang][key];
      let message = messageData.message || key;
      
      // Handle substitutions for Chrome extension format ($count$, $1, etc.)
      if (substitutions && Array.isArray(substitutions)) {
        substitutions.forEach((substitution, index) => {
          message = message.replace(`$${index + 1}`, substitution);
          // Also handle named placeholders like $count$
          if (messageData.placeholders) {
            Object.keys(messageData.placeholders).forEach(placeholderKey => {
              const placeholder = messageData.placeholders[placeholderKey];
              if (placeholder.content === `$${index + 1}`) {
                message = message.replace(`$${placeholderKey}$`, substitution);
              }
            });
          }
        });
      } else if (substitutions) {
        message = message.replace('$1', substitutions);
        // Also handle named placeholders
        if (messageData.placeholders) {
          Object.keys(messageData.placeholders).forEach(placeholderKey => {
            const placeholder = messageData.placeholders[placeholderKey];
            if (placeholder.content === '$1') {
              message = message.replace(`$${placeholderKey}$`, substitutions);
            }
          });
        }
      }
      
      return message;
    }

    // Fallback to Chrome's i18n API
    return chrome.i18n.getMessage(key, substitutions) || key;
  } catch (error) {
    console.warn(`i18n: Failed to get message for key "${key}":`, error);
    return key;
  }
}

/**
 * Get translated message with placeholders
 */
export function getMessageWithCount(key: string, count: number): string {
  return getMessage(key, [count.toString()]);
}

/**
 * Initialize i18n system
 */
export async function initializeI18n(): Promise<void> {
  try {
    // Load all message files in parallel
    await Promise.all([
      loadMessages('ja'),
      loadMessages('zh_TW'), 
      loadMessages('en')
    ]);
    messagesLoaded = true;

    // Load saved language preference
    const result = await chrome.storage.sync.get('selectedLanguage');
    const savedLanguage = result.selectedLanguage as SupportedLanguage;
    
    if (savedLanguage && savedLanguage in SUPPORTED_LANGUAGES) {
      currentLanguage.set(savedLanguage);
    } else {
      // Detect browser language and fallback to Japanese if not supported
      const browserLang = chrome.i18n.getUILanguage();
      const detectedLang = detectLanguageFromBrowserLang(browserLang);
      currentLanguage.set(detectedLang);
      
      // Save detected language
      await chrome.storage.sync.set({ selectedLanguage: detectedLang });
    }
  } catch (error) {
    console.warn('i18n: Failed to initialize, using default language:', error);
    currentLanguage.set('ja');
  }
}

/**
 * Change the current language and persist the choice
 */
export async function changeLanguage(language: SupportedLanguage): Promise<void> {
  try {
    // Ensure messages for this language are loaded
    if (!messageCache[language] || Object.keys(messageCache[language]).length === 0) {
      await loadMessages(language);
    }
    
    currentLanguage.set(language);
    await chrome.storage.sync.set({ selectedLanguage: language });
    console.log(`i18n: Language changed to ${language}`);
  } catch (error) {
    console.error('i18n: Failed to save language preference:', error);
  }
}

/**
 * Detect supported language from browser language
 */
function detectLanguageFromBrowserLang(browserLang: string): SupportedLanguage {
  // Normalize the browser language
  const normalizedLang = browserLang.toLowerCase().replace('-', '_');
  
  // Check for exact matches first
  if (normalizedLang === 'zh_tw' || normalizedLang === 'zh_hant') {
    return 'zh_TW';
  }
  
  if (normalizedLang.startsWith('en')) {
    return 'en';
  }
  
  if (normalizedLang.startsWith('ja')) {
    return 'ja';
  }
  
  // Check for Chinese variants that should map to Traditional Chinese
  if (normalizedLang.includes('tw') || normalizedLang.includes('hk') || normalizedLang.includes('mo')) {
    return 'zh_TW';
  }
  
  // Default to Japanese (since this is primarily for Rakuten Japan)
  return 'ja';
}

/**
 * Get the current Chrome extension locale
 */
export function getCurrentLocale(): string {
  return chrome.i18n.getUILanguage();
}

/**
 * Format currency according to current locale
 */
export function formatPrice(price: number, language?: SupportedLanguage): string {
  const lang = language || 'ja'; // Default to Japanese since it's for Rakuten Japan
  
  try {
    switch (lang) {
      case 'ja':
        return new Intl.NumberFormat('ja-JP', {
          style: 'currency',
          currency: 'JPY'
        }).format(price);
      case 'zh_TW':
        return new Intl.NumberFormat('zh-TW', {
          style: 'currency',
          currency: 'JPY'
        }).format(price);
      case 'en':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'JPY'
        }).format(price);
      default:
        return `¥${price.toLocaleString()}`;
    }
  } catch (error) {
    console.warn('i18n: Failed to format price, using fallback:', error);
    return `¥${price.toLocaleString()}`;
  }
}

/**
 * Format date according to current locale
 */
export function formatDate(timestamp: number, language?: SupportedLanguage): string {
  const lang = language || 'ja';
  
  try {
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    
    switch (lang) {
      case 'ja':
        return new Intl.DateTimeFormat('ja-JP', options).format(new Date(timestamp));
      case 'zh_TW':
        return new Intl.DateTimeFormat('zh-TW', options).format(new Date(timestamp));
      case 'en':
        return new Intl.DateTimeFormat('en-US', options).format(new Date(timestamp));
      default:
        return new Date(timestamp).toLocaleString();
    }
  } catch (error) {
    console.warn('i18n: Failed to format date, using fallback:', error);
    return new Date(timestamp).toLocaleString();
  }
}

/**
 * Get availability status message
 */
export function getAvailabilityMessage(availability: string): string {
  switch (availability) {
    case 'available':
      return getMessage('available');
    case 'out_of_stock':
      return getMessage('outOfStock');
    case 'backorder':
      return getMessage('backorder');
    default:
      return getMessage('unknown');
  }
}
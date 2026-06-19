import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { I18nManager, Platform } from 'react-native';

import { en } from './en';
import { ar } from './ar';

export const LANGUAGE_STORAGE_KEY = '@app_language';

type Translations = typeof en;
const translations: Record<string, Translations> = { en, ar };

// Moteur i18n léger, zéro dépendance externe
const createI18n = () => {
  let _locale = 'en';

  const t = (key: string, fallback?: string): string => {
    const lang = translations[_locale] ?? translations['en'];
    const parts = key.split('.');
    let result: any = lang;
    for (const part of parts) {
      if (result == null || typeof result !== 'object') { result = null; break; }
      result = result[part];
    }
    if (typeof result === 'string') return result;
    // Fallback anglais
    result = translations['en'];
    for (const part of parts) {
      if (result == null || typeof result !== 'object') { result = null; break; }
      result = result[part];
    }
    return typeof result === 'string' ? result : (fallback ?? key);
  };

  return {
    get locale() { return _locale; },
    set locale(val: string) { _locale = val; },
    t,
  };
};

const i18n = createI18n();
export default i18n;

// Reload universel : DevSettings en dev, Updates en prod, window.location.reload() sur web
export const reloadApp = async () => {
  if (Platform.OS === 'web') {
    if (typeof document !== 'undefined') {
      const isRTL = i18n.locale === 'ar';
      document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
      window.location.reload();
    }
    return;
  }
  
  if (__DEV__) {
    try {
      const { DevSettings } = require('react-native');
      DevSettings.reload();
    } catch (e) {
      console.warn('DevSettings.reload() not available');
    }
  } else {
    try {
      const Updates = await import('expo-updates');
      await Updates.reloadAsync();
    } catch (e) {
      console.warn('Updates.reloadAsync() failed:', e);
    }
  }
};

export const initI18n = async () => {
  try {
    const savedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (savedLanguage === 'en' || savedLanguage === 'ar') {
      i18n.locale = savedLanguage;
    } else {
      const locales = Localization.getLocales();
      const deviceLang = locales[0]?.languageCode ?? 'en';
      i18n.locale = deviceLang === 'ar' ? 'ar' : 'en';
    }
    const isRTL = i18n.locale === 'ar';
    I18nManager.allowRTL(isRTL);
    I18nManager.forceRTL(isRTL);
    
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    }
  } catch (e) {
    i18n.locale = 'en';
  }
};

export const changeLanguage = async (lang: 'en' | 'ar') => {
  i18n.locale = lang;
  const isRTL = lang === 'ar';
  I18nManager.allowRTL(isRTL);
  I18nManager.forceRTL(isRTL);
  
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
  }

  await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  await reloadApp();
};

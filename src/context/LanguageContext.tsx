import React, { createContext, useContext, useState, useEffect } from 'react';
import { changeLanguage, LANGUAGE_STORAGE_KEY } from '../i18n';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '../i18n';

interface LanguageContextType {
  locale: string;
  switchLanguage: (lang: 'en' | 'ar') => Promise<void>;
}

const LanguageContext = createContext<LanguageContextType>({
  locale: 'en',
  switchLanguage: async () => {},
});

export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
  const [locale, setLocale] = useState(i18n.locale);

  // Écouter les changements de locale (après reload, la valeur sera déjà correcte)
  useEffect(() => {
    setLocale(i18n.locale);
  }, []);

  const switchLanguage = async (lang: 'en' | 'ar') => {
    i18n.locale = lang; // Set locale in i18n BEFORE updating React State
    setLocale(lang); // Optimistic update pour l'UI
    await changeLanguage(lang); // Sauvegarde + RTL + reload
  };

  return (
    <LanguageContext.Provider value={{ locale, switchLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);

export const useTranslation = () => {
  const { locale } = useLanguage();
  return {
    t: (key: string, fallback?: string) => i18n.t(key, fallback),
    locale,
  };
};

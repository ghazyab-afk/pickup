import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLanguage } from '../context/LanguageContext';

export default function LanguageSelector() {
  const { locale, switchLanguage } = useLanguage();
  const [switching, setSwitching] = React.useState(false);

  const handleSwitch = async (lang: 'en' | 'ar') => {
    if (lang === locale || switching) return;
    setSwitching(true);
    try {
      await switchLanguage(lang);
    } catch (e) {
      console.error(e);
    } finally {
      // In case reload fails or takes time
      setTimeout(() => setSwitching(false), 1000);
    }
  };

  if (switching) {
    return (
      <View className="flex-row items-center px-2">
        <ActivityIndicator size="small" color="#2563eb" />
      </View>
    );
  }

  return (
    <View className="flex-row bg-slate-100 rounded-full p-1">
      <TouchableOpacity
        onPress={() => handleSwitch('en')}
        className={`px-3 py-1.5 rounded-full ${locale === 'en' ? 'bg-white shadow-sm' : ''}`}
        accessibilityLabel="Switch to English"
      >
        <Text className={`text-sm font-bold ${locale === 'en' ? 'text-blue-600' : 'text-slate-500'}`}>
          EN
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => handleSwitch('ar')}
        className={`px-3 py-1.5 rounded-full ${locale === 'ar' ? 'bg-white shadow-sm' : ''}`}
        accessibilityLabel="Switch to Arabic"
      >
        <Text className={`text-sm font-bold ${locale === 'ar' ? 'text-blue-600' : 'text-slate-500'}`}>
          عربي
        </Text>
      </TouchableOpacity>
    </View>
  );
}

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../context/LanguageContext';

export default function ClientProfileScreen() {
  const { signOut, profile } = useAuth();
  const { t } = useTranslation();
  
  return (
    <View className="flex-1 bg-slate-50 pt-16 md:pt-24 px-6 md:px-20 lg:px-48">
      <Text className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-slate-800 mb-2 md:mb-4">
        {profile?.first_name ?? t('auth.client')}
      </Text>
      <Text className="text-slate-500 font-medium text-lg md:text-xl lg:text-2xl mb-10 md:mb-16">
        {t('auth.client')}
      </Text>
      

      <TouchableOpacity 
        className="w-full bg-red-500 rounded-xl py-4 md:py-6 flex-row justify-center items-center shadow-sm"
        onPress={signOut}
      >
        <Text className="text-white text-lg md:text-xl lg:text-2xl font-bold">{t('profile.logout')}</Text>
      </TouchableOpacity>
    </View>
  );
}


import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { supabase } from '../../services/supabase';
import { useTranslation } from '../../context/LanguageContext';

export default function LoginScreen({ navigation }: any) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert(t('common.error'), t('common.error'));
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      Alert.alert(t('common.error'), error.message);
    }
    setLoading(false);
  };

  return (
    <View className="flex-1 bg-slate-50 justify-center px-6 md:px-20 lg:px-48">
      
      <View className="mb-10 md:mb-16 mt-10 md:mt-16">
        <Text className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-slate-800 mb-2 md:mb-4">{t('auth.login_title')}</Text>
        <Text className="text-lg md:text-xl lg:text-2xl text-slate-500">{t('auth.login_subtitle')}</Text>
      </View>

      <View className="space-y-4">
        <View>
          <Text className="text-sm md:text-base lg:text-lg font-semibold text-slate-700 mb-1 md:mb-2 ms-1">{t('auth.email')}</Text>
          <TextInput
            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-4 md:py-5 md:px-5 text-base md:text-lg lg:text-xl text-slate-800 text-start"
            placeholder="votre@email.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>

        <View className="mt-4 md:mt-6">
          <Text className="text-sm md:text-base lg:text-lg font-semibold text-slate-700 mb-1 md:mb-2 ms-1">{t('auth.password')}</Text>
          <TextInput
            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-4 md:py-5 md:px-5 text-base md:text-lg lg:text-xl text-slate-800 text-start"
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>

        <TouchableOpacity 
          className="w-full bg-blue-600 rounded-xl py-4 md:py-5 mt-8 md:mt-10 flex-row justify-center items-center shadow-sm"
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
             <ActivityIndicator color="white" size="large" />
          ) : (
            <Text className="text-white text-lg md:text-xl lg:text-2xl font-bold">{t('auth.sign_in')}</Text>
          )}
        </TouchableOpacity>

        <View className="flex-row justify-center mt-6 md:mt-8">
          <Text className="text-slate-500 text-base md:text-lg lg:text-xl">{t('auth.no_account')}</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text className="text-blue-600 font-bold text-base md:text-lg lg:text-xl">{t('auth.register_link')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

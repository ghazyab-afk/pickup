import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { supabase } from '../../services/supabase';
import { useTranslation } from '../../context/LanguageContext';

export default function RegisterScreen({ navigation }: any) {
  const { t } = useTranslation();
  const [role, setRole] = useState<'client' | 'driver'>('client');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!email || !password || !firstName || !lastName) {
      Alert.alert(t('common.error'), t('common.error'));
      return;
    }
    
    setLoading(true);
    
    const { data, error } = await supabase.auth.signUp({ 
      email, 
      password,
    });

    if (error) {
      Alert.alert(t('common.error'), error.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      const { error: profileError } = await supabase.from('users').insert({
        id: data.user.id,
        role: role,
        first_name: firstName,
        last_name: lastName,
      });

      if (profileError) {
        Alert.alert(
          t('common.error'),
          `${t('auth.role_error')}${profileError.message}`
        );
      } else {
        Alert.alert(t('common.success'), t('common.success'));
      }
    }
    
    setLoading(false);
  };

  return (
    <ScrollView className="flex-1 bg-slate-50 md:px-20 lg:px-48" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
      
      <View className="mb-8 mt-4 md:mt-10">
        <Text className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-slate-800 mb-2 md:mb-4">{t('auth.register_title')}</Text>
        <Text className="text-lg md:text-xl lg:text-2xl text-slate-500">{t('auth.register_subtitle')}</Text>
      </View>

      <View className="mb-6 md:mb-8">
        <Text className="text-sm md:text-base lg:text-lg font-semibold text-slate-700 mb-2 ms-1">{t('auth.i_am_a')}</Text>
        <View className="flex-row">
          <TouchableOpacity 
            className={`flex-1 py-4 md:py-5 rounded-xl border-2 flex-row justify-center me-2 ${role === 'client' ? 'bg-blue-50 border-blue-600' : 'bg-white border-slate-200'}`}
            onPress={() => setRole('client')}
          >
            <Text className={`text-base md:text-lg lg:text-xl font-bold ${role === 'client' ? 'text-blue-600' : 'text-slate-500'}`}>{t('auth.client')}</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            className={`flex-1 py-4 md:py-5 rounded-xl border-2 flex-row justify-center ms-2 ${role === 'driver' ? 'bg-blue-50 border-blue-600' : 'bg-white border-slate-200'}`}
            onPress={() => setRole('driver')}
          >
            <Text className={`text-base md:text-lg lg:text-xl font-bold ${role === 'driver' ? 'text-blue-600' : 'text-slate-500'}`}>{t('auth.driver')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View className="space-y-4">
        <View className="flex-row">
          <View className="flex-1 me-2">
            <Text className="text-sm md:text-base lg:text-lg font-semibold text-slate-700 mb-1 md:mb-2 ms-1">{t('auth.first_name')}</Text>
            <TextInput
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-4 md:py-5 md:px-5 text-base md:text-lg lg:text-xl text-slate-800 text-start"
              placeholder="John"
              value={firstName}
              onChangeText={setFirstName}
            />
          </View>
          <View className="flex-1 ms-2">
            <Text className="text-sm md:text-base lg:text-lg font-semibold text-slate-700 mb-1 md:mb-2 ms-1">{t('auth.last_name')}</Text>
            <TextInput
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-4 md:py-5 md:px-5 text-base md:text-lg lg:text-xl text-slate-800 text-start"
              placeholder="Doe"
              value={lastName}
              onChangeText={setLastName}
            />
          </View>
        </View>

        <View className="mt-4 md:mt-6">
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
          onPress={handleRegister}
          disabled={loading}
        >
          {loading ? (
             <ActivityIndicator color="white" size="large" />
          ) : (
            <Text className="text-white text-lg md:text-xl lg:text-2xl font-bold">{t('auth.register_button')}</Text>
          )}
        </TouchableOpacity>

        <View className="flex-row justify-center mt-6 md:mt-8 mb-10 md:mb-16">
          <Text className="text-slate-500 text-base md:text-lg lg:text-xl">{t('auth.already_account')}</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text className="text-blue-600 font-bold text-base md:text-lg lg:text-xl">{t('auth.login_link')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

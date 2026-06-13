import React, { useState } from 'react';
import { 
  View, Text, TouchableOpacity, SafeAreaView, TextInput, 
  KeyboardAvoidingView, Platform, ScrollView 
} from 'react-native';
import { useAuth, UserRole } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation, useLanguage } from '../../context/LanguageContext';
import LanguageSelector from '../../components/LanguageSelector';

export default function CompleteProfileScreen() {
  const { devCompleteProfile, signOut } = useAuth();
  const { t } = useTranslation();
  const { locale } = useLanguage();
  const isRTL = locale.startsWith('ar');

  const [role, setRole] = useState<UserRole | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const isFormValid = role !== null && firstName.trim() !== '' && lastName.trim() !== '' && agreedToTerms;

  const handleSubmit = () => {
    if (isFormValid && devCompleteProfile) {
      devCompleteProfile(firstName.trim(), lastName.trim(), role);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <View className="absolute top-10 md:top-14 right-6 z-50">
        <LanguageSelector />
      </View>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView 
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
          className="px-6 md:px-0"
          keyboardShouldPersistTaps="handled"
        >
          <View className="w-full md:max-w-md md:mx-auto lg:max-w-lg px-0 md:px-8 py-10">
            {/* Header */}
            <View className="items-center mb-10">
              <Text className="text-3xl md:text-4xl font-black text-slate-800 text-center">
                {t('complete_profile.title')}
              </Text>
              <Text className="text-base md:text-lg text-slate-500 text-center mt-2">
                {t('complete_profile.subtitle')}
              </Text>
            </View>

            {/* Role Selection */}
            <View className="flex-row gap-4 mb-8">
              {/* Client Card */}
              <TouchableOpacity
                onPress={() => setRole('client')}
                activeOpacity={0.8}
                className={`flex-1 p-6 rounded-2xl border-2 items-center justify-center ${
                  role === 'client' 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-slate-200 bg-white'
                }`}
              >
                <Ionicons 
                  name="cube-outline" 
                  size={48} 
                  color={role === 'client' ? '#3b82f6' : '#94a3b8'} 
                />
                <Text className={`mt-3 font-bold text-lg md:text-xl text-center ${
                  role === 'client' ? 'text-blue-700' : 'text-slate-600'
                }`}>
                  {t('complete_profile.role_client')}
                </Text>
              </TouchableOpacity>

              {/* Driver Card */}
              <TouchableOpacity
                onPress={() => setRole('driver')}
                activeOpacity={0.8}
                className={`flex-1 p-6 rounded-2xl border-2 items-center justify-center ${
                  role === 'driver' 
                    ? 'border-orange-500 bg-orange-50' 
                    : 'border-slate-200 bg-white'
                }`}
              >
                <Ionicons 
                  name="car-sport-outline" 
                  size={48} 
                  color={role === 'driver' ? '#f97316' : '#94a3b8'} 
                />
                <Text className={`mt-3 font-bold text-lg md:text-xl text-center ${
                  role === 'driver' ? 'text-orange-700' : 'text-slate-600'
                }`}>
                  {t('complete_profile.role_driver')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Inputs */}
            <View className="gap-4 mb-6">
              <View>
                <Text className="text-sm md:text-base font-bold text-slate-600 mb-2 ms-1">
                  {t('complete_profile.first_name')}
                </Text>
                <TextInput
                  className="w-full bg-white border-2 border-slate-200 rounded-2xl px-4 h-14 md:h-16 text-base md:text-lg text-slate-800 focus-within:border-blue-500"
                  placeholder={t('complete_profile.first_name_placeholder')}
                  placeholderTextColor="#94a3b8"
                  value={firstName}
                  onChangeText={setFirstName}
                />
              </View>

              <View>
                <Text className="text-sm md:text-base font-bold text-slate-600 mb-2 ms-1">
                  {t('complete_profile.last_name')}
                </Text>
                <TextInput
                  className="w-full bg-white border-2 border-slate-200 rounded-2xl px-4 h-14 md:h-16 text-base md:text-lg text-slate-800 focus-within:border-blue-500"
                  placeholder={t('complete_profile.last_name_placeholder')}
                  placeholderTextColor="#94a3b8"
                  value={lastName}
                  onChangeText={setLastName}
                />
              </View>
            </View>

            {/* PDPL Privacy Consent */}
            <TouchableOpacity 
              onPress={() => setAgreedToTerms(!agreedToTerms)} 
              activeOpacity={0.7}
              className="flex-row items-start mb-6 bg-blue-50/50 p-4 rounded-xl border border-blue-100"
            >
              <View className={`w-6 h-6 rounded border-2 items-center justify-center mt-1 me-3 ${
                agreedToTerms ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-300'
              }`}>
                {agreedToTerms && <Ionicons name="checkmark" size={16} color="white" />}
              </View>
              <View className="flex-1">
                <Text className="text-sm md:text-base font-bold text-slate-800 mb-1">
                  {t('complete_profile.pdpl_title')}
                </Text>
                <Text className="text-xs md:text-sm text-slate-500 leading-relaxed">
                  {t('complete_profile.pdpl_text')}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Submit Button */}
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={!isFormValid}
              activeOpacity={0.8}
              className={`w-full rounded-2xl py-4 md:py-5 items-center shadow-sm ${
                isFormValid ? 'bg-blue-600' : 'bg-slate-300'
              }`}
            >
              <Text className="text-white text-lg md:text-xl font-extrabold">
                {t('complete_profile.continue')}
              </Text>
            </TouchableOpacity>

            {/* Sign Out Option */}
            <TouchableOpacity onPress={signOut} className="mt-6 items-center p-4">
              <Text className="text-slate-400 font-semibold text-sm md:text-base">
                {t('common.close')} / Sign Out
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

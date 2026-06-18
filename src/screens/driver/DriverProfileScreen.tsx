import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, ActivityIndicator, Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../context/LanguageContext';
import { supabase } from '../../services/supabase';

interface UserProfile {
  id: string;
  first_name: string;
  status: string;
  avatar_url?: string;
}

export default function DriverProfileScreen() {
  const { signOut, profile } = useAuth();
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile?.avatar_url || null);

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });

      if (result.canceled || !result.assets?.length) return;

      setUploading(true);
      const img = result.assets[0];
      const fileName = `${profile?.id}-${Date.now()}.jpeg`;

      // Cross-platform upload strategy
      let uploadBody: any;
      if (Platform.OS === 'web') {
        const res = await fetch(img.uri);
        uploadBody = await res.blob();
      } else {
        const formData = new FormData();
        formData.append('file', {
          uri: img.uri,
          name: fileName,
          type: 'image/jpeg',
        } as any);
        uploadBody = formData;
      }

      const { data, error } = await supabase.storage
        .from('avatars')
        .upload(fileName, uploadBody, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (error) throw error;

      const { data: publicData } = supabase.storage.from('avatars').getPublicUrl(fileName);
      const publicUrl = publicData.publicUrl;

      const { error: updateError } = await supabase
        .from('users')
        .update({ avatar_url: publicUrl })
        .eq('id', profile?.id);

      if (updateError) throw updateError;

      setAvatarUrl(publicUrl);
    } catch (error: any) {
      Alert.alert(t('common.error'), error.message || 'Error uploading image');
    } finally {
      setUploading(false);
    }
  };
  
  return (
    <View className="flex-1 bg-slate-50 pt-16 md:pt-24 px-6 md:px-20 lg:px-48 items-center">
      
      {/* ── Section Avatar ── */}
      <View className="mb-6 relative">
        <View className="w-32 h-32 md:w-40 md:h-40 rounded-full bg-slate-200 overflow-hidden items-center justify-center border-4 border-white shadow-md">
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} className="w-full h-full" />
          ) : (
            <Text className="text-4xl">🧑‍✈️</Text>
          )}
        </View>
        <TouchableOpacity 
          onPress={handlePickImage}
          disabled={uploading}
          className="absolute bottom-0 right-0 bg-blue-600 w-10 h-10 rounded-full items-center justify-center border-2 border-white"
        >
          {uploading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text className="text-white text-lg">📷</Text>
          )}
        </TouchableOpacity>
      </View>

      <Text className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-slate-800 mb-2 md:mb-4 text-center">
        {profile?.first_name ?? t('auth.driver')}
      </Text>
      <Text className="text-slate-500 font-medium text-lg md:text-xl lg:text-2xl mb-10 md:mb-16 text-center">
        {t('auth.driver')}
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

import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';
import { useTranslation } from '../../context/LanguageContext';

interface ReviewModalProps {
  visible: boolean;
  rideId: string;
  clientId: string;
  driverId: string;
  onClose: () => void;
  onSubmitSuccess: () => void;
}

export default function ReviewModal({ visible, rideId, clientId, driverId, onClose, onSubmitSuccess }: ReviewModalProps) {
  const { t } = useTranslation();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert(t('common.attention'), 'Veuillez attribuer une note (étoiles)');
      return;
    }
    
    setLoading(true);
    const { error } = await supabase.from('reviews').insert({
      ride_id: rideId,
      client_id: clientId,
      driver_id: driverId,
      rating,
      comment
    });
    setLoading(false);

    if (error) {
      Alert.alert(t('common.error'), error.message);
    } else {
      Alert.alert(t('common.success'), 'Merci pour votre retour !');
      onSubmitSuccess();
      onClose();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View className="flex-1 justify-end bg-black/60">
        <View className="bg-white rounded-t-3xl p-6 md:p-8 pt-8 md:pt-10 max-h-[90%]">
          
          <TouchableOpacity onPress={onClose} className="absolute top-4 right-4 bg-slate-100 p-2 rounded-full z-10">
            <Ionicons name="close" size={24} color="#64748b" />
          </TouchableOpacity>

          <View className="items-center mb-6">
            <View className="w-16 h-16 bg-yellow-100 rounded-full items-center justify-center mb-4">
              <Text className="text-3xl">⭐</Text>
            </View>
            <Text className="text-2xl font-black text-slate-800 text-center mb-2">Comment s'est passée la course ?</Text>
            <Text className="text-slate-500 text-center">Votre avis aide à maintenir la qualité du service.</Text>
          </View>

          {/* Sélecteur d'étoiles */}
          <View className="flex-row justify-center mb-8 gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity key={star} onPress={() => setRating(star)} activeOpacity={0.7}>
                <Ionicons 
                  name={star <= rating ? "star" : "star-outline"} 
                  size={40} 
                  color={star <= rating ? "#eab308" : "#cbd5e1"} 
                />
              </TouchableOpacity>
            ))}
          </View>

          {/* Commentaire optionnel */}
          <View className="mb-8">
            <Text className="text-sm font-bold text-slate-600 mb-2">Commentaire (optionnel)</Text>
            <TextInput
              className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-slate-800"
              style={{ minHeight: 100, textAlignVertical: 'top' }}
              placeholder="Le chauffeur était très ponctuel..."
              placeholderTextColor="#94a3b8"
              multiline
              value={comment}
              onChangeText={setComment}
            />
          </View>

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={loading || rating === 0}
            className={`w-full rounded-2xl py-4 items-center shadow-md ${rating === 0 ? 'bg-slate-300' : 'bg-blue-600'}`}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white text-lg font-bold">Soumettre l'avis</Text>
            )}
          </TouchableOpacity>
          
        </View>
      </View>
    </Modal>
  );
}

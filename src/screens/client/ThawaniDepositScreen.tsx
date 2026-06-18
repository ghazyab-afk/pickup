import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';
import { useTranslation } from '../../context/LanguageContext';

export default function ThawaniDepositScreen({ route, navigation }: any) {
  const { rideData } = route.params;
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  const handlePayment = async () => {
    setLoading(true);
    
    // Simuler le délai de paiement Thawani
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const { error } = await supabase.from('rides').insert({
      ...rideData,
      status: 'scheduled',
    });

    setLoading(false);

    if (error) {
      Alert.alert(t('common.error'), error.message);
    } else {
      Alert.alert(t('common.success'), 'Réservation confirmée et acompte payé !');
      // Rediriger vers l'accueil (qui rafraîchira la course active ou le planning)
      navigation.navigate('ClientMain');
    }
  };

  return (
    <View className="flex-1 bg-slate-50 justify-center px-6 md:px-20 lg:px-48">
      
      <View className="bg-white rounded-3xl p-8 shadow-2xl items-center border border-slate-100">
        
        <View className="w-20 h-20 bg-blue-100 rounded-full items-center justify-center mb-6">
          <Ionicons name="card" size={40} color="#2563eb" />
        </View>

        <Text className="text-2xl font-black text-slate-800 text-center mb-4">
          Acompte de Réservation
        </Text>
        
        <Text className="text-slate-500 text-base text-center mb-6">
          Pour réserver et bloquer votre camion pour la date planifiée, un acompte de sécurité est demandé via Thawani. Le solde restant sera payé en espèces au chauffeur.
        </Text>

        <View className="bg-slate-50 w-full rounded-2xl p-6 items-center mb-8 border border-slate-200">
          <Text className="text-slate-500 text-sm font-bold uppercase tracking-widest mb-2">Montant à régler</Text>
          <Text className="text-5xl font-black text-blue-600">3.00 <Text className="text-2xl">{t('common.currency')}</Text></Text>
        </View>

        <TouchableOpacity 
          className="w-full bg-blue-600 rounded-2xl py-5 flex-row justify-center items-center shadow-md mb-4"
          onPress={handlePayment}
          disabled={loading}
        >
          {loading ? (
             <ActivityIndicator color="white" size="small" />
          ) : (
            <Text className="text-white text-lg font-bold">Payer l'acompte (Simulation)</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.goBack()} disabled={loading} className="py-3">
          <Text className="text-slate-400 font-semibold text-base">Annuler</Text>
        </TouchableOpacity>

      </View>
    </View>
  );
}

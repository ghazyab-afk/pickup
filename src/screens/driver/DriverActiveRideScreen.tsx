import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../context/LanguageContext';

interface ActiveRide {
  id: string;
  pickup_address: string;
  dropoff_address: string;
  price_calculated: number;
  helpers_count: number;
  status: 'accepted' | 'arrived' | 'in_progress' | 'completed';
}

export default function DriverActiveRideScreen({ navigation }: any) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [activeRide, setActiveRide] = useState<ActiveRide | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  useEffect(() => {
    fetchActiveRide();

    // S'abonner aux mises à jour pour ce chauffeur spécifique
    const subscription = supabase
      .channel('public:active_ride')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rides', filter: `driver_id=eq.${user?.id}` },
        () => {
          fetchActiveRide();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const fetchActiveRide = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('rides')
      .select('*')
      .eq('driver_id', user.id)
      .in('status', ['accepted', 'arrived', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!error && data) {
      setActiveRide(data);
    } else {
      // Si aucune course n'est trouvée et qu'on n'est pas sur l'écran de résumé
      if (!showSummary) {
         setActiveRide(null);
      }
    }
    setLoading(false);
  };

  const updateRideStatus = async (newStatus: string) => {
    if (!activeRide) return;
    setUpdating(true);

    const { error } = await supabase
      .from('rides')
      .update({ status: newStatus })
      .eq('id', activeRide.id);

    setUpdating(false);

    if (error) {
      Alert.alert(t('common.error'), error.message);
    } else {
      if (newStatus === 'completed') {
        setShowSummary(true);
      } else {
        setActiveRide({ ...activeRide, status: newStatus as any });
      }
    }
  };

  const handleAction = () => {
    if (!activeRide) return;
    
    switch(activeRide.status) {
      case 'accepted':
        updateRideStatus('arrived');
        break;
      case 'arrived':
        updateRideStatus('in_progress');
        break;
      case 'in_progress':
        updateRideStatus('completed');
        break;
    }
  };

  const handleCloseSummary = () => {
    setShowSummary(false);
    setActiveRide(null);
    navigation.navigate('Dashboard');
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-slate-50">
        <ActivityIndicator size="large" color="#facc15" />
      </View>
    );
  }

  // Écran de Résumé / Paiement
  if (showSummary && activeRide) {
    return (
      <View className="flex-1 bg-green-600 justify-center items-center px-6 md:px-20 lg:px-48">
        <View className="bg-white rounded-3xl p-8 md:p-12 w-full max-w-lg items-center shadow-2xl">
          <View className="w-20 h-20 md:w-24 md:h-24 bg-green-100 rounded-full items-center justify-center mb-6">
            <Text className="text-4xl md:text-5xl">✅</Text>
          </View>
          <Text className="text-2xl md:text-3xl lg:text-4xl font-black text-slate-800 mb-2">{t('client.ride_completed_title')}</Text>
          <Text className="text-slate-500 text-base md:text-lg text-center mb-8">{t('driver.thank_you_service')}</Text>
          
          <View className="bg-slate-50 w-full rounded-2xl p-6 md:p-8 items-center mb-8 border border-slate-100">
            <Text className="text-slate-500 text-sm md:text-base font-bold uppercase tracking-widest mb-2">{t('driver.collect_cash')}</Text>
            <Text className="text-5xl md:text-6xl font-black text-green-600">{activeRide.price_calculated} <Text className="text-2xl md:text-3xl text-green-600">{t('common.currency')}</Text></Text>
          </View>

          <TouchableOpacity 
            onPress={handleCloseSummary}
            className="w-full bg-slate-800 rounded-2xl py-4 md:py-5 items-center"
          >
            <Text className="text-white text-lg md:text-xl font-bold">{t('close')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // État vide
  if (!activeRide) {
    return (
      <View className="flex-1 bg-slate-50 justify-center items-center px-6 md:px-20 lg:px-48">
        <View className="w-24 h-24 md:w-32 md:h-32 bg-slate-200 rounded-full items-center justify-center mb-6">
          <Text className="text-4xl md:text-5xl lg:text-6xl">🚚</Text>
        </View>
        <Text className="text-xl md:text-2xl lg:text-3xl font-bold text-slate-700 text-center mb-2">{t('driver.no_active_ride')}</Text>
        <Text className="text-slate-500 text-base md:text-lg lg:text-xl text-center">{t('driver.no_active_ride_desc')}</Text>
      </View>
    );
  }

  // Configuration dynamique du gros bouton
  let buttonConfig = {
    text: '',
    color: 'bg-yellow-400',
    textColor: 'text-black'
  };

  if (activeRide.status === 'accepted') {
    buttonConfig.text = t('driver.action_arrived');
    buttonConfig.color = "bg-[#facc15]";
  } else if (activeRide.status === 'arrived') {
    buttonConfig.text = t('driver.action_start');
    buttonConfig.color = "bg-blue-600";
    buttonConfig.textColor = "text-white";
  } else if (activeRide.status === 'in_progress') {
    buttonConfig.text = t('driver.action_finish');
    buttonConfig.color = "bg-green-600";
    buttonConfig.textColor = "text-white";
  }

  return (
    <View className="flex-1 bg-slate-50">
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, paddingTop: 60 }} className="md:px-20 lg:px-48">
        <Text className="text-sm md:text-base lg:text-lg font-bold text-blue-600 tracking-widest uppercase mb-2">Trajet en cours</Text>
        <Text className="text-3xl md:text-4xl lg:text-5xl font-black text-slate-800 mb-8 md:mb-12">{t('driver.active_ride')}</Text>

        {/* Détails des Adresses */}
        <View className="bg-white rounded-3xl p-6 md:p-8 lg:p-10 shadow-sm border border-slate-100 mb-6 md:mb-8">
          <View className="mb-6 md:mb-8">
            <Text className="text-xs md:text-sm lg:text-base font-bold text-slate-400 uppercase tracking-wider mb-2">{t('driver.pickup_address')}</Text>
            <View className="flex-row items-center">
              <View className="w-3 h-3 md:w-4 md:h-4 rounded-full bg-blue-500 me-3 md:me-4" />
              <Text className="text-lg md:text-xl lg:text-2xl font-bold text-slate-800 flex-1">{activeRide.pickup_address}</Text>
            </View>
          </View>
          
          <View className="w-full h-[1px] bg-slate-100 mb-6 md:mb-8" />

          <View>
            <Text className="text-xs md:text-sm lg:text-base font-bold text-slate-400 uppercase tracking-wider mb-2">{t('driver.dropoff_address')}</Text>
            <View className="flex-row items-center">
              <View className="w-3 h-3 md:w-4 md:h-4 rounded-sm bg-yellow-500 me-3 md:me-4" />
              <Text className="text-lg md:text-xl lg:text-2xl font-bold text-slate-800 flex-1">{activeRide.dropoff_address}</Text>
            </View>
          </View>
        </View>

        {/* Statistiques (Ouvriers / Prix) */}
        <View className="flex-row justify-between mb-8 md:mb-12">
          <View className="bg-white flex-1 p-5 md:p-8 rounded-3xl me-2 md:me-4 shadow-sm border border-slate-100 items-center">
            <Text className="text-3xl md:text-4xl lg:text-5xl mb-2 md:mb-4">👷</Text>
            <Text className="text-2xl md:text-3xl lg:text-4xl font-black text-slate-800">{activeRide.helpers_count}</Text>
            <Text className="text-xs md:text-sm lg:text-base text-slate-500 font-bold mt-1 md:mt-2 uppercase text-center">{t('client.helpers')}</Text>
          </View>
          
          <View className="bg-white flex-1 p-5 md:p-8 rounded-3xl ms-2 md:ms-4 shadow-sm border border-slate-100 items-center">
            <Text className="text-3xl md:text-4xl lg:text-5xl mb-2 md:mb-4">💰</Text>
            <Text className="text-2xl md:text-3xl lg:text-4xl font-black text-green-600">{activeRide.price_calculated}</Text>
            <Text className="text-xs md:text-sm lg:text-base text-slate-500 font-bold mt-1 md:mt-2 uppercase text-center">{t('driver.estimated_omr')}</Text>
          </View>
        </View>
      </ScrollView>

      {/* BOUTON GIGANTESQUE */}
      <View className="bg-white p-6 md:p-8 lg:p-10 pb-8 md:pb-12 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] rounded-t-3xl md:px-20 lg:px-48">
        <TouchableOpacity 
          onPress={handleAction}
          disabled={updating}
          className={`w-full rounded-2xl py-6 md:py-8 flex-row justify-center items-center shadow-lg ${buttonConfig.color}`}
          activeOpacity={0.8}
        >
          {updating ? (
            <ActivityIndicator color={activeRide.status === 'accepted' ? 'black' : 'white'} size="large" />
          ) : (
            <Text className={`${buttonConfig.textColor} text-xl md:text-2xl lg:text-3xl font-extrabold text-center px-4 md:px-8`}>
              {buttonConfig.text}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

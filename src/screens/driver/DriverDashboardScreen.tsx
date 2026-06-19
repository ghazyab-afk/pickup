import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../context/LanguageContext';

interface Ride {
  id: string;
  pickup_address: string;
  dropoff_address: string;
  price_calculated: number;
  helpers_count: number;
  status: string;
  created_at: string;
  requested_vehicle?: string; 
  scheduled_at?: string;
  urgent?: boolean;
}

export default function DriverDashboardScreen({ navigation }: any) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'immediate' | 'scheduled'>('immediate');

  useEffect(() => {
    fetchRides();

    // Abonnement Supabase Realtime pour écouter les nouvelles courses
    const subscription = supabase
      .channel('public:rides')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rides' },
        (payload) => {
          // On rafraîchit la liste complète à chaque changement (insertion, update)
          fetchRides();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [activeTab]);

  const fetchRides = async () => {
    setLoading(true);
    // 'immediate' tab: pending + pending_urgent combined and sorted (urgent first)
    if (activeTab === 'immediate') {
      const { data, error } = await supabase
        .from('rides')
        .select('*')
        .in('status', ['pending', 'pending_urgent'])
        .order('status', { ascending: true }) // pending_urgent sorts before pending alphabetically
        .order('created_at', { ascending: false });
      if (!error && data) setRides(data);
    } else {
      const { data, error } = await supabase
        .from('rides')
        .select('*')
        .eq('status', 'scheduled')
        .order('scheduled_at', { ascending: true });
      if (!error && data) setRides(data);
    }
    setLoading(false);
  };

  const handleAcceptRide = async (ride: Ride) => {
    if (!user) return;
    setAcceptingId(ride.id);

    const targetStatus = ride.status; // pending or scheduled
    const { data, error } = await supabase
      .from('rides')
      .update({ status: 'accepted', driver_id: user.id })
      .eq('id', ride.id)
      .eq('status', targetStatus)
      .select();

    setAcceptingId(null);

    if (error) {
      Alert.alert(t('common.error'), 'Impossible d\'accepter la course : ' + error.message);
      return;
    }

    // Si data est vide, cela signifie qu'aucune ligne n'a été modifiée (un autre chauffeur l'a prise)
    if (data && data.length === 0) {
      Alert.alert(t('common.attention'), t('driver.ride_taken'));
      fetchRides();
    } else {
      Alert.alert(t('common.success'), t('driver.ride_accepted'));
      // Redirection automatique vers l'onglet Trajet Actif
      navigation.navigate('ActiveRide');
    }
  };

  const renderRide = ({ item }: { item: Ride }) => (
    <View className="bg-white rounded-2xl p-5 md:p-8 lg:p-10 mb-4 md:mb-6 shadow-sm border border-slate-100">
      <View className="flex-row justify-between items-start mb-4 md:mb-6">
        <View className="flex-1">
          {item.status === 'pending_urgent' && (
            <View className="bg-red-500 self-start px-3 py-1 rounded-full mb-2 flex-row items-center">
              <Text className="text-white font-extrabold text-xs uppercase tracking-wide">{t('driver.urgent')}</Text>
            </View>
          )}
          <View className="bg-blue-50 self-start px-3 md:px-4 py-1 md:py-2 rounded-full border border-blue-100 mb-2">
            <Text className="text-blue-700 font-extrabold text-xs md:text-sm lg:text-base uppercase tracking-wide">
              {item.requested_vehicle ? item.requested_vehicle.replace('van_', '').toUpperCase() : t('driver.transport')}
            </Text>
          </View>
          {item.scheduled_at && (
            <View className="bg-orange-50 self-start px-3 py-1 rounded-full border border-orange-100">
              <Text className="text-orange-700 font-bold text-xs">
                📅 {new Date(item.scheduled_at).toLocaleDateString()} à {new Date(item.scheduled_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
              </Text>
            </View>
          )}
        </View>
        <Text className="text-2xl md:text-3xl lg:text-4xl font-black text-green-600 ml-2">
          {item.price_calculated} <Text className="text-sm md:text-base lg:text-lg text-slate-500 font-bold">{t('common.currency')}</Text>
        </Text>
      </View>

      <View className="space-y-3 md:space-y-4 mb-5 md:mb-8">
        <View className="flex-row items-center">
          <View className="w-3 h-3 md:w-4 md:h-4 rounded-full bg-blue-500 mr-3 md:mr-4" />
          <Text className="text-slate-700 font-semibold text-base md:text-lg lg:text-xl flex-1">{item.pickup_address}</Text>
        </View>
        <View className="w-1 h-3 md:h-4 border-s-2 border-dashed border-slate-300 ms-1.5 md:ms-2 -my-2 md:-my-3" />
        <View className="flex-row items-center">
          <View className="w-3 h-3 md:w-4 md:h-4 rounded-sm bg-yellow-500 mr-3 md:mr-4" />
          <Text className="text-slate-700 font-semibold text-base md:text-lg lg:text-xl flex-1">{item.dropoff_address}</Text>
        </View>
      </View>

      <View className="flex-row items-center bg-slate-50 p-3 md:p-5 rounded-xl mb-5 md:mb-8">
        <Text className="text-slate-500 font-medium text-sm md:text-base lg:text-lg">{t('driver.helpers_required')} </Text>
        <Text className="text-slate-800 font-black text-base md:text-lg lg:text-xl ms-1 md:ms-2">{item.helpers_count}</Text>
      </View>

      <TouchableOpacity 
        onPress={() => handleAcceptRide(item)}
        disabled={acceptingId === item.id}
        className="w-full bg-[#facc15] rounded-xl py-4 md:py-6 items-center shadow-sm"
      >
        {acceptingId === item.id ? (
          <ActivityIndicator color="black" size="large" />
        ) : (
          <Text className="text-black font-extrabold text-lg md:text-xl lg:text-2xl">{t('driver.accept_ride')}</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <View className="flex-1 bg-slate-50 px-4 md:px-20 lg:px-48 pt-16 md:pt-24">
      <Text className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-slate-800 mb-6 md:mb-10">{t('driver.available_missions')}</Text>

      {/* ── Onglets Autour de moi / Planning ── */}
      <View className="flex-row bg-slate-200 rounded-xl p-1 mb-6">
        <TouchableOpacity 
          className={`flex-1 py-3 rounded-lg items-center ${activeTab === 'immediate' ? 'bg-white shadow-sm' : ''}`}
          onPress={() => setActiveTab('immediate')}
        >
          <Text className={`font-bold ${activeTab === 'immediate' ? 'text-slate-800' : 'text-slate-400'}`}>{t('driver.tab_around_me')}</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          className={`flex-1 py-3 rounded-lg items-center ${activeTab === 'scheduled' ? 'bg-white shadow-sm' : ''}`}
          onPress={() => setActiveTab('scheduled')}
        >
          <Text className={`font-bold ${activeTab === 'scheduled' ? 'text-slate-800' : 'text-slate-400'}`}>{t('driver.tab_my_schedule')}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#facc15" />
          <Text className="text-slate-500 font-medium mt-4 text-base md:text-lg">{t('driver.connecting')}</Text>
        </View>
      ) : rides.length === 0 ? (
        <View className="flex-1 justify-center items-center pb-20">
          <ActivityIndicator size="large" color="#cbd5e1" className="mb-4" />
          <Text className="text-lg md:text-xl lg:text-2xl text-slate-400 font-medium text-center">{t('driver.waiting_requests')}</Text>
        </View>
      ) : (
        <FlatList
          data={rides}
          keyExtractor={(item) => item.id}
          renderItem={renderRide}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
    </View>
  );
}

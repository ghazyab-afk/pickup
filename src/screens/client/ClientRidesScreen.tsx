import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../context/LanguageContext';

interface Ride {
  id: string;
  pickup_address: string;
  dropoff_address: string;
  price_calculated: number;
  status: string;
  created_at: string;
  requested_vehicle?: string;
}

export default function ClientRidesScreen() {
  const { user } = useAuth();
  const { t, locale } = useTranslation();
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMyRides = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('rides')
      .select('*')
      .eq('client_id', user.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setRides(data);
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchMyRides();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchMyRides();
  }, [user]);

  const getStatusConfig = (status: string) => {
    switch(status) {
      case 'pending':
        return { label: t('client.status.pending'), bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' };
      case 'accepted':
      case 'arrived':
        return { label: t('client.status.accepted'), bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' };
      case 'in_progress':
        return { label: t('client.status.in_progress'), bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-200' };
      case 'completed':
        return { label: t('client.status.completed'), bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-200' };
      case 'cancelled':
        return { label: t('client.status.cancelled'), bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200' };
      default:
        return { label: status, bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' };
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(locale.includes('ar') ? 'ar-OM' : 'en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderRide = ({ item }: { item: Ride }) => {
    const statusConfig = getStatusConfig(item.status);

    return (
      <View className="bg-white rounded-2xl p-5 md:p-8 lg:p-10 mb-4 md:mb-6 shadow-sm border border-slate-100">
        <View className="flex-row justify-between items-center mb-4 md:mb-6">
          <Text className="text-slate-500 font-medium text-sm md:text-base lg:text-lg">{formatDate(item.created_at)}</Text>
          <View className={`px-3 md:px-4 py-1 md:py-2 rounded-full border ${statusConfig.bg} ${statusConfig.border}`}>
            <Text className={`font-bold text-xs md:text-sm lg:text-base uppercase tracking-wide ${statusConfig.text}`}>
              {statusConfig.label}
            </Text>
          </View>
        </View>

        <View className="space-y-3 md:space-y-4 mb-5 md:mb-8">
          <View className="flex-row items-center">
            <View className="w-3 h-3 md:w-4 md:h-4 rounded-full bg-blue-500 me-3 md:me-4" />
            <Text className="text-slate-700 font-semibold text-base md:text-lg lg:text-xl flex-1">{item.pickup_address}</Text>
          </View>
          <View className="w-1 h-3 md:h-4 border-s-2 border-dashed border-slate-300 ms-1.5 md:ms-2 -my-2 md:-my-3" />
          <View className="flex-row items-center">
            <View className="w-3 h-3 md:w-4 md:h-4 rounded-sm bg-yellow-500 me-3 md:me-4" />
            <Text className="text-slate-700 font-semibold text-base md:text-lg lg:text-xl flex-1">{item.dropoff_address}</Text>
          </View>
        </View>

        <View className="flex-row justify-between items-center pt-4 md:pt-6 border-t border-slate-100">
          <Text className="text-slate-500 font-medium text-sm md:text-base lg:text-lg">
            {item.requested_vehicle ? item.requested_vehicle.replace('van_', '').toUpperCase() : 'TRANSPORT'}
          </Text>
          <Text className="text-xl md:text-2xl lg:text-3xl font-black text-slate-800">
            {item.price_calculated} <Text className="text-sm md:text-base lg:text-lg font-bold text-slate-500">{t('common.currency')}</Text>
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-slate-50 px-4 md:px-20 lg:px-48 pt-16 md:pt-24">
      <Text className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-slate-800 mb-6 md:mb-10">{t('client.my_rides')}</Text>

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : rides.length === 0 ? (
        <View className="flex-1 justify-center items-center pb-20">
          <View className="w-24 h-24 md:w-32 md:h-32 bg-slate-200 rounded-full items-center justify-center mb-6">
            <Text className="text-4xl md:text-5xl lg:text-6xl">📦</Text>
          </View>
          <Text className="text-xl md:text-2xl lg:text-3xl font-bold text-slate-700 text-center mb-2">{t('client.no_rides')}</Text>
          <Text className="text-slate-500 text-base md:text-lg lg:text-xl text-center px-6">{t('client.no_rides')}</Text>
        </View>
      ) : (
        <FlatList
          data={rides}
          keyExtractor={(item) => item.id}
          renderItem={renderRide}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563eb" />
          }
        />
      )}
    </View>
  );
}

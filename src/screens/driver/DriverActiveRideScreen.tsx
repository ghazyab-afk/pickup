import React, { useState, useEffect, useRef } from 'react';
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
  scheduled_at?: string | null;
}

// Renvoie { minutesUntil, canStart } pour une course programmée
function getScheduledInfo(scheduledAt: string | null | undefined) {
  if (!scheduledAt) return { minutesUntil: null, canStart: true };
  const diffMs = new Date(scheduledAt).getTime() - Date.now();
  const minutesUntil = Math.ceil(diffMs / 60000);
  return { minutesUntil, canStart: minutesUntil <= 45 };
}

export default function DriverActiveRideScreen({ navigation }: any) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [activeRide, setActiveRide] = useState<ActiveRide | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  // ── MODULE 3 : Verrouillage horaire course programmée ──────────────────────
  const [, forceUpdate] = useState(0);
  const lockTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── MODULE 4 : Timer No-Show 15 minutes ───────────────────────────────────
  const [noShowSecondsLeft, setNoShowSecondsLeft] = useState<number | null>(null);
  const noShowTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchActiveRide();

    const subscription = supabase
      .channel('public:active_ride')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rides', filter: `driver_id=eq.${user?.id}` },
        () => { fetchActiveRide(); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
      if (lockTimerRef.current) clearInterval(lockTimerRef.current);
      if (noShowTimerRef.current) clearInterval(noShowTimerRef.current);
    };
  }, []);

  // Re-check every 30s if the ride is scheduled (to unlock the button dynamically)
  useEffect(() => {
    if (activeRide?.scheduled_at && activeRide.status === 'accepted') {
      lockTimerRef.current = setInterval(() => forceUpdate(n => n + 1), 30000);
    } else {
      if (lockTimerRef.current) clearInterval(lockTimerRef.current);
    }
    return () => { if (lockTimerRef.current) clearInterval(lockTimerRef.current); };
  }, [activeRide?.id, activeRide?.status]);

  // Start / Stop No-Show 15-min countdown when chauffeur arrives
  useEffect(() => {
    if (activeRide?.status === 'arrived') {
      if (noShowTimerRef.current) clearInterval(noShowTimerRef.current);
      setNoShowSecondsLeft(15 * 60); // 15 minutes
      noShowTimerRef.current = setInterval(() => {
        setNoShowSecondsLeft(prev => {
          if (prev === null) return null;
          if (prev <= 1) {
            clearInterval(noShowTimerRef.current!);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (noShowTimerRef.current) clearInterval(noShowTimerRef.current);
      setNoShowSecondsLeft(null);
    }
    return () => { if (noShowTimerRef.current) clearInterval(noShowTimerRef.current); };
  }, [activeRide?.status]);

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
      if (!showSummary) setActiveRide(null);
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

  // ── MODULE 4 : No-Show ────────────────────────────────────────────────────
  const handleNoShow = () => {
    Alert.alert(
      '⚠️ Client absent',
      'Confirmez-vous que le client n\'est pas présent ? Une pénalité lui sera signalée.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer le No-Show',
          style: 'destructive',
          onPress: async () => {
            if (!activeRide) return;
            setUpdating(true);
            await supabase
              .from('rides')
              .update({ status: 'cancelled_noshow' })
              .eq('id', activeRide.id);
            setUpdating(false);
            setActiveRide(null);
            navigation.navigate('Dashboard');
          },
        },
      ]
    );
  };

  const handleAction = () => {
    if (!activeRide) return;
    switch (activeRide.status) {
      case 'accepted': updateRideStatus('arrived'); break;
      case 'arrived':  updateRideStatus('in_progress'); break;
      case 'in_progress': updateRideStatus('completed'); break;
    }
  };

  // ── MODULE 4 : Annulation d'une course planifiée → ré-injection URGENT ──────
  const handleCancelScheduled = () => {
    if (!activeRide) return;
    Alert.alert(
      'Annuler la mission planifiée',
      'Cette action est irréversible. Si la mission commence dans moins de 2h, elle sera marquée URGENTE pour les autres chauffeurs.',
      [
        { text: 'Non, revenir', style: 'cancel' },
        {
          text: 'Oui, annuler',
          style: 'destructive',
          onPress: async () => {
            if (!activeRide) return;
            setUpdating(true);
            const isUrgent = activeRide.scheduled_at
              ? (new Date(activeRide.scheduled_at).getTime() - Date.now()) < 2 * 60 * 60 * 1000
              : false;
            const newStatus = isUrgent ? 'pending_urgent' : 'cancelled';
            await supabase.from('rides').update({
              status: newStatus,
              driver_id: null,
            }).eq('id', activeRide.id);
            setUpdating(false);
            setActiveRide(null);
            navigation.navigate('Dashboard');
          },
        },
      ]
    );
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

  // Résumé final
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
          <TouchableOpacity onPress={handleCloseSummary} className="w-full bg-slate-800 rounded-2xl py-4 md:py-5 items-center">
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

  // ── Calcul du verrou 45 minutes ───────────────────────────────────────────
  const { minutesUntil, canStart } = getScheduledInfo(activeRide.scheduled_at);
  const isScheduledAndLocked = !!activeRide.scheduled_at && !canStart && activeRide.status === 'accepted';

  // Configuration du bouton d'action principal
  let buttonConfig = { text: '', color: 'bg-yellow-400', textColor: 'text-black' };
  if (activeRide.status === 'accepted') {
    buttonConfig.text = isScheduledAndLocked
      ? `🔒 Départ dans ${minutesUntil} min`
      : t('driver.action_arrived');
    buttonConfig.color = isScheduledAndLocked ? 'bg-slate-300' : 'bg-[#facc15]';
    buttonConfig.textColor = isScheduledAndLocked ? 'text-slate-500' : 'text-black';
  } else if (activeRide.status === 'arrived') {
    buttonConfig.text = t('driver.action_start');
    buttonConfig.color = 'bg-blue-600';
    buttonConfig.textColor = 'text-white';
  } else if (activeRide.status === 'in_progress') {
    buttonConfig.text = t('driver.action_finish');
    buttonConfig.color = 'bg-green-600';
    buttonConfig.textColor = 'text-white';
  }

  // Format MM:SS pour le no-show
  const noShowMin = noShowSecondsLeft !== null ? Math.floor(noShowSecondsLeft / 60) : null;
  const noShowSec = noShowSecondsLeft !== null ? noShowSecondsLeft % 60 : null;
  const noShowExpired = noShowSecondsLeft === 0;

  return (
    <View className="flex-1 bg-slate-50">
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, paddingTop: 60 }} className="md:px-20 lg:px-48">
        <Text className="text-sm md:text-base lg:text-lg font-bold text-blue-600 tracking-widest uppercase mb-2">Trajet en cours</Text>
        <Text className="text-3xl md:text-4xl lg:text-5xl font-black text-slate-800 mb-8 md:mb-12">{t('driver.active_ride')}</Text>

        {/* Badge course programmée */}
        {activeRide.scheduled_at && (
          <View className="bg-orange-50 border border-orange-200 rounded-2xl px-4 py-3 mb-6 flex-row items-center">
            <Text className="text-orange-700 font-bold text-sm">
              📅 Course programmée : {new Date(activeRide.scheduled_at).toLocaleDateString()} à {new Date(activeRide.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        )}

        {/* Adresses */}
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

        {/* Statistiques */}
        <View className="flex-row justify-between mb-6 md:mb-8">
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

        {/* MODULE 4 : Timer No-Show (visible quand chauffeur est arrivé) */}
        {activeRide.status === 'arrived' && noShowSecondsLeft !== null && (
          <View className={`rounded-2xl p-5 mb-6 border items-center ${noShowExpired ? 'bg-red-50 border-red-300' : 'bg-amber-50 border-amber-200'}`}>
            <Text className={`font-black text-sm uppercase tracking-widest mb-2 ${noShowExpired ? 'text-red-600' : 'text-amber-700'}`}>
              {noShowExpired ? '⚠️ Attente gratuite terminée' : '⏱ Attente gratuite restante'}
            </Text>
            {!noShowExpired && (
              <Text className="text-3xl font-black text-amber-800">
                {String(noShowMin).padStart(2, '0')}:{String(noShowSec).padStart(2, '0')}
              </Text>
            )}
            {noShowExpired && (
              <TouchableOpacity
                onPress={handleNoShow}
                disabled={updating}
                className="mt-3 bg-red-600 rounded-xl px-6 py-3"
              >
                <Text className="text-white font-bold text-base">Déclarer No-Show</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

      </ScrollView>

      {/* BOUTON PRINCIPAL */}
      <View className="bg-white p-6 md:p-8 lg:p-10 pb-8 md:pb-12 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] rounded-t-3xl md:px-20 lg:px-48">
        <TouchableOpacity
          onPress={handleAction}
          disabled={updating || isScheduledAndLocked}
          className={`w-full rounded-2xl py-6 md:py-8 flex-row justify-center items-center shadow-lg ${buttonConfig.color}`}
          activeOpacity={isScheduledAndLocked ? 1 : 0.8}
        >
          {updating ? (
            <ActivityIndicator color={activeRide.status === 'accepted' ? 'black' : 'white'} size="large" />
          ) : (
            <Text className={`${buttonConfig.textColor} text-xl md:text-2xl lg:text-3xl font-extrabold text-center px-4 md:px-8`}>
              {buttonConfig.text}
            </Text>
          )}
        </TouchableOpacity>

        {/* Annuler une mission planifiée */}
        {activeRide.scheduled_at && activeRide.status === 'accepted' && (
          <TouchableOpacity
            onPress={handleCancelScheduled}
            disabled={updating}
            className="mt-3 py-3 items-center"
          >
            <Text className="text-red-400 font-semibold text-sm">Annuler la mission planifiée</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

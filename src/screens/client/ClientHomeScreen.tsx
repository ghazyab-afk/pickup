import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, Alert, ScrollView, Modal, Platform } from 'react-native';
import * as Location from 'expo-location';
import { useTranslation } from '../../context/LanguageContext';

let MapView: any = View;
let Marker: any = View;
let PROVIDER_DEFAULT: any = null;

if (Platform.OS !== 'web') {
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  Marker = Maps.Marker;
  PROVIDER_DEFAULT = Maps.PROVIDER_DEFAULT;
}
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';

// Import conditionnel pour éviter le crash sur Web
// (react-native-google-places-autocomplete ne supporte pas le navigateur)
let GooglePlacesInput: any = null;
if (Platform.OS !== 'web') {
  GooglePlacesInput = require('react-native-google-places-autocomplete').GooglePlacesAutocomplete;
}

type VehicleType = 'van_small' | 'van_large' | 'truck';

const PRICING = {
  van_small: { base: 3, perKm: 0.3 },
  van_large: { base: 8, perKm: 0.5 },
  truck: { base: 15, perKm: 0.7 },
};

const HELPER_PRICE = 3;
const MOCK_DISTANCE_KM = 15;

interface ActiveRide {
  id: string;
  pickup_address: string;
  dropoff_address: string;
  price_calculated: number;
  helpers_count: number;
  status: string;
  requested_vehicle: string;
  driver_id?: string;
  distance_km: number;
  driver?: {
    first_name: string;
    phone_number: string;
  };
}

export default function ClientHomeScreen() {
  const { user } = useAuth();
  const { t, locale } = useTranslation();
  const isRTL = locale.startsWith('ar');
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [loadingLoc, setLoadingLoc] = useState(true);
  
  const [pickupAddress, setPickupAddress] = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [vehicle, setVehicle] = useState<VehicleType>('van_small');
  const [helpers, setHelpers] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Active Ride States
  const [activeRide, setActiveRide] = useState<ActiveRide | null>(null);
  const [showCompletedModal, setShowCompletedModal] = useState(false);
  const [completedPrice, setCompletedPrice] = useState(0);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
        Alert.alert(t('common.attention'), t('client.location_required'));
        setLoadingLoc(false);
        return;
      }
      let loc = await Location.getCurrentPositionAsync({});
      setLocation(loc);
      setLoadingLoc(false);
    })();

    if (user) {
      fetchActiveRide();
      
      const subscription = supabase
        .channel('public:client_active_ride')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'rides', filter: `client_id=eq.${user.id}` },
          (payload: any) => {
            if (payload.new && payload.new.status === 'completed') {
               setCompletedPrice(payload.new.price_calculated);
               setShowCompletedModal(true);
            }
            fetchActiveRide();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(subscription);
      };
    }
  }, [user]);

  const fetchActiveRide = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('rides')
      .select('*')
      .eq('client_id', user.id)
      .in('status', ['pending', 'accepted', 'arrived', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!error && data) {
      let driverInfo = undefined;
      if (data.driver_id) {
         const { data: dData } = await supabase.from('users').select('first_name, phone_number').eq('id', data.driver_id).single();
         if (dData) driverInfo = dData;
      }
      setActiveRide({ ...data, driver: driverInfo });
    } else {
      setActiveRide(null);
    }
  };

  const estimatedPrice = PRICING[vehicle].base + (MOCK_DISTANCE_KM * PRICING[vehicle].perKm) + (helpers * HELPER_PRICE);

  const handleConfirmRide = async () => {
    if (!dropoffAddress.trim()) {
      Alert.alert('Attention', 'Veuillez saisir une destination.');
      return;
    }
    if (!user) return;
    setIsSubmitting(true);
    
    const rideData = {
      client_id: user.id,
      pickup_address: pickupAddress.trim() || t('client.current_location'),
      pickup_lat: location?.coords.latitude || 23.6143,
      pickup_lng: location?.coords.longitude || 58.5453,
      dropoff_address: dropoffAddress,
      dropoff_lat: 23.5933,
      dropoff_lng: 58.2618,
      status: 'pending',
      price_calculated: estimatedPrice,
      helpers_count: helpers,
      distance_km: MOCK_DISTANCE_KM,
      requested_vehicle: vehicle
    };

    const { error } = await supabase.from('rides').insert(rideData);
    setIsSubmitting(false);

    if (error) {
      Alert.alert(t('common.error'), error.message);
    } else {
      setDropoffAddress('');
      fetchActiveRide();
    }
  };

  const getStatusDisplay = (status: string) => {
    switch(status) {
      case 'pending': return { text: t('client.status.pending'), color: 'text-orange-500', bg: 'bg-orange-50', progress: 25 };
      case 'accepted': return { text: t('client.status.accepted'), color: 'text-blue-600', bg: 'bg-blue-50', progress: 50 };
      case 'arrived': return { text: t('client.status.arrived'), color: 'text-indigo-600', bg: 'bg-indigo-50', progress: 75 };
      case 'in_progress': return { text: t('client.status.in_progress'), color: 'text-green-600', bg: 'bg-green-50', progress: 90 };
      default: return { text: t('common.loading'), color: 'text-slate-500', bg: 'bg-slate-50', progress: 0 };
    }
  };

  const renderActiveRide = () => {
    if (!activeRide) return null;
    const s = getStatusDisplay(activeRide.status);

    return (
      <View className="flex-[1.3] bg-white rounded-t-3xl shadow-[0_-10px_20px_rgba(0,0,0,0.1)] -mt-6 p-6 md:p-8 lg:p-12">
        <Text className="text-xl md:text-2xl lg:text-3xl font-black text-slate-800 mb-4 md:mb-6">{t('client.ride_tracking')}</Text>
        
        {/* Barre de progression */}
        <View className="w-full h-2 bg-slate-100 rounded-full mb-4 overflow-hidden">
          <View className="h-full bg-blue-500 rounded-full" style={{ width: `${s.progress}%` }} />
        </View>

        {/* Statut dynamique */}
        <View className={`w-full py-4 md:py-6 rounded-2xl items-center mb-6 md:mb-8 border border-slate-100 ${s.bg}`}>
          <Text className={`text-lg md:text-xl lg:text-2xl font-extrabold ${s.color}`}>{s.text}</Text>
        </View>

        {/* Infos Chauffeur ou Attente */}
        <View className="flex-row justify-between items-center mb-6 md:mb-8">
          <View className="flex-1">
            <Text className="text-sm md:text-base lg:text-lg font-bold text-slate-400 uppercase tracking-wider mb-1">{t('client.driver')}</Text>
            {activeRide.driver ? (
              <View>
                <Text className="text-lg md:text-xl lg:text-2xl font-bold text-slate-800">{activeRide.driver?.first_name || t('client.anonymous')}</Text>
                <Text className="text-slate-500 font-medium text-base md:text-lg">{t('client.vehicle')} : {activeRide.requested_vehicle?.replace('van_', '').toUpperCase()}</Text>
              </View>
            ) : (
              <Text className="text-slate-500 font-medium italic text-base md:text-lg lg:text-xl">{t('client.waiting_assignment')}</Text>
            )}
          </View>
          <View className="items-end border-l border-slate-100 pl-4 md:pl-6">
            <Text className="text-sm md:text-base lg:text-lg font-bold text-slate-400 uppercase tracking-wider mb-1">{t('client.price')}</Text>
            <Text className="text-2xl md:text-3xl lg:text-4xl font-black text-green-600">{activeRide.price_calculated}</Text>
            <Text className="text-xs md:text-sm lg:text-base font-bold text-slate-500 uppercase">{t('common.currency')}</Text>
          </View>
        </View>

        {/* Détail Adresse Simplifié */}
        <View className="bg-slate-50 p-4 md:p-6 rounded-2xl flex-row items-center border border-slate-100">
          <View className="w-10 h-10 md:w-14 md:h-14 bg-white rounded-full items-center justify-center mr-3 shadow-sm">
            <Text className="text-lg md:text-2xl">📍</Text>
          </View>
          <View className="flex-1">
            <Text className="text-slate-800 font-semibold text-base md:text-lg lg:text-xl" numberOfLines={1}>{activeRide.dropoff_address}</Text>
            <Text className="text-slate-500 text-xs md:text-sm lg:text-base mt-1">{activeRide.distance_km} {t('client.estimated_distance')}</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderNewRideForm = () => (
    <View className="flex-[1.3] bg-white rounded-t-3xl shadow-[0_-10px_20px_rgba(0,0,0,0.1)] -mt-6 p-5 pt-6 md:p-8 lg:p-12">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
        <Text className="text-lg md:text-xl lg:text-2xl font-bold text-slate-800 mb-4 md:mb-6">{t('client.vehicle_type')}</Text>
        
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6 md:mb-8 flex-row">
          {(Object.keys(PRICING) as VehicleType[]).map((type) => (
            <TouchableOpacity 
              key={type}
              onPress={() => setVehicle(type)}
              className={`mr-3 md:mr-4 p-4 md:p-6 rounded-2xl border-2 w-40 md:w-56 ${vehicle === type ? 'border-yellow-400 bg-yellow-50' : 'border-slate-100 bg-slate-50'}`}
            >
              <Text className={`font-bold text-base md:text-lg lg:text-xl ${vehicle === type ? 'text-yellow-800' : 'text-slate-600'}`}>{t(`client.vehicle_types.${type}`)}</Text>
              <Text className="text-sm md:text-base lg:text-lg font-medium text-slate-500 mt-1">{PRICING[type].base} {t('common.currency')} + {PRICING[type].perKm}/km</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View className="flex-row justify-between items-center mb-8 md:mb-12">
          <View>
            <Text className="text-base md:text-lg lg:text-xl font-bold text-slate-800">{t('client.helpers')}</Text>
            <Text className="text-sm md:text-base lg:text-lg font-medium text-slate-500">{t('client.helpers_price')}</Text>
          </View>
          <View className="flex-row items-center bg-slate-100 rounded-full p-1 md:p-2">
            <TouchableOpacity 
              onPress={() => setHelpers(Math.max(0, helpers - 1))}
              className="w-10 h-10 md:w-14 md:h-14 rounded-full bg-white items-center justify-center shadow-sm"
            >
              <Text className="text-xl md:text-2xl lg:text-3xl font-bold text-slate-600">-</Text>
            </TouchableOpacity>
            <Text className="text-lg md:text-xl lg:text-2xl font-bold text-slate-800 w-8 md:w-12 text-center">{helpers}</Text>
            <TouchableOpacity 
              onPress={() => setHelpers(helpers + 1)}
              className="w-10 h-10 md:w-14 md:h-14 rounded-full bg-white items-center justify-center shadow-sm"
            >
              <Text className="text-xl md:text-2xl lg:text-3xl font-bold text-slate-600">+</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity 
          onPress={handleConfirmRide}
          disabled={isSubmitting}
          className="w-full bg-[#facc15] rounded-2xl py-4 md:py-6 flex-row justify-between items-center px-6 md:px-8 shadow-md"
          activeOpacity={0.8}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#000000" className="mx-auto" size="large" />
          ) : (
            <>
              <Text className="text-black text-lg md:text-xl lg:text-2xl font-extrabold tracking-wide">{t('client.confirm_ride')}</Text>
              <View className="bg-black/10 px-3 md:px-4 py-1 md:py-2 rounded-lg">
                <Text className="text-black text-xl md:text-2xl lg:text-3xl font-black">{estimatedPrice.toFixed(2)} {t('common.currency')}</Text>
              </View>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  return (
    <View className="flex-1 bg-white">
      {/* Modal Fin de Course */}
      <Modal visible={showCompletedModal} animationType="slide" transparent={true}>
        <View className="flex-1 justify-center items-center bg-black/60 px-6">
          <View className="bg-white rounded-3xl p-8 md:p-12 w-full max-w-lg items-center shadow-2xl">
            <View className="w-20 h-20 md:w-24 md:h-24 bg-green-100 rounded-full items-center justify-center mb-6">
              <Text className="text-4xl md:text-5xl">🎉</Text>
            </View>
            <Text className="text-2xl md:text-3xl lg:text-4xl font-black text-slate-800 mb-2">{t('client.ride_completed_title')}</Text>
            <Text className="text-slate-500 text-base md:text-lg text-center mb-8">{t('client.ride_completed_msg')}</Text>
            
            <View className="bg-slate-50 w-full rounded-2xl p-6 md:p-8 items-center mb-8 border border-slate-100">
              <Text className="text-slate-500 text-sm md:text-base font-bold uppercase tracking-widest mb-2">{t('client.amount_to_pay')}</Text>
              <Text className="text-5xl md:text-6xl font-black text-green-600">{completedPrice} <Text className="text-2xl md:text-3xl text-green-600">{t('common.currency')}</Text></Text>
            </View>

            <TouchableOpacity 
              onPress={() => setShowCompletedModal(false)}
              className="w-full bg-slate-800 rounded-2xl py-4 md:py-5 items-center"
            >
              <Text className="text-white text-lg md:text-xl font-bold">{t('client.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* SECTION CARTE (Haut 2/3 de l'écran) */}
      <View className="flex-[2] relative z-10">
        {loadingLoc ? (
          <View className="flex-1 justify-center items-center bg-slate-100">
            <ActivityIndicator size="large" color="#eab308" />
          </View>
        ) : Platform.OS === 'web' ? (
          <View className="flex-1 bg-slate-200">
            {React.createElement('iframe', {
              src: `https://www.openstreetmap.org/export/embed.html?bbox=${(location?.coords.longitude || 58.5453) - 0.02}%2C${(location?.coords.latitude || 23.6143) - 0.02}%2C${(location?.coords.longitude || 58.5453) + 0.02}%2C${(location?.coords.latitude || 23.6143) + 0.02}&layer=mapnik&marker=${location?.coords.latitude || 23.6143}%2C${location?.coords.longitude || 58.5453}`,
              style: { width: '100%', height: '100%', border: 'none' },
              title: t('client.home_title')
            })}
          </View>
        ) : location ? (
          <MapView
            className="flex-1"
            provider={PROVIDER_DEFAULT}
            initialRegion={{
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }}
            showsUserLocation={true}
          >
            <Marker 
              coordinate={{
                latitude: location.coords.latitude,
                longitude: location.coords.longitude
              }}
              title={t('client.current_location')}
              description={t('client.pickup')}
            />
          </MapView>
        ) : (
          <View className="flex-1 justify-center items-center bg-slate-200">
             <Text className="text-slate-500 font-bold text-lg">{t('client.location_required')}</Text>
          </View>
        )}

        {/* Si aucune course active, on affiche les champs de saisie, sinon on cache pour laisser la carte visible */}
        {!activeRide && (
          <View className="absolute top-12 md:top-16 left-4 md:left-8 right-4 md:right-8 lg:left-48 lg:right-48 bg-white rounded-2xl shadow-xl shadow-slate-900/10 p-3 md:p-5 z-50">

            {/* ── Champ DÉPART ────────────────────────────────────── */}
            <View className="flex-row items-start border-b border-slate-100 pb-2 mb-2 md:pb-4 md:mb-4 z-50">
              <View className="w-3 h-3 md:w-4 md:h-4 rounded-full bg-blue-600 mr-3 md:mr-4 mt-3" />
              <View className="flex-1">
                {Platform.OS === 'web' ? (
                  // Web : TextInput classique (GooglePlaces non supporté sur navigateur)
                  <TextInput
                    className="flex-1 text-slate-800 text-base font-semibold py-1"
                    style={{ textAlign: isRTL ? 'right' : 'left', height: 40, outlineStyle: 'none' } as any}
                    value={pickupAddress}
                    onChangeText={setPickupAddress}
                    placeholder={t('client.current_location')}
                    placeholderTextColor="#94a3b8"
                  />
                ) : (
                  // Mobile : Autocomplétion Google Places native
                  GooglePlacesInput && (
                    <GooglePlacesInput
                      placeholder={t('client.current_location')}
                      fetchDetails={true}
                      onPress={(data: any) => {
                        setPickupAddress(data.description);
                      }}
                      query={{
                        key: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
                        language: locale.substring(0, 2),
                        components: 'country:om',
                      }}
                      styles={{
                        textInput: {
                          fontSize: 16,
                          backgroundColor: 'transparent',
                          textAlign: isRTL ? 'right' : 'left',
                          height: 40,
                          paddingHorizontal: 0,
                        },
                        container: { flex: 0 },
                        listView: {
                          position: 'absolute',
                          top: 45,
                          backgroundColor: 'white',
                          zIndex: 100,
                          elevation: 5,
                          width: '100%',
                          borderRadius: 8,
                        },
                      }}
                      textInputProps={{
                        value: pickupAddress,
                        onChangeText: setPickupAddress,
                      }}
                    />
                  )
                )}
              </View>
            </View>

            {/* ── Champ DESTINATION ───────────────────────────────── */}
            <View className="flex-row items-start z-40">
              <View className="w-3 h-3 md:w-4 md:h-4 rounded-sm bg-yellow-500 mr-3 md:mr-4 mt-3" />
              <View className="flex-1">
                {Platform.OS === 'web' ? (
                  // Web : TextInput classique
                  <TextInput
                    className="flex-1 text-slate-800 text-base font-semibold py-1"
                    style={{ textAlign: isRTL ? 'right' : 'left', height: 40, outlineStyle: 'none' } as any}
                    value={dropoffAddress}
                    onChangeText={setDropoffAddress}
                    placeholder={t('client.dropoff')}
                    placeholderTextColor="#94a3b8"
                  />
                ) : (
                  // Mobile : Autocomplétion Google Places native
                  GooglePlacesInput && (
                    <GooglePlacesInput
                      placeholder={t('client.dropoff')}
                      fetchDetails={true}
                      onPress={(data: any) => {
                        setDropoffAddress(data.description);
                      }}
                      query={{
                        key: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
                        language: locale.substring(0, 2),
                        components: 'country:om',
                      }}
                      styles={{
                        textInput: {
                          fontSize: 16,
                          backgroundColor: 'transparent',
                          textAlign: isRTL ? 'right' : 'left',
                          height: 40,
                          paddingHorizontal: 0,
                        },
                        container: { flex: 0 },
                        listView: {
                          position: 'absolute',
                          top: 45,
                          backgroundColor: 'white',
                          zIndex: 100,
                          elevation: 5,
                          width: '100%',
                          borderRadius: 8,
                        },
                      }}
                      textInputProps={{
                        value: dropoffAddress,
                        onChangeText: setDropoffAddress,
                      }}
                    />
                  )
                )}
              </View>
            </View>

          </View>
        )}
      </View>

      {/* SECTION BASSE (Formulaire de commande OU Suivi de commande) */}
      {activeRide ? renderActiveRide() : renderNewRideForm()}
    </View>
  );
}

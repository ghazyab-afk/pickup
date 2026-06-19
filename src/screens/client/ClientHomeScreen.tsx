import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, ActivityIndicator,
  Alert, ScrollView, Modal, Platform, FlatList, Image
} from 'react-native';
import * as Location from 'expo-location';
import { useTranslation } from '../../context/LanguageContext';
import { Ionicons } from '@expo/vector-icons';

// ── Import conditionnel des libs natives (ne jamais importer statiquement) ──
let MapView: any = View;
let Marker: any = View;
let PROVIDER_DEFAULT: any = null;
let GooglePlacesInput: any = null;

if (Platform.OS !== 'web') {
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  Marker = Maps.Marker;
  PROVIDER_DEFAULT = Maps.PROVIDER_DEFAULT;
  GooglePlacesInput = require('react-native-google-places-autocomplete').GooglePlacesAutocomplete;
}

import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import ReviewModal from './ReviewModal';

// ── Types ──────────────────────────────────────────────────────────────────
type VehicleType = 'van_small' | 'van_large' | 'truck';

interface Coords { lat: number; lng: number; }
interface NominatimResult { place_id: string; display_name: string; lat: string; lon: string; }

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
  driver?: { first_name: string; phone_number: string; avatar_url?: string };
}

// ── Constantes ─────────────────────────────────────────────────────────────
const PRICING = {
  van_small: { base: 3, perKm: 0.3 },
  van_large: { base: 8, perKm: 0.5 },
  truck:     { base: 15, perKm: 0.7 },
};
const HELPER_PRICE = 3;
const OMAN_CENTER = { lat: 23.6143, lng: 58.5453 };

// ── Haversine Distance ─────────────────────────────────────────────────────
function haversineKm(a: Coords, b: Coords): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}

// ── Reverse Geocoding (Nominatim – universel web & mobile) ─────────────────
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=en`,
      { headers: { 'User-Agent': 'PickupApp/1.0' } }
    );
    const data = await res.json();
    return data?.display_name?.split(',').slice(0, 3).join(', ') || '';
  } catch {
    return '';
  }
}

// ── Nominatim Search (Web autocomplete) ────────────────────────────────────
async function nominatimSearch(query: string, lang: string): Promise<NominatimResult[]> {
  if (query.trim().length < 2) return [];
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=om&limit=5&accept-language=${lang}`,
      { headers: { 'User-Agent': 'PickupApp/1.0' } }
    );
    return await res.json();
  } catch {
    return [];
  }
}

import DateTimePickerModal from 'react-native-modal-datetime-picker';

// ══════════════════════════════════════════════════════════════════════════
export default function ClientHomeScreen({ navigation }: any) {
  const { user } = useAuth();
  const { t, locale } = useTranslation();
  const isRTL = locale.startsWith('ar');
  const lang = locale.substring(0, 2);

  // ── Location ─────────────────────────────────────────────────────────────
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [loadingLoc, setLoadingLoc] = useState(true);

  // ── Adresses & coordonnées ────────────────────────────────────────────────
  const [pickupAddress, setPickupAddress]   = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [pickupCoords, setPickupCoords]     = useState<Coords | null>(null);
  const [dropoffCoords, setDropoffCoords]   = useState<Coords | null>(null);

  // ── Suggestions Nominatim (Web uniquement) ────────────────────────────────
  const [pickupSuggestions, setPickupSuggestions]   = useState<NominatimResult[]>([]);
  const [dropoffSuggestions, setDropoffSuggestions] = useState<NominatimResult[]>([]);
  const pickupTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropoffTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Leaflet map (Web uniquement) ──────────────────────────────────────────
  const [activeMapField, setActiveMapField] = useState<'pickup' | 'dropoff'>('dropoff');
  const mapDivRef       = useRef<any>(null);
  const leafletMapRef   = useRef<any>(null);
  const pickupMarkerRef = useRef<any>(null);
  const dropoffMarkerRef = useRef<any>(null);

  const [vehicle, setVehicle]         = useState<VehicleType>('van_small');
  const [helpers, setHelpers]         = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reservationMode, setReservationMode] = useState<'immediate' | 'scheduled'>('immediate');
  const [scheduledDate, setScheduledDate] = useState<Date | null>(null);
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);

  const handleConfirmDate = (date: Date) => {
    const minDate = new Date();
    minDate.setHours(minDate.getHours() + 2);
    
    if (date < minDate) {
      Alert.alert(t('common.attention'), 'Veuillez choisir une heure au minimum dans 2 heures.');
    } else {
      setScheduledDate(date);
      setReservationMode('scheduled');
    }
    setDatePickerVisibility(false);
  };

  const [activeRide, setActiveRide]             = useState<ActiveRide | null>(null);
  const [showCompletedModal, setShowCompletedModal] = useState(false);
  const [completedPrice, setCompletedPrice]     = useState(0);
  const [showReviewModal, setShowReviewModal]   = useState(false);
  const [completedRideId, setCompletedRideId]   = useState<string | null>(null);
  const [lastDriverId, setLastDriverId]         = useState<string | null>(null);

  // ── Distance & prix calculés dynamiquement ────────────────────────────────
  const distanceKm: number = pickupCoords && dropoffCoords
    ? Math.round(haversineKm(pickupCoords, dropoffCoords) * 10) / 10
    : 0;
  const estimatedPrice = pickupCoords && dropoffCoords
    ? PRICING[vehicle].base + distanceKm * PRICING[vehicle].perKm + helpers * HELPER_PRICE
    : PRICING[vehicle].base + helpers * HELPER_PRICE;

  // ── Effet principal : géolocalisation + reverse geocoding + subscription ──
  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Sur web, expo-location peut ne pas fonctionner : on utilise l'API browser
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            if (cancelled) return;
            const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
            setLocation({ coords, timestamp: Date.now() } as any);
            setPickupCoords({ lat: coords.latitude, lng: coords.longitude });
            const addr = await reverseGeocode(coords.latitude, coords.longitude);
            if (!cancelled && addr) setPickupAddress(addr);
            setLoadingLoc(false);
          },
          () => {
            if (!cancelled) {
              setPickupCoords(OMAN_CENTER);
              setLoadingLoc(false);
            }
          },
          { timeout: 8000 }
        );
      } else {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (!cancelled) {
            setPickupCoords(OMAN_CENTER);
            setLoadingLoc(false);
          }
          return;
        }
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (cancelled) return;
        setLocation(loc);
        setPickupCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
        const addr = await reverseGeocode(loc.coords.latitude, loc.coords.longitude);
        if (!cancelled && addr) setPickupAddress(addr);
        setLoadingLoc(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // ── Initialisation Leaflet (Web seulement) ────────────────────────────────
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const initLat = pickupCoords?.lat ?? OMAN_CENTER.lat;
    const initLng = pickupCoords?.lng ?? OMAN_CENTER.lng;

    const loadAndInit = async () => {
      // Injecter le CSS Leaflet une seule fois
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }
      // Charger le JS Leaflet
      await new Promise<void>((resolve) => {
        if ((window as any).L) { resolve(); return; }
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.onload = () => resolve();
        document.head.appendChild(script);
      });

      if (!mapDivRef.current || leafletMapRef.current) return;

      const L = (window as any).L;

      // Icônes personnalisées (fix bug Leaflet webpack)
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const blueIcon = L.divIcon({
        html: '<div style="width:14px;height:14px;background:#3b82f6;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>',
        className: '', iconAnchor: [7, 7],
      });
      const redIcon = L.divIcon({
        html: '<div style="width:14px;height:14px;background:#ef4444;border:3px solid white;border-radius:3px;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>',
        className: '', iconAnchor: [7, 7],
      });

      const map = L.map(mapDivRef.current).setView([initLat, initLng], 14);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      // Marqueur départ (bleu)
      pickupMarkerRef.current = L.marker([initLat, initLng], {
        icon: blueIcon, draggable: true, title: 'Pickup',
      }).addTo(map);

      pickupMarkerRef.current.on('dragend', async (e: any) => {
        const { lat, lng } = e.target.getLatLng();
        setPickupCoords({ lat, lng });
        const addr = await reverseGeocode(lat, lng);
        if (addr) setPickupAddress(addr);
      });

      leafletMapRef.current = map;

      // Clic sur la carte → pose le marqueur du champ actif
      map.on('click', async (e: any) => {
        const { lat, lng } = e.latlng;
        // On lit l'état via un ref pour éviter les closures obsolètes
        const field = (map as any)._activeMapField ?? 'dropoff';
        if (field === 'pickup') {
          if (pickupMarkerRef.current) pickupMarkerRef.current.setLatLng([lat, lng]);
          setPickupCoords({ lat, lng });
          const addr = await reverseGeocode(lat, lng);
          if (addr) setPickupAddress(addr);
        } else {
          if (dropoffMarkerRef.current) {
            dropoffMarkerRef.current.setLatLng([lat, lng]);
          } else {
            dropoffMarkerRef.current = L.marker([lat, lng], {
              icon: redIcon, draggable: true, title: 'Dropoff',
            }).addTo(map);
            dropoffMarkerRef.current.on('dragend', async (ev: any) => {
              const p = ev.target.getLatLng();
              setDropoffCoords({ lat: p.lat, lng: p.lng });
              const a = await reverseGeocode(p.lat, p.lng);
              if (a) setDropoffAddress(a);
            });
          }
          setDropoffCoords({ lat, lng });
          const addr = await reverseGeocode(lat, lng);
          if (addr) setDropoffAddress(addr);
        }
      });
    };

    loadAndInit();

    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
        pickupMarkerRef.current = null;
        dropoffMarkerRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingLoc]); // relance quand la géoloc est prête

  // ── Sync activeMapField → propriété interne de la map ────────────────────
  useEffect(() => {
    if (leafletMapRef.current) {
      (leafletMapRef.current as any)._activeMapField = activeMapField;
    }
  }, [activeMapField]);

  // ── Sync coordonnées → marqueur pickup Leaflet ────────────────────────────
  useEffect(() => {
    if (!pickupMarkerRef.current || !pickupCoords) return;
    pickupMarkerRef.current.setLatLng([pickupCoords.lat, pickupCoords.lng]);
    if (leafletMapRef.current && !dropoffCoords) {
      leafletMapRef.current.panTo([pickupCoords.lat, pickupCoords.lng]);
    }
  }, [pickupCoords]);

  // ── Sync coordonnées → marqueur dropoff Leaflet ───────────────────────────
  useEffect(() => {
    if (!dropoffCoords || !leafletMapRef.current) return;
    const L = (window as any).L;
    if (!L) return;
    const redIcon = L.divIcon({
      html: '<div style="width:14px;height:14px;background:#ef4444;border:3px solid white;border-radius:3px;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>',
      className: '', iconAnchor: [7, 7],
    });
    if (dropoffMarkerRef.current) {
      dropoffMarkerRef.current.setLatLng([dropoffCoords.lat, dropoffCoords.lng]);
    } else {
      dropoffMarkerRef.current = L.marker([dropoffCoords.lat, dropoffCoords.lng], {
        icon: redIcon, draggable: true, title: 'Dropoff',
      }).addTo(leafletMapRef.current);
      dropoffMarkerRef.current.on('dragend', async (ev: any) => {
        const p = ev.target.getLatLng();
        setDropoffCoords({ lat: p.lat, lng: p.lng });
        const a = await reverseGeocode(p.lat, p.lng);
        if (a) setDropoffAddress(a);
      });
    }
    // Ajuster la vue pour montrer les deux marqueurs
    if (pickupCoords) {
      leafletMapRef.current.fitBounds(
        [[pickupCoords.lat, pickupCoords.lng], [dropoffCoords.lat, dropoffCoords.lng]],
        { padding: [40, 40] }
      );
    }
  }, [dropoffCoords]);

  // ── Subscription Supabase ─────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    fetchActiveRide();
    const sub = supabase
      .channel('client_active_ride')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'rides', filter: `client_id=eq.${user.id}` },
        (payload: any) => {
          if (payload.new?.status === 'completed') {
            setCompletedPrice(payload.new.price_calculated);
            setCompletedRideId(payload.new.id);
            setLastDriverId(payload.new.driver_id);
            setShowCompletedModal(true);
          }
          fetchActiveRide();
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(sub); };
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
      let driverInfo;
      if (data.driver_id) {
        setLastDriverId(data.driver_id);
        const { data: dData } = await supabase
          .from('users').select('first_name, phone_number, avatar_url').eq('id', data.driver_id).single();
        if (dData) driverInfo = dData;
      }
      setActiveRide({ ...data, driver: driverInfo });
    } else {
      setActiveRide(null);
    }
  };

  // ── Handlers : Nominatim debounce (Web) ───────────────────────────────────
  const handlePickupChange = useCallback((text: string) => {
    setPickupAddress(text);
    setPickupSuggestions([]);
    if (pickupTimer.current) clearTimeout(pickupTimer.current);
    pickupTimer.current = setTimeout(async () => {
      const results = await nominatimSearch(text, lang);
      setPickupSuggestions(results);
    }, 400);
  }, [lang]);

  const handleDropoffChange = useCallback((text: string) => {
    setDropoffAddress(text);
    setDropoffSuggestions([]);
    if (dropoffTimer.current) clearTimeout(dropoffTimer.current);
    dropoffTimer.current = setTimeout(async () => {
      const results = await nominatimSearch(text, lang);
      setDropoffSuggestions(results);
    }, 400);
  }, [lang]);

  const selectPickup = (item: NominatimResult) => {
    setPickupAddress(item.display_name.split(',').slice(0, 3).join(', '));
    setPickupCoords({ lat: parseFloat(item.lat), lng: parseFloat(item.lon) });
    setPickupSuggestions([]);
  };

  const selectDropoff = (item: NominatimResult) => {
    setDropoffAddress(item.display_name.split(',').slice(0, 3).join(', '));
    setDropoffCoords({ lat: parseFloat(item.lat), lng: parseFloat(item.lon) });
    setDropoffSuggestions([]);
  };

  // ── Confirmer la course ───────────────────────────────────────────────────
  const handleConfirmRide = async () => {
    if (!dropoffAddress.trim()) {
      Alert.alert(t('common.attention'), t('client.dropoff'));
      return;
    }
    if (reservationMode === 'scheduled' && !scheduledDate) {
      Alert.alert(t('common.attention'), 'Veuillez sélectionner une date et heure.');
      return;
    }
    if (!user) return;
    setIsSubmitting(true);

    const finalPickupCoords  = pickupCoords  ?? OMAN_CENTER;
    const finalDropoffCoords = dropoffCoords ?? OMAN_CENTER;
    const finalDistance      = haversineKm(finalPickupCoords, finalDropoffCoords);
    const finalPrice = PRICING[vehicle].base + finalDistance * PRICING[vehicle].perKm + helpers * HELPER_PRICE;

    const rideData = {
      client_id:        user.id,
      pickup_address:   pickupAddress.trim() || t('client.current_location'),
      pickup_lat:       finalPickupCoords.lat,
      pickup_lng:       finalPickupCoords.lng,
      dropoff_address:  dropoffAddress,
      dropoff_lat:      finalDropoffCoords.lat,
      dropoff_lng:      finalDropoffCoords.lng,
      status:           'pending', // Si c'est immédiat. Si c'est programmé, ce sera géré par l'écran d'acompte.
      price_calculated: Math.round(finalPrice * 100) / 100,
      helpers_count:    helpers,
      distance_km:      Math.round(finalDistance * 10) / 10,
      requested_vehicle: vehicle,
      scheduled_at:     reservationMode === 'scheduled' ? scheduledDate?.toISOString() : null,
    };

    if (reservationMode === 'scheduled') {
      setIsSubmitting(false);
      navigation.navigate('ThawaniDeposit', { rideData });
    } else {
      const { error } = await supabase.from('rides').insert(rideData);

      setIsSubmitting(false);
      if (error) {
        Alert.alert(t('common.error'), error.message);
      } else {
        setDropoffAddress('');
        setDropoffCoords(null);
        fetchActiveRide();
      }
    }
  };

  // ── Status helpers ────────────────────────────────────────────────────────
  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'pending':     return { text: t('client.status.pending'),     color: 'text-orange-500', bg: 'bg-orange-50',  progress: 25 };
      case 'accepted':    return { text: t('client.status.accepted'),    color: 'text-blue-600',   bg: 'bg-blue-50',    progress: 50 };
      case 'arrived':     return { text: t('client.status.arrived'),     color: 'text-indigo-600', bg: 'bg-indigo-50',  progress: 75 };
      case 'in_progress': return { text: t('client.status.in_progress'), color: 'text-green-600',  bg: 'bg-green-50',   progress: 90 };
      default:            return { text: t('common.loading'),            color: 'text-slate-500',  bg: 'bg-slate-50',   progress: 0  };
    }
  };

  // ── Composant : liste suggestions Nominatim ───────────────────────────────
  const SuggestionList = ({
    suggestions, onSelect,
  }: { suggestions: NominatimResult[]; onSelect: (i: NominatimResult) => void }) => {
    if (!suggestions.length) return null;
    return (
      <View style={{
        position: 'absolute', top: 44, left: 0, right: 0, zIndex: 200,
        backgroundColor: 'white', borderRadius: 10,
        shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, elevation: 10,
        maxHeight: 220, overflow: 'hidden',
      }}>
        {suggestions.map((item, idx) => (
          <TouchableOpacity
            key={item.place_id}
            onPress={() => onSelect(item)}
            style={{
              paddingHorizontal: 14, paddingVertical: 11,
              borderBottomWidth: idx < suggestions.length - 1 ? 1 : 0,
              borderBottomColor: '#f1f5f9',
            }}
          >
            <Text style={{ fontSize: 14, color: '#1e293b' }} numberOfLines={2}>
              {item.display_name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };
  // ── Locate me handler ─────────────────────────────────────────────────────
  const handleLocateMe = async (target: 'pickup' | 'dropoff') => {
    setLoadingLoc(true);
    try {
      let coords: Coords;
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.geolocation) {
        coords = await new Promise<Coords>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            (err) => reject(err),
            { timeout: 8000 }
          );
        });
      } else {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(t('common.attention'), t('client.location_required'));
          setLoadingLoc(false);
          return;
        }
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        coords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
      }

      const addr = await reverseGeocode(coords.lat, coords.lng);

      if (target === 'pickup') {
        setPickupCoords(coords);
        if (addr) setPickupAddress(addr);
      } else {
        setDropoffCoords(coords);
        if (addr) setDropoffAddress(addr);
      }
    } catch (e) {
      Alert.alert(t('common.error'), 'Impossible de récupérer la position');
    } finally {
      setLoadingLoc(false);
    }
  };

  // ── Render : Section adresses ─────────────────────────────────────────────
  const renderAddressCard = () => (
    <View style={{
      position: 'absolute',
      top: 16,
      left: 16,
      right: 16,
      zIndex: 10000,
      backgroundColor: 'white',
      borderRadius: 16,
      padding: 14,
      shadowColor: '#000',
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 20,
    }}>

      {/* ── DÉPART ── */}
      <View className="flex-row items-start border-b border-slate-100 pb-2 mb-2 md:pb-4 md:mb-4" style={{ zIndex: 60 }}>
        <TouchableOpacity
          onPress={() => Platform.OS === 'web' && setActiveMapField('pickup')}
          style={{
            width: 12, height: 12, borderRadius: 6, marginTop: 14, marginRight: 10,
            backgroundColor: '#3b82f6',
            borderWidth: activeMapField === 'pickup' && Platform.OS === 'web' ? 3 : 0,
            borderColor: '#93c5fd',
          }}
        />
        <View style={{ flex: 1, position: 'relative' }}>
          {Platform.OS === 'web' ? (
            <>
              <TextInput
                style={{
                  fontSize: 15, color: '#1e293b', height: 40,
                  textAlign: isRTL ? 'right' : 'left',
                  outlineStyle: 'none',
                } as any}
                value={pickupAddress}
                onChangeText={handlePickupChange}
                onFocus={() => setActiveMapField('pickup')}
                placeholder={t('client.current_location')}
                placeholderTextColor="#94a3b8"
              />
              <SuggestionList suggestions={pickupSuggestions} onSelect={selectPickup} />
            </>
          ) : (
            GooglePlacesInput && (
              <GooglePlacesInput
                placeholder={t('client.current_location')}
                fetchDetails={true}
                onPress={(data: any, details: any) => {
                  const short = data.description.split(',').slice(0, 3).join(', ');
                  setPickupAddress(short);
                  if (details?.geometry?.location) {
                    setPickupCoords({ lat: details.geometry.location.lat, lng: details.geometry.location.lng });
                  }
                }}
                query={{ key: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY, language: lang, components: 'country:om' }}
                styles={{
                  textInput: { fontSize: 15, backgroundColor: 'transparent', textAlign: isRTL ? 'right' : 'left', height: 40, paddingHorizontal: 0 },
                  container: { flex: 0 },
                  listView: { position: 'absolute', top: 45, backgroundColor: 'white', zIndex: 100, elevation: 8, width: '100%', borderRadius: 10 },
                }}
                textInputProps={{ value: pickupAddress, onChangeText: setPickupAddress }}
              />
            )
          )}
        </View>
        <TouchableOpacity
          onPress={() => handleLocateMe('pickup')}
          className="p-2 ml-2 bg-slate-50 rounded-full"
        >
          <Ionicons name="locate" size={20} color="#3b82f6" />
        </TouchableOpacity>
      </View>

      {/* ── DESTINATION ── */}
      <View className="flex-row items-start" style={{ zIndex: 50 }}>
        <TouchableOpacity
          onPress={() => Platform.OS === 'web' && setActiveMapField('dropoff')}
          style={{
            width: 12, height: 12, borderRadius: 2, marginTop: 14, marginRight: 10,
            backgroundColor: '#ef4444',
            borderWidth: activeMapField === 'dropoff' && Platform.OS === 'web' ? 3 : 0,
            borderColor: '#fca5a5',
          }}
        />
        <View style={{ flex: 1, position: 'relative' }}>
          {Platform.OS === 'web' ? (
            <>
              <TextInput
                style={{
                  fontSize: 15, color: '#1e293b', height: 40,
                  textAlign: isRTL ? 'right' : 'left',
                  outlineStyle: 'none',
                } as any}
                value={dropoffAddress}
                onChangeText={handleDropoffChange}
                onFocus={() => setActiveMapField('dropoff')}
                placeholder={t('client.dropoff')}
                placeholderTextColor="#94a3b8"
              />
              <SuggestionList suggestions={dropoffSuggestions} onSelect={selectDropoff} />
            </>
          ) : (
            GooglePlacesInput && (
              <GooglePlacesInput
                placeholder={t('client.dropoff')}
                fetchDetails={true}
                onPress={(data: any, details: any) => {
                  const short = data.description.split(',').slice(0, 3).join(', ');
                  setDropoffAddress(short);
                  if (details?.geometry?.location) {
                    setDropoffCoords({ lat: details.geometry.location.lat, lng: details.geometry.location.lng });
                  }
                }}
                query={{ key: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY, language: lang, components: 'country:om' }}
                styles={{
                  textInput: { fontSize: 15, backgroundColor: 'transparent', textAlign: isRTL ? 'right' : 'left', height: 40, paddingHorizontal: 0 },
                  container: { flex: 0 },
                  listView: { position: 'absolute', top: 45, backgroundColor: 'white', zIndex: 100, elevation: 8, width: '100%', borderRadius: 10 },
                }}
                textInputProps={{ value: dropoffAddress, onChangeText: setDropoffAddress }}
              />
            )
          )}
        </View>
        <TouchableOpacity
          onPress={() => handleLocateMe('dropoff')}
          className="p-2 ml-2 bg-slate-50 rounded-full"
        >
          <Ionicons name="locate" size={20} color="#ef4444" />
        </TouchableOpacity>
      </View>

      {/* Indicateur de mode clic (Web seulement) */}
      {Platform.OS === 'web' && (
        <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f1f5f9' }}>
          <Text style={{ fontSize: 11, color: '#94a3b8', marginRight: 6 }}>🖱 {t('client.map_click')}</Text>
          <TouchableOpacity
            onPress={() => setActiveMapField('pickup')}
            style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, marginRight: 4,
              backgroundColor: activeMapField === 'pickup' ? '#3b82f6' : '#f1f5f9' }}
          >
            <Text style={{ fontSize: 11, fontWeight: '700', color: activeMapField === 'pickup' ? 'white' : '#64748b' }}>● {t('client.pickup')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveMapField('dropoff')}
            style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
              backgroundColor: activeMapField === 'dropoff' ? '#ef4444' : '#f1f5f9' }}
          >
            <Text style={{ fontSize: 11, fontWeight: '700', color: activeMapField === 'dropoff' ? 'white' : '#64748b' }}>■ {t('client.dropoff')}</Text>
          </TouchableOpacity>
        </View>
      )}

    </View>
  );

  // ── Render : Course active ────────────────────────────────────────────────
  const renderActiveRide = () => {
    if (!activeRide) return null;
    const s = getStatusDisplay(activeRide.status);
    return (
      <View className="flex-[1.3] bg-white rounded-t-3xl shadow-[0_-10px_20px_rgba(0,0,0,0.1)] -mt-6 p-6 md:p-8 lg:p-12">
        <Text className="text-xl md:text-2xl lg:text-3xl font-black text-slate-800 mb-4 md:mb-6">{t('client.ride_tracking')}</Text>
        <View className="w-full h-2 bg-slate-100 rounded-full mb-4 overflow-hidden">
          <View className="h-full bg-blue-500 rounded-full" style={{ width: `${s.progress}%` }} />
        </View>
        <View className={`w-full py-4 md:py-6 rounded-2xl items-center mb-6 md:mb-8 border border-slate-100 ${s.bg}`}>
          <Text className={`text-lg md:text-xl lg:text-2xl font-extrabold ${s.color}`}>{s.text}</Text>
        </View>
        <View className="flex-row justify-between items-center mb-6 md:mb-8">
          <View className="flex-row items-center flex-1">
            <View className="w-14 h-14 bg-slate-200 rounded-full mr-4 border-2 border-white shadow-sm overflow-hidden items-center justify-center">
              {activeRide.driver?.avatar_url ? (
                <Image source={{ uri: activeRide.driver.avatar_url }} style={{ width: '100%', height: '100%' }} />
              ) : (
                <Text className="text-xl">🧑‍✈️</Text>
              )}
            </View>
            <View className="flex-1">
              <Text className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">{t('client.driver')}</Text>
              {activeRide.driver ? (
                <View>
                  <Text className="text-lg md:text-xl font-bold text-slate-800">{activeRide.driver.first_name || t('client.anonymous')}</Text>
                  <View className="flex-row items-center mt-1">
                    <Text className="text-sm font-medium text-slate-500 mr-2">{t('client.vehicle')} : {activeRide.requested_vehicle?.replace('van_', '').toUpperCase()}</Text>
                    <Text className="text-yellow-500 font-bold text-sm">⭐ 4.8</Text>
                  </View>
                </View>
              ) : (
                <Text className="text-slate-500 font-medium italic text-base">{t('client.waiting_assignment')}</Text>
              )}
            </View>
          </View>
          <View className="items-end border-l border-slate-100 pl-4">
            <Text className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">{t('client.price')}</Text>
            <Text className="text-2xl md:text-3xl font-black text-green-600">{activeRide.price_calculated}</Text>
            <Text className="text-xs font-bold text-slate-500 uppercase">{t('common.currency')}</Text>
          </View>
        </View>
        <View className="bg-slate-50 p-4 rounded-2xl flex-row items-center border border-slate-100">
          <View className="w-10 h-10 bg-white rounded-full items-center justify-center mr-3 shadow-sm">
            <Text className="text-lg">📍</Text>
          </View>
          <View className="flex-1">
            <Text className="text-slate-800 font-semibold text-base" numberOfLines={1}>{activeRide.dropoff_address}</Text>
            <Text className="text-slate-500 text-xs mt-1">{activeRide.distance_km} {t('client.estimated_distance')}</Text>
          </View>
        </View>
      </View>
    );
  };

  // ── Render : Formulaire nouvelle course ───────────────────────────────────
  const renderNewRideForm = () => (
    <View className="flex-[1.3] bg-white rounded-t-3xl shadow-[0_-10px_20px_rgba(0,0,0,0.1)] -mt-6 p-5 pt-6 md:p-8 lg:p-12">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
        <Text className="text-lg md:text-xl font-bold text-slate-800 mb-4">{t('client.vehicle_type')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6 flex-row">
          {(Object.keys(PRICING) as VehicleType[]).map((type) => (
            <TouchableOpacity
              key={type}
              onPress={() => setVehicle(type)}
              className={`mr-3 p-4 rounded-2xl border-2 w-40 ${vehicle === type ? 'border-yellow-400 bg-yellow-50' : 'border-slate-100 bg-slate-50'}`}
            >
              <Text className={`font-bold text-base ${vehicle === type ? 'text-yellow-800' : 'text-slate-600'}`}>{t(`client.vehicle_types.${type}`)}</Text>
              <Text className="text-sm font-medium text-slate-500 mt-1">{PRICING[type].base} {t('common.currency')} + {PRICING[type].perKm}/km</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Distance réelle affichée si disponible */}
        {distanceKm > 0 && (
          <View className="bg-blue-50 rounded-xl px-4 py-2 mb-4 flex-row items-center">
            <Text className="text-blue-700 font-semibold text-sm">📏 {t('client.estimated_distance')} : </Text>
            <Text className="text-blue-900 font-black text-sm">{distanceKm} km</Text>
          </View>
        )}

        <View className="flex-row justify-between items-center mb-8">
          <View>
            <Text className="text-base font-bold text-slate-800">{t('client.helpers')}</Text>
            <Text className="text-sm font-medium text-slate-500">{t('client.helpers_price')}</Text>
          </View>
          <View className="flex-row items-center bg-slate-100 rounded-full p-1">
            <TouchableOpacity onPress={() => setHelpers(Math.max(0, helpers - 1))} className="w-10 h-10 rounded-full bg-white items-center justify-center shadow-sm">
              <Text className="text-xl font-bold text-slate-600">-</Text>
            </TouchableOpacity>
            <Text className="text-lg font-bold text-slate-800 w-8 text-center">{helpers}</Text>
            <TouchableOpacity onPress={() => setHelpers(helpers + 1)} className="w-10 h-10 rounded-full bg-white items-center justify-center shadow-sm">
              <Text className="text-xl font-bold text-slate-600">+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Sélecteur Hybride ── */}
        <View className="mb-6">
          <View className="flex-row bg-slate-100 rounded-xl p-1 mb-3">
            <TouchableOpacity 
              className={`flex-1 py-3 rounded-lg items-center ${reservationMode === 'immediate' ? 'bg-white shadow-sm' : ''}`}
              onPress={() => setReservationMode('immediate')}
            >
              <Text className={`font-bold ${reservationMode === 'immediate' ? 'text-slate-800' : 'text-slate-400'}`}>⚡ {t('client.immediate_ride')}</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              className={`flex-1 py-3 rounded-lg items-center ${reservationMode === 'scheduled' ? 'bg-white shadow-sm' : ''}`}
              onPress={() => setDatePickerVisibility(true)}
            >
              <Text className={`font-bold ${reservationMode === 'scheduled' ? 'text-slate-800' : 'text-slate-400'}`}>📅 {t('client.schedule_ride')}</Text>
            </TouchableOpacity>
          </View>
          
          <Text className="text-center text-slate-500 text-sm font-medium">
            {reservationMode === 'immediate' 
              ? t('client.type_immediate') 
              : scheduledDate 
                ? `${t('client.type_scheduled')} ${scheduledDate.toLocaleDateString()} à ${scheduledDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`
                : t('client.type_planning_req')
            }
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleConfirmRide}
          disabled={isSubmitting}
          className="w-full bg-[#facc15] rounded-2xl py-4 md:py-6 flex-row justify-between items-center px-6 shadow-md"
          activeOpacity={0.8}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#000000" className="mx-auto" size="large" />
          ) : (
            <>
              <Text className="text-black text-lg md:text-xl font-extrabold tracking-wide">{t('client.confirm_ride')}</Text>
              <View className="bg-black/10 px-3 py-1 rounded-lg">
                <Text className="text-black text-xl md:text-2xl font-black">{estimatedPrice.toFixed(2)} {t('common.currency')}</Text>
              </View>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {Platform.OS === 'web' && isDatePickerVisible ? (
        <Modal visible={true} transparent={true} animationType="fade">
          <View className="flex-1 justify-center items-center bg-black/50 px-6">
            <View className="bg-white p-6 rounded-2xl w-full max-w-sm">
              <Text className="text-lg font-bold mb-4">{t('client.schedule_ride')}</Text>
              <input 
                type="datetime-local" 
                style={{ width: '100%', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '8px', marginBottom: '16px', fontSize: '16px' }}
                onChange={(e) => {
                  if (e.target.value) {
                    handleConfirmDate(new Date(e.target.value));
                  }
                }}
              />
              <TouchableOpacity onPress={() => setDatePickerVisibility(false)} className="bg-slate-200 p-3 rounded-xl items-center">
                <Text className="font-bold text-slate-700">{t('common.cancel')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      ) : (
        <DateTimePickerModal
          isVisible={isDatePickerVisible}
          mode="datetime"
          onConfirm={handleConfirmDate}
          onCancel={() => setDatePickerVisibility(false)}
          minimumDate={new Date()}
        />
      )}
    </View>
  );

  // ── Render principal ──────────────────────────────────────────────────────
  return (
    <View className="flex-1 bg-white">

      {/* Modal Fin de Course */}
      <Modal visible={showCompletedModal} animationType="slide" transparent={true}>
        <View className="flex-1 justify-center items-center bg-black/60 px-6">
          <View className="bg-white rounded-3xl p-8 w-full max-w-lg items-center shadow-2xl">
            <View className="w-20 h-20 bg-green-100 rounded-full items-center justify-center mb-6">
              <Text className="text-4xl">🎉</Text>
            </View>
            <Text className="text-2xl font-black text-slate-800 mb-2">{t('client.ride_completed_title')}</Text>
            <Text className="text-slate-500 text-base text-center mb-8">{t('client.ride_completed_msg')}</Text>
            <View className="bg-slate-50 w-full rounded-2xl p-6 items-center mb-8 border border-slate-100">
              <Text className="text-slate-500 text-sm font-bold uppercase tracking-widest mb-2">{t('client.amount_to_pay')}</Text>
              <Text className="text-5xl font-black text-green-600">{completedPrice} <Text className="text-2xl">{t('common.currency')}</Text></Text>
            </View>
            <TouchableOpacity onPress={() => {
              setShowCompletedModal(false);
              if (completedRideId && lastDriverId) {
                setShowReviewModal(true);
              }
            }} className="w-full bg-slate-800 rounded-2xl py-4 items-center">
              <Text className="text-white text-lg font-bold">{t('client.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal d'Avis */}
      {completedRideId && lastDriverId && user && (
        <ReviewModal
          visible={showReviewModal}
          rideId={completedRideId}
          clientId={user.id}
          driverId={lastDriverId}
          onClose={() => setShowReviewModal(false)}
          onSubmitSuccess={() => {}}
        />
      )}

      {/* ── SECTION CARTE ── */}
      <View className="flex-[2] relative z-10">
        {loadingLoc ? (
          <View className="flex-1 justify-center items-center bg-slate-100">
            <ActivityIndicator size="large" color="#eab308" />
            <Text className="text-slate-500 mt-3 font-medium">{t('common.loading')}</Text>
          </View>
        ) : Platform.OS === 'web' ? (
          // Carte Leaflet interactive (marqueurs départ+arrivée + clic)
          React.createElement('div', {
            ref: mapDivRef,
            style: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
          })
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
              coordinate={{ latitude: location.coords.latitude, longitude: location.coords.longitude }}
              title={t('client.current_location')}
              description={t('client.pickup')}
            />
          </MapView>
        ) : (
          <View className="flex-1 justify-center items-center bg-slate-200">
            <Text className="text-slate-500 font-bold text-lg text-center px-8">{t('client.location_required')}</Text>
          </View>
        )}

        {/* Carte d'adresses flottante */}
        {!activeRide && renderAddressCard()}
      </View>

      {/* ── SECTION BASSE ── */}
      {activeRide ? renderActiveRide() : renderNewRideForm()}
    </View>
  );
}

import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView,
  Platform, ScrollView, ActivityIndicator, Alert, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { sendWhatsAppOTP, verifyOTP } from '../../services/phoneAuthService';
import LanguageSelector from '../../components/LanguageSelector';

const OTP_LENGTH = 6;

const COUNTRIES = [
  { name: 'Oman', flag: '🇴🇲', code: '+968' },
  { name: 'Saudi Arabia', flag: '🇸🇦', code: '+966' },
  { name: 'UAE', flag: '🇦🇪', code: '+971' },
  { name: 'Qatar', flag: '🇶🇦', code: '+974' },
  { name: 'Kuwait', flag: '🇰🇼', code: '+965' },
  { name: 'Bahrain', flag: '🇧🇭', code: '+973' },
  { name: 'France', flag: '🇫🇷', code: '+33' },
  { name: 'UK', flag: '🇬🇧', code: '+44' },
  { name: 'USA', flag: '🇺🇸', code: '+1' },
];

export default function PhoneAuthScreen({ navigation }: any) {
  const { devLogin } = useAuth();
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]);
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [phone, setPhone] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  // ── Send OTP (via Supabase Edge Function) ─────────────────────────
  const handleSendOtp = async () => {
    // Nettoyage basique (on garde que les chiffres)
    const cleanedPhone = phone.replace(/[^\d]/g, '');

    if (cleanedPhone.length < 6) {
      Alert.alert('Attention', 'Veuillez saisir un numéro de téléphone valide');
      return;
    }

    setLoading(true);
    
    // On envoie le numéro complet avec l'indicatif choisi
    const fullPhone = `${selectedCountry.code}${cleanedPhone}`;
    const result = await sendWhatsAppOTP(fullPhone);
    setLoading(false);

    if (result.success) {
      setPhone(cleanedPhone); // Garder le numéro propre dans l'input
      setStep('otp');
    } else {
      Alert.alert('Erreur', result.error || 'Échec de l\'envoi du code WhatsApp');
    }
  };

  // ── OTP input handler ─────────────────────────────────────────────
  const handleOtpChange = (value: string, index: number) => {
    // Si l'utilisateur colle un code complet
    if (value.length === OTP_LENGTH) {
      const newOtp = value.split('').slice(0, OTP_LENGTH);
      setOtp(newOtp);
      inputRefs.current[OTP_LENGTH - 1]?.focus();
      return;
    }

    const char = value.slice(-1);
    
    setOtp((prevOtp) => {
      const newOtp = [...prevOtp];
      newOtp[index] = char;
      return newOtp;
    });

    // Auto-advance
    if (char && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyPress = (key: string, index: number) => {
    if (key === 'Backspace') {
      setOtp((prevOtp) => {
        if (prevOtp[index] === '' && index > 0) {
          // If current is empty, clear the previous one and move focus
          const newOtp = [...prevOtp];
          newOtp[index - 1] = '';
          setTimeout(() => inputRefs.current[index - 1]?.focus(), 10);
          return newOtp;
        }
        return prevOtp;
      });
    }
  };

  // ── Verify OTP (via Supabase Edge Function) ───────────────────────
  const handleVerifyOtp = async () => {
    const code = otp.join('');
    if (code.length < OTP_LENGTH) {
      Alert.alert('Attention', 'Veuillez saisir le code complet');
      return;
    }
    setLoading(true);
    
    const result = await verifyOTP(phone, code);
    setLoading(false);

    if (result.success) {
      if (result.session?.access_token === 'dev-token' && devLogin) {
        devLogin(result.session);
      }
      // Succès silencieux, Supabase onAuthStateChange va prendre le relais pour naviguer
    } else {
      Alert.alert('Erreur', result.error || 'Code invalide ou expiré');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-slate-50 relative"
    >
      <View className="absolute top-10 md:top-14 right-6 z-50">
        <LanguageSelector />
      </View>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        className="px-6 md:px-0"
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-1 justify-center w-full md:max-w-md md:mx-auto lg:max-w-lg px-0 md:px-8 py-10">

          {/* Brand header */}
          <View className="items-center mb-10 md:mb-14">
            <View className="w-20 h-20 md:w-24 md:h-24 bg-yellow-400 rounded-3xl items-center justify-center mb-5 shadow-md">
              <Ionicons name="car-sport" size={40} color="#1e293b" />
            </View>
            <Text className="text-3xl md:text-4xl lg:text-5xl font-black text-slate-800 text-center">
              {step === 'phone' ? 'Bienvenue sur Pickup' : 'Validation WhatsApp'}
            </Text>
            <Text className="text-base md:text-lg lg:text-xl text-slate-400 font-medium mt-2 text-center">
              {step === 'phone' ? (
                'Commandez un transport en quelques clics'
              ) : (
                <Text>
                  Un code de validation OTP vous a été envoyé sur votre compte WhatsApp au{' '}
                  <Text style={{ direction: 'ltr', fontWeight: 'bold', color: '#64748b' }}>
                    {selectedCountry.code} {phone}
                  </Text>
                </Text>
              )}
            </Text>
          </View>

          {step === 'phone' ? (
            /* ── Phone Input ─────────────────────────────────────────── */
            <View>
              <Text className="text-sm md:text-base font-bold text-slate-600 mb-2 ms-1">
                Numéro de téléphone
              </Text>
              <View 
                className="flex-row items-center bg-white border-2 border-slate-200 rounded-2xl overflow-hidden focus-within:border-blue-500 h-16 md:h-18"
                style={{ flexDirection: 'row', direction: 'ltr' }}
              >
                {/* Sélecteur de pays cliquable */}
                <TouchableOpacity
                  onPress={() => setShowCountryModal(true)}
                  className="flex-row items-center px-4 border-e-2 border-slate-100 h-full bg-slate-50"
                  activeOpacity={0.7}
                >
                  <Text className="text-2xl me-2">{selectedCountry.flag}</Text>
                  <Text className="text-base md:text-lg font-bold text-slate-700">
                    {selectedCountry.code}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color="#64748b" style={{ marginLeft: 6 }} />
                </TouchableOpacity>

                <TextInput
                  className="flex-1 px-4 text-lg md:text-xl font-semibold text-slate-800"
                  style={{ textAlign: 'left' }}
                  placeholder="9X XXX XXX"
                  placeholderTextColor="#94a3b8"
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={setPhone}
                  returnKeyType="done"
                  onSubmitEditing={handleSendOtp}
                />
              </View>
              <Text className="text-xs text-slate-400 mt-2 ms-1 text-center">
                Saisissez votre numéro sans l'indicatif
              </Text>

              <TouchableOpacity
                onPress={handleSendOtp}
                disabled={loading}
                className="w-full bg-blue-600 rounded-2xl py-4 md:py-5 items-center mt-6 shadow-md"
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text className="text-white text-lg md:text-xl font-extrabold">
                    Recevoir le code
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            /* ── OTP Input ───────────────────────────────────────────── */
            <View>
              <View 
                className="flex-row justify-center gap-2 md:gap-3 mb-8"
                style={{ flexDirection: 'row', direction: 'ltr' }}
              >
                {otp.map((digit, i) => (
                  <TextInput
                    key={i}
                    ref={(el) => { inputRefs.current[i] = el; }}
                    className={`w-12 h-14 md:w-14 md:h-16 lg:w-16 lg:h-18 rounded-2xl border-2 text-center text-2xl md:text-3xl font-black text-slate-800 bg-white ${
                      digit ? 'border-blue-500 bg-blue-50' : 'border-slate-200'
                    }`}
                    style={{ textAlign: 'center' }}
                    maxLength={OTP_LENGTH}
                    keyboardType="number-pad"
                    value={digit}
                    onChangeText={(v) => handleOtpChange(v, i)}
                    onKeyPress={({ nativeEvent }) => handleOtpKeyPress(nativeEvent.key, i)}
                    selectTextOnFocus
                  />
                ))}
              </View>

              <TouchableOpacity
                onPress={handleVerifyOtp}
                disabled={loading}
                className="w-full bg-green-600 rounded-2xl py-4 md:py-5 items-center shadow-md"
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <View className="flex-row items-center">
                    <Ionicons name="checkmark-circle-outline" size={22} color="white" />
                    <Text className="text-white text-lg md:text-xl font-extrabold ms-2">
                      Vérifier le code
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => { setStep('phone'); setOtp(Array(OTP_LENGTH).fill('')); }}
                className="mt-6 items-center py-3"
              >
                <Text className="text-blue-500 text-base md:text-lg font-semibold">
                  Renvoyer un code WhatsApp
                </Text>
              </TouchableOpacity>
            </View>
          )}

        </View>

        {/* ── Lien Espace Chauffeur ─────────────────────────────────── */}
        <View className="pb-8 pt-4 items-center">
          <TouchableOpacity onPress={() => navigation?.navigate('Login')}>
            <Text className="text-xs text-slate-400 font-medium tracking-wide">
              Espace Chauffeur / Partenaire
            </Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* ── Modal Sélecteur de Pays ──────────────────────────────────────── */}
      <Modal visible={showCountryModal} animationType="slide" transparent={true}>
        <View className="flex-1 justify-end bg-black/60">
          <View className="bg-white rounded-t-3xl max-h-[70%]">
            <View className="flex-row justify-between items-center p-6 border-b border-slate-100">
              <Text className="text-xl font-black text-slate-800">Choisir un pays</Text>
              <TouchableOpacity onPress={() => setShowCountryModal(false)} className="bg-slate-100 p-2 rounded-full">
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
            <ScrollView className="p-4">
              {COUNTRIES.map((country, index) => (
                <TouchableOpacity
                  key={country.code + index}
                  onPress={() => {
                    setSelectedCountry(country);
                    setShowCountryModal(false);
                  }}
                  className={`flex-row items-center p-4 mb-2 rounded-xl border ${selectedCountry.code === country.code ? 'border-blue-500 bg-blue-50' : 'border-slate-100 bg-white'}`}
                >
                  <Text className="text-3xl mr-4">{country.flag}</Text>
                  <Text className="flex-1 text-lg font-semibold text-slate-800">{country.name}</Text>
                  <Text className="text-lg font-bold text-slate-500">{country.code}</Text>
                </TouchableOpacity>
              ))}
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

    </KeyboardAvoidingView>
  );
}

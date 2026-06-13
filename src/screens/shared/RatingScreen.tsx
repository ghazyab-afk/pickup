import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Modal,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '../../context/LanguageContext';

// ── Mock driver data ──────────────────────────────────────────────────
const MOCK_DRIVER = {
  name: 'Khalid Al Balushi',
  avatar: '🚛',
  vehicle: 'Toyota Hilux — Pickup Small',
  tripSummary: 'Ruwi → Al Mawaleh',
  price: '12.50',
};

// ── Star component ─────────────────────────────────────────────────────
function StarRating({ rating, onRate }: { rating: number; onRate: (n: number) => void }) {
  const [hovered, setHovered] = useState(0);
  const display = hovered || rating;

  return (
    <View className="flex-row justify-center gap-2 my-2">
      {[1, 2, 3, 4, 5].map((star) => (
        <TouchableOpacity
          key={star}
          onPress={() => onRate(star)}
          // @ts-ignore — web only
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          activeOpacity={0.7}
          className="p-1"
        >
          <Ionicons
            name={display >= star ? 'star' : 'star-outline'}
            size={40}
            color={display >= star ? '#facc15' : '#cbd5e1'}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── Labels per rating ──────────────────────────────────────────────────
function ratingLabel(rating: number, t: (k: string) => string): string {
  const map: Record<number, string> = {
    1: t('rating.label_1'),
    2: t('rating.label_2'),
    3: t('rating.label_3'),
    4: t('rating.label_4'),
    5: t('rating.label_5'),
  };
  return map[rating] || '';
}

// ── Main Component ─────────────────────────────────────────────────────
interface RatingScreenProps {
  visible?: boolean;
  onClose?: () => void;
  onSubmit?: (rating: number, comment: string) => void;
  driverName?: string;
  tripInfo?: string;
  price?: string;
}

export default function RatingScreen({
  visible = true,
  onClose,
  onSubmit,
  driverName = MOCK_DRIVER.name,
  tripInfo = MOCK_DRIVER.tripSummary,
  price = MOCK_DRIVER.price,
}: RatingScreenProps) {
  const { t } = useTranslation();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = () => {
    if (rating === 0) {
      Alert.alert(t('common.attention'), t('rating.select_stars'));
      return;
    }
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      onSubmit?.(rating, comment);
      Alert.alert(t('common.success'), t('rating.thank_you'));
      onClose?.();
    }, 1000);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View className="flex-1 bg-black/60 justify-end md:justify-center md:px-16 lg:px-48">
        <View className="bg-white rounded-t-3xl md:rounded-3xl overflow-hidden shadow-2xl">
          <ScrollView
            contentContainerStyle={{ padding: 28 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Close button */}
            <TouchableOpacity
              onPress={onClose}
              className="absolute top-4 end-4 w-10 h-10 rounded-full bg-slate-100 items-center justify-center z-10"
            >
              <Ionicons name="close" size={20} color="#64748b" />
            </TouchableOpacity>

            {/* Title */}
            <Text className="text-2xl md:text-3xl font-black text-slate-800 text-center mb-1">
              {t('rating.title')}
            </Text>
            <Text className="text-sm md:text-base text-slate-400 text-center mb-6">
              {tripInfo}
            </Text>

            {/* Driver card */}
            <View className="bg-slate-50 rounded-2xl p-4 md:p-6 flex-row items-center mb-6 border border-slate-100">
              <View className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-blue-100 items-center justify-center me-4">
                <Text className="text-4xl md:text-5xl">{MOCK_DRIVER.avatar}</Text>
              </View>
              <View className="flex-1">
                <Text className="text-lg md:text-xl font-bold text-slate-800">{driverName}</Text>
                <Text className="text-sm md:text-base text-slate-500 font-medium">{MOCK_DRIVER.vehicle}</Text>
                <View className="flex-row items-center mt-2">
                  <Ionicons name="cash-outline" size={16} color="#16a34a" />
                  <Text className="text-base md:text-lg font-black text-green-600 ms-1">{price} OMR</Text>
                </View>
              </View>
            </View>

            {/* Stars */}
            <Text className="text-sm md:text-base font-bold text-slate-500 text-center uppercase tracking-wider mb-2">
              {t('rating.prompt')}
            </Text>
            <StarRating rating={rating} onRate={setRating} />

            {/* Dynamic label */}
            {rating > 0 && (
              <Text className="text-center text-lg md:text-xl font-bold text-yellow-500 mt-1 mb-4">
                {ratingLabel(rating, t)}
              </Text>
            )}

            {/* Comment */}
            <TextInput
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-4 text-base md:text-lg text-slate-700 mt-4 mb-6"
              placeholder={t('rating.comment_placeholder')}
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={3}
              style={{ minHeight: 80, textAlignVertical: 'top' }}
              value={comment}
              onChangeText={setComment}
            />

            {/* Submit */}
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={submitting || rating === 0}
              className={`w-full rounded-2xl py-4 md:py-5 items-center ${
                rating > 0 ? 'bg-blue-600' : 'bg-slate-300'
              }`}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white text-lg md:text-xl font-extrabold">
                  {t('rating.submit')}
                </Text>
              )}
            </TouchableOpacity>

            {/* Skip */}
            <TouchableOpacity onPress={onClose} className="mt-3 items-center py-2">
              <Text className="text-slate-400 text-base font-medium">{t('rating.skip')}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

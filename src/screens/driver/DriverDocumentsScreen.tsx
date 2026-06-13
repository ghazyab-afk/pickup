import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Switch,
  Alert,
  Platform,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '../../context/LanguageContext';

// ── Types ──────────────────────────────────────────────────────────────
type DocStatus = 'not_submitted' | 'pending' | 'approved' | 'rejected';

interface DriverDocument {
  id: string;
  titleKey: string;       // i18n key
  descriptionKey: string; // i18n key
  icon: keyof typeof Ionicons.glyphMap;
  status: DocStatus;
  fileName?: string;
  uploading: boolean;
}

// ── Initial documents list ─────────────────────────────────────────────
const INITIAL_DOCUMENTS: DriverDocument[] = [
  {
    id: 'civil_id',
    titleKey: 'documents.civil_id',
    descriptionKey: 'documents.civil_id_desc',
    icon: 'id-card-outline',
    status: 'not_submitted',
    uploading: false,
  },
  {
    id: 'driving_license',
    titleKey: 'documents.driving_license',
    descriptionKey: 'documents.driving_license_desc',
    icon: 'car-outline',
    status: 'not_submitted',
    uploading: false,
  },
  {
    id: 'vehicle_registration',
    titleKey: 'documents.vehicle_registration',
    descriptionKey: 'documents.vehicle_registration_desc',
    icon: 'document-text-outline',
    status: 'not_submitted',
    uploading: false,
  },
  {
    id: 'police_clearance',
    titleKey: 'documents.police_clearance',
    descriptionKey: 'documents.police_clearance_desc',
    icon: 'shield-checkmark-outline',
    status: 'not_submitted',
    uploading: false,
  },
  {
    id: 'commercial_registration',
    titleKey: 'documents.commercial_registration',
    descriptionKey: 'documents.commercial_registration_desc',
    icon: 'briefcase-outline',
    status: 'not_submitted',
    uploading: false,
  },
  {
    id: 'transport_permit',
    titleKey: 'documents.transport_permit',
    descriptionKey: 'documents.transport_permit_desc',
    icon: 'bus-outline',
    status: 'not_submitted',
    uploading: false,
  },
];

// ── Status badge config ────────────────────────────────────────────────
const STATUS_CONFIG: Record<DocStatus, { bg: string; text: string; border: string; labelKey: string }> = {
  not_submitted: { bg: 'bg-slate-100', text: 'text-slate-500', border: 'border-slate-200', labelKey: 'documents.status_not_submitted' },
  pending:       { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-200', labelKey: 'documents.status_pending' },
  approved:      { bg: 'bg-green-50',  text: 'text-green-600',  border: 'border-green-200',  labelKey: 'documents.status_approved' },
  rejected:      { bg: 'bg-red-50',    text: 'text-red-600',    border: 'border-red-200',    labelKey: 'documents.status_rejected' },
};

// ── Component ──────────────────────────────────────────────────────────
export default function DriverDocumentsScreen() {
  const { t } = useTranslation();
  const [documents, setDocuments] = useState<DriverDocument[]>(INITIAL_DOCUMENTS);
  const [cargoInsurance, setCargoInsurance] = useState(false);

  // Count approved docs
  const approvedCount = documents.filter((d) => d.status === 'approved').length;
  const allApproved = approvedCount === documents.length;

  // ── Pick & Upload (simulated) ──────────────────────────────────────
  const handleUpload = useCallback(async (docId: string) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const pickedFile = result.assets[0];
      if (!pickedFile) return;

      // Mark as uploading
      setDocuments((prev) =>
        prev.map((d) =>
          d.id === docId ? { ...d, uploading: true, fileName: pickedFile.name } : d
        )
      );

      // Simulate upload delay (1.5s)
      setTimeout(() => {
        setDocuments((prev) =>
          prev.map((d) =>
            d.id === docId ? { ...d, uploading: false, status: 'pending' } : d
          )
        );
      }, 1500);
    } catch (err) {
      Alert.alert(t('common.error'), String(err));
    }
  }, [t]);

  // ── Go Online ──────────────────────────────────────────────────────
  const handleGoOnline = () => {
    if (!allApproved) return;
    Alert.alert(t('common.success'), t('documents.go_online_success'));
  };

  // ── Render status badge ────────────────────────────────────────────
  const renderStatusBadge = (status: DocStatus) => {
    const cfg = STATUS_CONFIG[status];
    return (
      <View className={`px-3 py-1 rounded-full border ${cfg.bg} ${cfg.border}`}>
        <Text className={`text-xs md:text-sm font-bold ${cfg.text}`}>
          {t(cfg.labelKey)}
        </Text>
      </View>
    );
  };

  // ── Render action button per status ────────────────────────────────
  const renderAction = (doc: DriverDocument) => {
    if (doc.uploading) {
      return (
        <View className="flex-row items-center py-3 md:py-4">
          <ActivityIndicator size="small" color="#f97316" />
          <Text className="text-orange-500 font-semibold text-sm md:text-base ms-2">
            {t('documents.uploading')}
          </Text>
        </View>
      );
    }

    switch (doc.status) {
      case 'not_submitted':
        return (
          <TouchableOpacity
            onPress={() => handleUpload(doc.id)}
            className="flex-row items-center bg-blue-600 rounded-xl px-4 py-3 md:py-4 mt-2"
            activeOpacity={0.8}
          >
            <Ionicons name="cloud-upload-outline" size={18} color="white" />
            <Text className="text-white font-bold text-sm md:text-base ms-2">
              {t('documents.upload')}
            </Text>
          </TouchableOpacity>
        );

      case 'pending':
        return (
          <View className="flex-row items-center mt-2 py-2">
            <Ionicons name="time-outline" size={18} color="#f97316" />
            <Text className="text-orange-500 font-medium text-sm md:text-base ms-2">
              {t('documents.under_review')}
            </Text>
          </View>
        );

      case 'approved':
        return (
          <View className="flex-row items-center mt-2 py-2">
            <Ionicons name="checkmark-circle" size={20} color="#16a34a" />
            <Text className="text-green-600 font-bold text-sm md:text-base ms-2">
              {t('documents.verified')}
            </Text>
          </View>
        );

      case 'rejected':
        return (
          <TouchableOpacity
            onPress={() => handleUpload(doc.id)}
            className="flex-row items-center bg-red-500 rounded-xl px-4 py-3 md:py-4 mt-2"
            activeOpacity={0.8}
          >
            <Ionicons name="refresh-outline" size={18} color="white" />
            <Text className="text-white font-bold text-sm md:text-base ms-2">
              {t('documents.retry')}
            </Text>
          </TouchableOpacity>
        );
    }
  };

  // ── Main render ────────────────────────────────────────────────────
  return (
    <View className="flex-1 bg-slate-50">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* Header section */}
        <View className="px-5 md:px-20 lg:px-48 pt-6 md:pt-10 pb-4">
          <Text className="text-3xl md:text-4xl lg:text-5xl font-black text-slate-800 mb-2">
            {t('documents.title')}
          </Text>
          <Text className="text-base md:text-lg lg:text-xl text-slate-500 font-medium">
            {t('documents.subtitle')}
          </Text>

          {/* Progress bar */}
          <View className="mt-5 md:mt-8">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-sm md:text-base font-bold text-slate-600">
                {t('documents.progress')}
              </Text>
              <Text className="text-sm md:text-base font-black text-blue-600">
                {approvedCount}/{documents.length}
              </Text>
            </View>
            <View className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
              <View
                className={`h-full rounded-full ${allApproved ? 'bg-green-500' : 'bg-blue-600'}`}
                style={{ width: `${(approvedCount / documents.length) * 100}%` }}
              />
            </View>
          </View>
        </View>

        {/* Documents list */}
        <View className="px-5 md:px-20 lg:px-48">
          {documents.map((doc, index) => (
            <View
              key={doc.id}
              className="bg-white rounded-2xl p-5 md:p-6 lg:p-8 mb-4 md:mb-5 border border-slate-100 shadow-sm"
            >
              {/* Top row: Icon + Title + Badge */}
              <View className="flex-row items-start justify-between">
                <View className="flex-row items-center flex-1 me-3">
                  <View className={`w-11 h-11 md:w-14 md:h-14 rounded-xl items-center justify-center me-3 md:me-4 ${
                    doc.status === 'approved' ? 'bg-green-100' :
                    doc.status === 'pending'  ? 'bg-orange-100' :
                    doc.status === 'rejected' ? 'bg-red-100' :
                    'bg-slate-100'
                  }`}>
                    <Ionicons
                      name={doc.icon}
                      size={Platform.OS === 'web' ? 24 : 20}
                      color={
                        doc.status === 'approved' ? '#16a34a' :
                        doc.status === 'pending'  ? '#f97316' :
                        doc.status === 'rejected' ? '#dc2626' :
                        '#64748b'
                      }
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-base md:text-lg lg:text-xl font-bold text-slate-800">
                      {t(doc.titleKey)}
                    </Text>
                    <Text className="text-xs md:text-sm lg:text-base text-slate-400 font-medium mt-0.5">
                      {t(doc.descriptionKey)}
                    </Text>
                  </View>
                </View>
                {renderStatusBadge(doc.status)}
              </View>

              {/* File name if uploaded */}
              {doc.fileName && (
                <View className="flex-row items-center mt-3 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                  <Ionicons name="attach-outline" size={16} color="#64748b" />
                  <Text className="text-slate-600 text-xs md:text-sm font-medium ms-2 flex-1" numberOfLines={1}>
                    {doc.fileName}
                  </Text>
                </View>
              )}

              {/* Action button */}
              {renderAction(doc)}
            </View>
          ))}
        </View>

        {/* ── Cargo Insurance Section ─────────────────────────────────── */}
        <View className="px-5 md:px-20 lg:px-48 mt-2 mb-4">
          <View className="bg-white rounded-2xl p-5 md:p-6 lg:p-8 border border-slate-100 shadow-sm">
            <View className="flex-row items-center justify-between">
              <View className="flex-1 me-4">
                <View className="flex-row items-center mb-1">
                  <Ionicons name="shield-outline" size={20} color="#2563eb" />
                  <Text className="text-base md:text-lg lg:text-xl font-bold text-slate-800 ms-2">
                    {t('documents.cargo_insurance')}
                  </Text>
                </View>
                <Text className="text-xs md:text-sm lg:text-base text-slate-400 font-medium">
                  {t('documents.cargo_insurance_desc')}
                </Text>
              </View>
              <Switch
                value={cargoInsurance}
                onValueChange={setCargoInsurance}
                trackColor={{ false: '#e2e8f0', true: '#93c5fd' }}
                thumbColor={cargoInsurance ? '#2563eb' : '#94a3b8'}
              />
            </View>
            {cargoInsurance && (
              <View className="mt-4 bg-blue-50 rounded-xl p-4 border border-blue-100">
                <Text className="text-blue-700 text-sm md:text-base font-medium">
                  {t('documents.cargo_insurance_info')}
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* ── Go Online Button (Fixed bottom) ─────────────────────────── */}
      <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-slate-100 px-5 md:px-20 lg:px-48 py-4 md:py-5">
        <TouchableOpacity
          onPress={handleGoOnline}
          disabled={!allApproved}
          className={`w-full rounded-2xl py-4 md:py-5 flex-row justify-center items-center ${
            allApproved
              ? 'bg-green-600'
              : 'bg-slate-300'
          }`}
          activeOpacity={0.8}
        >
          <Ionicons
            name={allApproved ? 'flash' : 'lock-closed-outline'}
            size={22}
            color="white"
          />
          <Text className="text-white text-lg md:text-xl lg:text-2xl font-extrabold ms-2">
            {allApproved ? t('documents.go_online') : t('documents.go_online_locked')}
          </Text>
        </TouchableOpacity>

        {!allApproved && (
          <Text className="text-center text-slate-400 text-xs md:text-sm font-medium mt-2">
            {t('documents.go_online_hint')}
          </Text>
        )}
      </View>
    </View>
  );
}

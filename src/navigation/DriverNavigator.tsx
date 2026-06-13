import React from 'react';
import { View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import DriverDashboardScreen from '../screens/driver/DriverDashboardScreen';
import DriverActiveRideScreen from '../screens/driver/DriverActiveRideScreen';
import DriverProfileScreen from '../screens/driver/DriverProfileScreen';
import DriverDocumentsScreen from '../screens/driver/DriverDocumentsScreen';
import { Ionicons } from '@expo/vector-icons';
import LanguageSelector from '../components/LanguageSelector';
import { useLanguage, useTranslation } from '../context/LanguageContext';

const Tab = createBottomTabNavigator();

export default function DriverNavigator() {
  const { t } = useTranslation();
  const { locale } = useLanguage();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'list';
          if (route.name === 'Dashboard') iconName = 'list';
          else if (route.name === 'ActiveRide') iconName = 'car';
          else if (route.name === 'Documents') iconName = 'document-text';
          else if (route.name === 'DriverProfile') iconName = 'person';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#64748b',
        headerShown: true,
        headerStyle: { backgroundColor: '#ffffff', elevation: 0, shadowOpacity: 0 },
        headerTitleStyle: { color: '#1e293b', fontWeight: '700', fontSize: 18 },
        headerRight: () => (
          <View className="me-4">
            <LanguageSelector />
          </View>
        ),
      })}
    >
      <Tab.Screen
        name="Dashboard"
        component={DriverDashboardScreen}
        options={{ title: t('nav.dashboard'), tabBarLabel: t('nav.dashboard') }}
      />
      <Tab.Screen
        name="ActiveRide"
        component={DriverActiveRideScreen}
        options={{ title: t('nav.active_ride'), tabBarLabel: t('nav.active_ride') }}
      />
      <Tab.Screen
        name="Documents"
        component={DriverDocumentsScreen}
        options={{ title: t('nav.documents'), tabBarLabel: t('nav.documents') }}
      />
      <Tab.Screen
        name="DriverProfile"
        component={DriverProfileScreen}
        options={{ title: t('nav.profile'), tabBarLabel: t('nav.profile') }}
      />
    </Tab.Navigator>
  );
}


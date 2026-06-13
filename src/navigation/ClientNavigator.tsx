import React from 'react';
import { View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import ClientHomeScreen from '../screens/client/ClientHomeScreen';
import ClientRidesScreen from '../screens/client/ClientRidesScreen';
import ClientProfileScreen from '../screens/client/ClientProfileScreen';
import { Ionicons } from '@expo/vector-icons';
import LanguageSelector from '../components/LanguageSelector';
import { useLanguage, useTranslation } from '../context/LanguageContext';

const Tab = createBottomTabNavigator();

export default function ClientNavigator() {
  const { t } = useTranslation();
  // Dépendre de locale pour re-rendre les labels lors du changement de langue
  const { locale } = useLanguage();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home';
          if (route.name === 'Home') iconName = 'home';
          else if (route.name === 'MyRides') iconName = 'list';
          else if (route.name === 'Profile') iconName = 'person';
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
        name="Home"
        component={ClientHomeScreen}
        options={{ title: t('nav.home'), tabBarLabel: t('nav.home') }}
      />
      <Tab.Screen
        name="MyRides"
        component={ClientRidesScreen}
        options={{ title: t('nav.my_rides'), tabBarLabel: t('nav.my_rides') }}
      />
      <Tab.Screen
        name="Profile"
        component={ClientProfileScreen}
        options={{ title: t('nav.profile'), tabBarLabel: t('nav.profile') }}
      />
    </Tab.Navigator>
  );
}

import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { ActivityIndicator, View, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import AuthStack from './AuthStack';
import ClientNavigator from './ClientNavigator';
import DriverNavigator from './DriverNavigator';
import CompleteProfileScreen from '../screens/auth/CompleteProfileScreen';
import ThawaniDepositScreen from '../screens/client/ThawaniDepositScreen';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

const ClientStack = createNativeStackNavigator();

const ClientFlow = () => (
  <ClientStack.Navigator screenOptions={{ headerShown: false }}>
    <ClientStack.Screen name="ClientMain" component={ClientNavigator} />
    <ClientStack.Screen name="ThawaniDeposit" component={ThawaniDepositScreen} />
  </ClientStack.Navigator>
);

const PERSISTENCE_KEY = 'NAVIGATION_STATE_V1';

export default function AppNavigator() {
  const { session, profile, loading } = useAuth();
  const [isReady, setIsReady] = useState(Platform.OS === 'web'); // Web doesn't reload, no need to delay
  const [initialState, setInitialState] = useState();

  useEffect(() => {
    const restoreState = async () => {
      try {
        const savedStateString = await AsyncStorage.getItem(PERSISTENCE_KEY);
        const state = savedStateString ? JSON.parse(savedStateString) : undefined;
        if (state !== undefined) {
          setInitialState(state);
        }
      } catch (e) {
        // Ignore errors
      } finally {
        setIsReady(true);
      }
    };

    if (!isReady) {
      restoreState();
    }
  }, [isReady]);

  if (loading || !isReady) {
    return (
      <View className="flex-1 justify-center items-center bg-slate-50">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <NavigationContainer
      initialState={initialState}
      onStateChange={(state) => {
        if (Platform.OS !== 'web') {
          AsyncStorage.setItem(PERSISTENCE_KEY, JSON.stringify(state));
        }
      }}
    >
      {!session ? (
        <AuthStack />
      ) : !profile?.role ? (
        <CompleteProfileScreen />
      ) : profile.role === 'driver' ? (
        <DriverNavigator />
      ) : (
        <ClientFlow />
      )}
    </NavigationContainer>
  );
}

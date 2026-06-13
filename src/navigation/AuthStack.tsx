import React from 'react';
import { View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import PhoneAuthScreen from '../screens/auth/PhoneAuthScreen';
import ChatScreen from '../screens/shared/ChatScreen';
import RatingScreen from '../screens/shared/RatingScreen';
import LanguageSelector from '../components/LanguageSelector';

const Stack = createNativeStackNavigator();

export default function AuthStack() {
  return (
    <Stack.Navigator
      initialRouteName="PhoneAuth"
      screenOptions={{
        headerShown: true,
        headerTransparent: true,
        headerTitle: '',
        headerRight: () => (
          <View className="me-2">
            <LanguageSelector />
          </View>
        ),
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="PhoneAuth" component={PhoneAuthScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Rating" component={RatingScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

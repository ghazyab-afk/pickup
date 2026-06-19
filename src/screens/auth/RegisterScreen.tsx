/**
 * RegisterScreen.tsx
 *
 * Since Pickup uses 100% phone-based (OTP) authentication, there is no separate
 * registration flow. New users authenticate via PhoneAuthScreen → verify OTP →
 * then complete their profile (name + role) on CompleteProfileScreen.
 *
 * This screen redirects immediately to PhoneAuth so any lingering deep-link or
 * back-navigation to "Register" lands on the correct screen.
 */
import { useEffect } from 'react';

export default function RegisterScreen({ navigation }: any) {
  useEffect(() => {
    navigation.replace('PhoneAuth');
  }, []);

  return null;
}

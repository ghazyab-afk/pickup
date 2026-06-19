/**
 * src/services/phoneAuthService.ts
 *
 * Centralises all Phone OTP logic:
 *   - sendWhatsAppOTP  → calls the Edge Function "send-whatsapp-otp"
 *   - verifyOTP        → calls the Edge Function "verify-whatsapp-otp"
 *
 * Swap the `DEV_MODE` flag to `false` when the Edge Functions are deployed.
 */

import { supabase } from './supabase';

// ── Dev / Production toggle ────────────────────────────────────────────
// When true, skips real network calls and always succeeds after a delay.
const DEV_MODE = true;
const DEV_MOCK_OTP = '123456'; // Pre-fill this in your dev tests

// ── Types ──────────────────────────────────────────────────────────────
export interface OtpResult {
  success: boolean;
  error?: string;
}

export interface VerifyResult {
  success: boolean;
  session?: any;
  error?: string;
}

/**
 * Formats the phone number to E.164 standard for WhatsApp API.
 * Example: "91234567" → "+96891234567"
 */
export function formatOmanPhone(localNumber: string): string {
  const digits = localNumber.replace(/\D/g, '');
  // Already has country code
  if (digits.startsWith('968')) return `+${digits}`;
  return `+968${digits}`;
}

/**
 * Sends a WhatsApp OTP to the given phone number.
 *
 * Backend: supabase/functions/send-whatsapp-otp/index.ts
 *
 * In DEV_MODE, simulates a 1s network delay and always returns success.
 * In production, invokes the Supabase Edge Function which:
 *   1. Generates a random 6-digit token
 *   2. Stores it (hashed) in Supabase with a 10-min TTL
 *   3. Sends it via WhatsApp (Meta Cloud API or Twilio)
 */
export async function sendWhatsAppOTP(localPhone: string): Promise<OtpResult> {
  const phone = formatOmanPhone(localPhone);

  if (DEV_MODE) {
    console.log(`[DEV] OTP for ${phone}: ${DEV_MOCK_OTP}`);
    await new Promise((r) => setTimeout(r, 1000));
    return { success: true };
  }

  try {
    const { data, error } = await supabase.functions.invoke('send-whatsapp-otp', {
      body: { phone },
    });

    if (error) throw error;
    if (!data?.success) throw new Error(data?.message || 'Failed to send OTP');

    return { success: true };
  } catch (err: any) {
    console.error('[sendWhatsAppOTP]', err);
    return { success: false, error: err.message ?? 'Network error' };
  }
}

/**
 * Verifies a 6-digit OTP against the stored token.
 *
 * Backend: supabase/functions/verify-whatsapp-otp/index.ts
 *
 * In DEV_MODE, accepts only DEV_MOCK_OTP and returns a fake session object.
 * In production, the Edge Function:
 *   1. Checks the token against the hashed value in Supabase
 *   2. Signs in the user via supabase.auth.signInWithPassword or a custom JWT
 *   3. Returns the session
 */
export async function verifyOTP(
  localPhone: string,
  token: string
): Promise<VerifyResult> {
  const phone = formatOmanPhone(localPhone);

  if (DEV_MODE) {
    await new Promise((r) => setTimeout(r, 1000));
    if (token === DEV_MOCK_OTP) {
      // Return a fake session so the app behaves as if logged in
      return {
        success: true,
        session: { user: { phone, id: '00000000-0000-0000-0000-000000000001' }, access_token: 'dev-token' },
      };
    }
    return { success: false, error: 'Invalid OTP. In dev mode, use: ' + DEV_MOCK_OTP };
  }

  try {
    const { data, error } = await supabase.functions.invoke('verify-whatsapp-otp', {
      body: { phone, token },
    });

    if (error) throw error;
    if (!data?.success) throw new Error(data?.message || 'Invalid or expired OTP');

    // ── Persist session in localStorage (web) / SecureStore (native) ──────────
    // The Edge Function signed the user in server-side and returned a session.
    // We must call setSession() so the Supabase client stores the tokens locally,
    // which ensures the session survives a page refresh on web (F5 / Netlify).
    if (data.session?.access_token && data.session?.refresh_token) {
      const { error: setSessionError } = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });
      if (setSessionError) {
        console.warn('[verifyOTP] setSession warning:', setSessionError.message);
      }
    }

    // The Edge Function returns a Supabase session after signing in the user
    return { success: true, session: data.session };
  } catch (err: any) {
    console.error('[verifyOTP]', err);
    return { success: false, error: err.message ?? 'Verification failed' };
  }
}

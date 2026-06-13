/**
 * supabase/functions/verify-whatsapp-otp/index.ts
 *
 * Supabase Edge Function — Deno runtime
 *
 * PURPOSE:
 *   Validates the OTP token submitted by the user.
 *   If valid → signs the user into Supabase Auth and returns the session.
 *   If invalid / expired → returns an error.
 *
 * REQUIRED DB TABLE  (run supabase_schema.sql to create it):
 *   phone_otps (phone TEXT PK, otp_hash TEXT, expires_at TIMESTAMPTZ)
 *
 * DEPLOY COMMAND:
 *   npx supabase functions deploy verify-whatsapp-otp --project-ref <ref>
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { phone, token } = await req.json();

    if (!phone || !token) {
      return new Response(
        JSON.stringify({ success: false, message: 'Missing phone or token' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // ── 1. Look up the stored OTP ────────────────────────────────────
    const { data: otpRecord, error: fetchError } = await supabaseAdmin
      .from('phone_otps')
      .select('otp_hash, expires_at')
      .eq('phone', phone)
      .single();

    if (fetchError || !otpRecord) {
      return new Response(
        JSON.stringify({ success: false, message: 'OTP not found. Please request a new one.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── 2. Check expiry ───────────────────────────────────────────────
    if (new Date(otpRecord.expires_at) < new Date()) {
      await supabaseAdmin.from('phone_otps').delete().eq('phone', phone);
      return new Response(
        JSON.stringify({ success: false, message: 'OTP has expired. Please request a new one.' }),
        { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── 3. Verify token ───────────────────────────────────────────────
    if (otpRecord.otp_hash !== token) {
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid OTP.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── 4. Delete the used OTP ────────────────────────────────────────
    await supabaseAdmin.from('phone_otps').delete().eq('phone', phone);

    // ── 5. Sign in or create the user in Supabase Auth ────────────────
    // Using a deterministic email derived from the phone (no real email needed)
    const fakeEmail = `${phone.replace('+', '')}@pickup.phone`;
    const password  = Deno.env.get('PHONE_AUTH_SECRET') ?? 'PhoneAuth!Secure#2024';

    // Try to create user first; if they already exist, just sign them in
    const { error: signUpError } = await supabaseAdmin.auth.admin.createUser({
      email: fakeEmail,
      password,
      phone,
      email_confirm: true,
      phone_confirm: true,
      user_metadata: { phone, auth_method: 'whatsapp_otp' },
    });

    if (signUpError && !signUpError.message.includes('already registered')) {
      throw signUpError;
    }

    // Sign in to get the session
    const supabasePublic = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const { data: signInData, error: signInError } = await supabasePublic.auth.signInWithPassword({
      email: fakeEmail,
      password,
    });

    if (signInError || !signInData?.session) {
      throw signInError ?? new Error('Failed to create session');
    }

    return new Response(
      JSON.stringify({ success: true, session: signInData.session }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('verify-whatsapp-otp error:', err);
    return new Response(
      JSON.stringify({ success: false, message: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

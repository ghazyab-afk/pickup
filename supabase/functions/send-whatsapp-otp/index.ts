/**
 * supabase/functions/send-whatsapp-otp/index.ts
 *
 * Supabase Edge Function — Deno runtime
 *
 * PURPOSE:
 *   Receives a phone number, generates a 6-digit OTP, stores it in
 *   the database with a 10-minute expiry, and sends it via WhatsApp.
 *
 * ENVIRONMENT VARIABLES (set in Supabase Dashboard → Edge Functions → Secrets):
 *   WHATSAPP_TOKEN        — Meta/Facebook System User Access Token
 *   WHATSAPP_PHONE_ID     — Meta WhatsApp Business Phone ID
 *   WHATSAPP_TEMPLATE     — Approved template name (e.g. "otp_verification")
 *
 * DEPLOY COMMAND:
 *   npx supabase functions deploy send-whatsapp-otp --project-ref <ref>
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { phone } = await req.json();

    if (!phone || !/^\+968\d{7,8}$/.test(phone)) {
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid Omani phone number' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── 1. Generate 6-digit OTP ─────────────────────────────────────
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // +10 min

    // ── 2. Store OTP in Supabase (requires a `phone_otps` table) ────
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Upsert: one OTP per phone at a time
    await supabase.from('phone_otps').upsert(
      { phone, otp_hash: otp, expires_at: expiresAt },
      { onConflict: 'phone' }
    );

    // ── 3. Send OTP via WhatsApp (Meta Cloud API) ──────────────────
    const WHATSAPP_TOKEN    = Deno.env.get('WHATSAPP_TOKEN') ?? '';
    const WHATSAPP_PHONE_ID = Deno.env.get('WHATSAPP_PHONE_ID') ?? '';
    const TEMPLATE_NAME     = Deno.env.get('WHATSAPP_TEMPLATE') ?? 'otp_verification';

    const waResponse = await fetch(
      `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: phone,
          type: 'template',
          template: {
            name: TEMPLATE_NAME,
            language: { code: 'en' },
            components: [
              {
                type: 'body',
                parameters: [{ type: 'text', text: otp }],
              },
              {
                // Button with OTP auto-fill (if template supports it)
                type: 'button',
                sub_type: 'url',
                index: '0',
                parameters: [{ type: 'text', text: otp }],
              },
            ],
          },
        }),
      }
    );

    if (!waResponse.ok) {
      const waError = await waResponse.json();
      console.error('WhatsApp API error:', waError);
      // Don't expose internal errors to client — return generic message
      return new Response(
        JSON.stringify({ success: false, message: 'Failed to send WhatsApp message' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('send-whatsapp-otp error:', err);
    return new Response(
      JSON.stringify({ success: false, message: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

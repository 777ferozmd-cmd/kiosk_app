// Supabase Edge Function: cashfree-webhook
// Receives Cashfree payment events, verifies HMAC-SHA256 signature,
// and updates the corresponding order in Supabase on successful payment.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CASHFREE_SECRET  = Deno.env.get('CASHFREE_SECRET_KEY')!;
const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const rawBody = await req.text();

  // ── Signature Verification ──────────────────────────────────
  // Cashfree signs: timestamp + rawBody  using HMAC-SHA256
  const timestamp = req.headers.get('x-webhook-timestamp') ?? '';
  const receivedSig = req.headers.get('x-webhook-signature') ?? '';

  const encoder = new TextEncoder();
  const keyData = encoder.encode(CASHFREE_SECRET);
  const msgData = encoder.encode(timestamp + rawBody);

  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  );
  const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
  const computedSig = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));

  if (computedSig !== receivedSig) {
    console.error('Webhook signature mismatch');
    return new Response('Unauthorized', { status: 401 });
  }

  // ── Parse Payload ────────────────────────────────────────────
  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response('Bad Request: invalid JSON', { status: 400 });
  }

  const eventType    = payload?.type;          // e.g., "PAYMENT_SUCCESS_WEBHOOK"
  const paymentStatus = payload?.data?.payment?.payment_status;  // "SUCCESS"
  const cfOrderId    = payload?.data?.order?.order_id;           // matches our kiosk order_id

  console.log(`Webhook received: type=${eventType}, status=${paymentStatus}, order=${cfOrderId}`);

  // ── Handle PAYMENT_SUCCESS ────────────────────────────────────
  if (paymentStatus === 'SUCCESS' && cfOrderId) {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);

    const { error } = await supabase
      .from('orders')
      .update({
        payment_status:      'paid',
        status:              'processing',
        cashfree_order_id:   String(cfOrderId),
        payment_details:     payload?.data?.payment?.payment_method || {},
      })
      .eq('id', String(cfOrderId));   // our order_id matches what we passed to Cashfree

    if (error) {
      console.error('Supabase update failed:', error.message);
      return new Response('DB update failed', { status: 500 });
    }

    console.log(`Order ${cfOrderId} marked as paid and processing.`);
  }

  // ── Handle PAYMENT_FAILED (optional logging) ──────────────────
  if (paymentStatus === 'FAILED' && cfOrderId) {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);
    await supabase
      .from('orders')
      .update({ payment_status: 'failed' })
      .eq('id', String(cfOrderId));
    console.log(`Order ${cfOrderId} marked as payment failed.`);
  }

  return new Response('ok', { status: 200 });
});

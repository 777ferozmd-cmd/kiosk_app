// Supabase Edge Function: verify-cashfree-payment
// Called by the kiosk frontend after the Cashfree modal closes.
// Fetches the live order status from Cashfree's API — the authoritative source.
// This avoids trusting client-side result objects entirely.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const CASHFREE_APP_ID  = Deno.env.get('CASHFREE_APP_ID')!;
const CASHFREE_SECRET  = Deno.env.get('CASHFREE_SECRET_KEY')!;
const CASHFREE_API_VER = '2023-08-01';
const CASHFREE_BASE    = 'https://sandbox.cashfree.com/pg';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { cashfree_order_id } = await req.json();

    if (!cashfree_order_id) {
      return new Response(
        JSON.stringify({ error: 'Missing cashfree_order_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch order status from Cashfree
    const cfRes = await fetch(`${CASHFREE_BASE}/orders/${cashfree_order_id}`, {
      method: 'GET',
      headers: {
        'x-client-id':     CASHFREE_APP_ID,
        'x-client-secret': CASHFREE_SECRET,
        'x-api-version':   CASHFREE_API_VER,
      },
    });

    const cfData = await cfRes.json();

    if (!cfRes.ok) {
      console.error('Cashfree verify error:', cfData);
      return new Response(
        JSON.stringify({ error: cfData?.message || 'Failed to verify order' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // order_status: 'PAID' = success, 'ACTIVE' = pending, 'EXPIRED' = failed
    const order_status = cfData.order_status as string;
    const is_paid = order_status === 'PAID';
    const payment_details = cfData.payment_method || {};

    return new Response(
      JSON.stringify({ order_status, is_paid, payment_details }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('verify-cashfree-payment error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

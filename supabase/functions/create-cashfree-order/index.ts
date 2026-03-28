// Supabase Edge Function: create-cashfree-order
// Creates an order on Cashfree sandbox and returns payment_session_id to the kiosk frontend.
// SECRET KEYS ARE NEVER EXPOSED TO THE BROWSER.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const CASHFREE_APP_ID    = Deno.env.get('CASHFREE_APP_ID')!;
const CASHFREE_SECRET    = Deno.env.get('CASHFREE_SECRET_KEY')!;
const CASHFREE_API_URL   = 'https://sandbox.cashfree.com/pg/orders';
const CASHFREE_API_VER   = '2023-08-01';

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
    const { order_id, order_amount, customer_name, customer_phone } = await req.json();

    // Validate
    if (!order_id || !order_amount || !customer_name || !customer_phone) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: order_id, order_amount, customer_name, customer_phone' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (isNaN(Number(order_amount)) || Number(order_amount) <= 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid order_amount' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call Cashfree Create Order API
    const cashfreePayload = {
      order_id:        String(order_id).slice(0, 50),  // Cashfree max 50 chars
      order_amount:    parseFloat(Number(order_amount).toFixed(2)),
      order_currency:  'INR',
      customer_details: {
        customer_id:    `KIOSK_${String(customer_phone)}`,
        customer_phone: String(customer_phone),
        customer_name:  String(customer_name).slice(0, 60),
      },
      order_meta: {
        return_url: '', // No redirect — drop-in checkout handles callbacks
        notify_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/cashfree-webhook`,
      },
    };

    const cfRes = await fetch(CASHFREE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type':   'application/json',
        'x-client-id':    CASHFREE_APP_ID,
        'x-client-secret': CASHFREE_SECRET,
        'x-api-version':  CASHFREE_API_VER,
      },
      body: JSON.stringify(cashfreePayload),
    });

    const cfData = await cfRes.json();

    if (!cfRes.ok) {
      console.error('Cashfree API error:', cfData);
      return new Response(
        JSON.stringify({ error: cfData?.message || 'Failed to create Cashfree order' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        payment_session_id: cfData.payment_session_id,
        cashfree_order_id:  cfData.cf_order_id ?? cfData.order_id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Edge function error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

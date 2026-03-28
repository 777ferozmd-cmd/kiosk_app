import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Missing Supabase config in environment variables');
}

export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function fetchSettings() {
    const { data, error } = await supabaseClient
        .from('settings')
        .select('app_name')
        .eq('id', 1);
    if (error) throw error;
    return data;
}

export async function fetchProducts() {
    const { data, error } = await supabaseClient
        .from('products')
        .select('id,name,category,price,image,desc,has_customization,add_ons,adjustments,is_available')
        .order('category', { ascending: true })
        .order('id', { ascending: true });
    if (error) throw error;
    return data;
}

export function subscribeToProductChanges(callback) {
    return supabaseClient.channel('public:products')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'products' }, callback)
        .subscribe();
}

export async function persistOrder(orderData, orderItems) {
    const { error: orderError } = await supabaseClient
        .from('orders')
        .insert([orderData]);
    if (orderError) throw new Error(`Order insert failed: ${orderError.message}`);

    const { error: itemsError } = await supabaseClient
        .from('order_items')
        .insert(orderItems);
    if (itemsError) throw new Error(`Items insert failed: ${itemsError.message}`);
}

export async function createCashfreePaymentSession(payload, total, name, phone) {
    const { data, error } = await supabaseClient.functions.invoke('create-cashfree-order', {
        body: {
            order_id: payload.orderId,
            order_amount: parseFloat(total.toFixed(2)),
            customer_name: name,
            customer_phone: phone,
        }
    });
    
    if (error || !data?.payment_session_id) {
        throw new Error(data?.error || error?.message || 'Failed to create payment session');
    }
    return data.payment_session_id;
}

export async function verifyCashfreePayment(merchantOrderId) {
    const { data, error } = await supabaseClient.functions.invoke('verify-cashfree-payment', {
        body: { cashfree_order_id: merchantOrderId }
    });

    if (error) {
        throw new Error(error.message || 'Failed to verify payment');
    }
    return data;
}

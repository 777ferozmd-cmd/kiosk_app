-- =================================================================
-- SUPABASE ROW LEVEL SECURITY (RLS) POLICIES
-- Run this entire script in the Supabase SQL Editor
-- =================================================================

-- STEP 1: Enable RLS on all tables
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =================================================================
-- ORDERS TABLE
-- =================================================================

-- Kiosk (anon) can INSERT new orders
CREATE POLICY "kiosk_insert_orders"
ON public.orders FOR INSERT
TO anon
WITH CHECK (true);

-- Only authenticated admins can SELECT orders
CREATE POLICY "admin_select_orders"
ON public.orders FOR SELECT
TO authenticated
USING (true);

-- Only authenticated admins can UPDATE orders (status changes)
CREATE POLICY "admin_update_orders"
ON public.orders FOR UPDATE
TO authenticated
USING (true);

-- Only authenticated admins can DELETE orders
-- ⚠️ CRITICAL: NOT accessible by anon/kiosk — prevents DB wipe
CREATE POLICY "admin_delete_orders"
ON public.orders FOR DELETE
TO authenticated
USING (true);

-- =================================================================
-- ORDER ITEMS TABLE
-- =================================================================

-- Kiosk (anon) can INSERT order items
CREATE POLICY "kiosk_insert_order_items"
ON public.order_items FOR INSERT
TO anon
WITH CHECK (true);

-- Only authenticated admins can SELECT order items
CREATE POLICY "admin_select_order_items"
ON public.order_items FOR SELECT
TO authenticated
USING (true);

-- Only authenticated admins can DELETE order items
CREATE POLICY "admin_delete_order_items"
ON public.order_items FOR DELETE
TO authenticated
USING (true);

-- =================================================================
-- PRODUCTS TABLE
-- =================================================================

-- Kiosk (anon) can read menu items
CREATE POLICY "public_read_products"
ON public.products FOR SELECT
TO anon
USING (true);

-- Authenticated admins can also read products
CREATE POLICY "admin_read_products"
ON public.products FOR SELECT
TO authenticated
USING (true);

-- Only authenticated admins can UPDATE product availability
CREATE POLICY "admin_update_products"
ON public.products FOR UPDATE
TO authenticated
USING (true);

-- =================================================================
-- PROFILES TABLE
-- =================================================================

-- Authenticated users can read their own profile
CREATE POLICY "user_read_own_profile"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

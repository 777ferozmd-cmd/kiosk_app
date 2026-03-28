-- Run this in Supabase Dashboard → SQL Editor
-- Adds the two columns needed for Cashfree payment tracking

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS cashfree_order_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';

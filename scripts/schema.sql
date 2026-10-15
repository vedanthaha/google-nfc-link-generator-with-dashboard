-- Schema for ReviewQR / NFC Cards
-- Run this in your Supabase SQL Editor if setting up a fresh project

-- 1. Create table
CREATE TABLE IF NOT EXISTS public.businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  maps_url TEXT,
  google_review_url TEXT NOT NULL,
  place_id TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Indexes for fast slug lookups
CREATE INDEX IF NOT EXISTS idx_businesses_slug ON public.businesses (slug);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

-- 4. Policies
-- Allow public & anon access to view business review pages
DROP POLICY IF EXISTS "Allow public read access" ON public.businesses;
CREATE POLICY "Allow public read access"
  ON public.businesses
  FOR SELECT
  USING (true);

-- Allow public & anon access to register new businesses
DROP POLICY IF EXISTS "Allow public insert" ON public.businesses;
CREATE POLICY "Allow public insert"
  ON public.businesses
  FOR INSERT
  WITH CHECK (true);

-- NOTE: No public UPDATE or DELETE policies are granted.
-- Only the Supabase service_role key or direct database admin can modify or delete existing business records.

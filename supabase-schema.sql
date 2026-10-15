-- Supabase SQL Schema for ReviewQR & NFC Platform
-- Run this in your Supabase project's SQL Editor (https://supabase.com/dashboard/project/_/sql)

-- 1. Create the businesses table
create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  maps_url text,
  google_review_url text not null,
  place_id text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Create index on slug for fast lookups
create index if not exists idx_businesses_slug on public.businesses(slug);

-- 3. Enable Row Level Security (RLS)
alter table public.businesses enable row level security;

-- 4. Allow public read access so customer review pages (/review/[slug]) can read business configuration
create policy "Allow public read access on businesses"
  on public.businesses for select
  using (true);

-- 5. By default, service_role key bypasses RLS, allowing server-side API routes
-- to safely insert and manage businesses using SUPABASE_SERVICE_ROLE_KEY.

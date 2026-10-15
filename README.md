# ReviewQR & NFC Studio — AI Review Generator for Any Business

An open, high-converting platform that turns any Google Maps Business Profile into a dedicated, permanent AI-assisted customer review page with downloadable high-resolution QR codes (PNG & SVG) and NFC-ready URLs.

---

## Architecture & How It Works

1. **Dynamic Business Generator (`/`)**: Paste any Google Maps profile link, shortlink (`maps.app.goo.gl`), or review link.
2. **Deterministic Resolution**: Automatically extracts the business name and mathematically derives Google's official Place ID (`ChIJ...`) without paid Google Places APIs or Google billing requirements.
3. **Permanent Review Pages (`/review/[slug]`)**: Generates unique, permanent URLs (e.g. `https://your-domain.vercel.app/review/chocolate-boutique-a82k`). Configurations are stored in **Supabase**, ensuring each business has its own isolated configuration that persists permanently across redeployments.
4. **QR & NFC Matching**: The QR code and NFC link point to the exact same hosted `/review/[slug]` URL using the configured production domain (`APP_BASE_URL`).
5. **Customer AI Review Flow**: Customers select 1–5 stars, highlight categories (*Taste*, *Food Quality*, *Service*, *Ambience*), and optionally type what they tried.
6. **Strict Honest Groq AI Draft**: Uses server-side Groq (`groq-sdk` with `GROQ_MODEL`) to generate an authentic review strictly grounded in what the customer provided—never inventing items or facts, and faithfully reflecting positive, mixed, or negative ratings.
7. **One-Click Handoff**: Customers click **Copy Review & Open Google**, which saves the review to their device clipboard and opens the business's official Google review composer for them to paste and submit.

---

## Environment Variables

Configure these variables in your `.env.local` for local development and in your **Vercel Project Settings > Environment Variables** for production:

| Variable | Description | Example |
| :--- | :--- | :--- |
| `APP_BASE_URL` | The production URL of the deployed app (used for QR & NFC links) | `https://your-domain.vercel.app` |
| `DATABASE_URL` | Direct Supabase PostgreSQL connection string | `postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres` |
| `GROQ_API_KEY` | Groq Cloud API key for server-side AI review generation | `gsk_...` |
| `GROQ_MODEL` | Supported Groq model identifier | `openai/gpt-oss-20b` or `llama-3.3-70b-versatile` |
| `SUPABASE_URL` | Your Supabase project URL | `https://xyzproject.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Key (kept on server, never exposed to browser) | `eyJh...` |

*(Note: During local development, if Supabase or Groq credentials are not yet configured, the system gracefully uses a local development store and deterministic honest generator so you can test immediately without crashing).*

---

## Supabase Setup (Database Schema)

1. Create a free project at [supabase.com](https://supabase.com).
2. Go to the **SQL Editor** in your Supabase project dashboard.
3. Paste and run the schema below (also provided in [`supabase-schema.sql`](./supabase-schema.sql)):

```sql
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
```

4. Go to **Project Settings > API** in Supabase and copy:
   - **Project URL** -> `SUPABASE_URL`
   - **service_role (secret)** key -> `SUPABASE_SERVICE_ROLE_KEY`

---

## Deploying to Vercel

1. Push your repository to GitHub or GitLab.
2. In the [Vercel Dashboard](https://vercel.com/new), click **Import Project** and select this repository.
3. In the **Environment Variables** section, add:
   - `APP_BASE_URL`: your Vercel deployment URL (e.g. `https://your-app.vercel.app`)
   - `SUPABASE_URL`: your Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY`: your secret service role key
   - `GROQ_API_KEY`: your Groq API key (from [console.groq.com](https://console.groq.com))
   - `GROQ_MODEL`: `llama-3.3-70b-versatile`
4. Click **Deploy**.

---

## Local Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run linting
npm run lint

# Build production bundle
npm run build
```

Open [http://localhost:3000](http://localhost:3000) to test.

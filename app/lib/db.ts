import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Pool } from "pg";
import fs from "fs";
import path from "path";

export interface BusinessConfig {
  id?: string;
  slug: string;
  name: string;
  maps_url?: string;
  google_review_url: string;
  place_id?: string;
  created_at?: string;
}

// Global reference for Supabase client
let supabaseClient: SupabaseClient | null = null;
let pgPool: Pool | null = null;

function getPgPool(): Pool | null {
  const dbUrl =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.SUPABASE_DATABASE_URL;

  if (!dbUrl) return null;

  if (!pgPool) {
    pgPool = new Pool({
      connectionString: dbUrl,
      ssl: {
        rejectUnauthorized: false,
      },
      max: 10,
    });
  }
  return pgPool;
}

export function getSupabase(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return null;
  }

  if (!supabaseClient) {
    supabaseClient = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return supabaseClient;
}

/**
 * Generates a clean, unique slug from a business name.
 * e.g. "Chocolate Boutique" -> "chocolate-boutique-a82k"
 */
export function generateSlug(name: string): string {
  const cleaned = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const base = cleaned.length > 0 ? cleaned.slice(0, 40) : "business";
  const randomSuffix = Math.random().toString(36).substring(2, 6);
  return `${base}-${randomSuffix}`;
}

// Development storage path for local fallback if Supabase credentials are not yet set
const DEV_STORAGE_DIR = path.join(process.cwd(), ".next", "dev-data");
const DEV_STORAGE_FILE = path.join(DEV_STORAGE_DIR, "businesses.json");

function ensureDevStorage(): void {
  try {
    if (!fs.existsSync(DEV_STORAGE_DIR)) {
      fs.mkdirSync(DEV_STORAGE_DIR, { recursive: true });
    }
    if (!fs.existsSync(DEV_STORAGE_FILE)) {
      fs.writeFileSync(DEV_STORAGE_FILE, JSON.stringify([]), "utf-8");
    }
  } catch (e) {
    console.warn("Could not initialize local dev storage directory", e);
  }
}

function getLocalBusinesses(): BusinessConfig[] {
  try {
    ensureDevStorage();
    if (fs.existsSync(DEV_STORAGE_FILE)) {
      const data = fs.readFileSync(DEV_STORAGE_FILE, "utf-8");
      return JSON.parse(data) || [];
    }
  } catch (e) {
    console.warn("Error reading local dev businesses", e);
  }
  return [];
}

function saveLocalBusiness(business: BusinessConfig): void {
  try {
    ensureDevStorage();
    const list = getLocalBusinesses();
    const index = list.findIndex((b) => b.slug === business.slug);
    if (index >= 0) {
      list[index] = business;
    } else {
      list.push(business);
    }
    fs.writeFileSync(DEV_STORAGE_FILE, JSON.stringify(list, null, 2), "utf-8");
  } catch (e) {
    console.warn("Error saving local dev business", e);
  }
}

/**
 * Creates and stores a new business configuration.
 * Uses PostgreSQL/Supabase directly in production.
 */
export async function createBusiness(
  data: Omit<BusinessConfig, "id" | "created_at">
): Promise<BusinessConfig> {
  // 1. Direct PostgreSQL / Supabase connection
  const pool = getPgPool();
  if (pool) {
    try {
      const res = await pool.query(
        `insert into public.businesses (slug, name, maps_url, google_review_url, place_id)
         values ($1, $2, $3, $4, $5)
         returning id, slug, name, maps_url, google_review_url, place_id, created_at`,
        [
          data.slug,
          data.name,
          data.maps_url || null,
          data.google_review_url,
          data.place_id || null,
        ]
      );
      return res.rows[0] as BusinessConfig;
    } catch (pgErr) {
      console.error("Postgres insert error:", pgErr);
      throw new Error(`Database error: ${(pgErr as Error).message}`);
    }
  }

  // 2. Supabase REST Client
  const supabase = getSupabase();
  if (supabase) {
    const { data: inserted, error } = await supabase
      .from("businesses")
      .insert({
        slug: data.slug,
        name: data.name,
        maps_url: data.maps_url || null,
        google_review_url: data.google_review_url,
        place_id: data.place_id || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Supabase insert error:", error);
      throw new Error(`Database error: ${error.message}`);
    }

    return inserted as BusinessConfig;
  }

  // 3. Local development fallback
  console.warn(
    "⚠️ DATABASE_URL or SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY are not configured. Storing in local dev storage."
  );

  const newBusiness: BusinessConfig = {
    id: `dev-${Date.now()}`,
    slug: data.slug,
    name: data.name,
    maps_url: data.maps_url,
    google_review_url: data.google_review_url,
    place_id: data.place_id,
    created_at: new Date().toISOString(),
  };

  saveLocalBusiness(newBusiness);
  return newBusiness;
}

/**
 * Fetches a business configuration by its unique slug.
 */
export async function getBusinessBySlug(
  slug: string
): Promise<BusinessConfig | null> {
  // 1. Direct PostgreSQL / Supabase connection
  const pool = getPgPool();
  if (pool) {
    try {
      const res = await pool.query(
        `select id, slug, name, maps_url, google_review_url, place_id, created_at
         from public.businesses
         where slug = $1
         limit 1`,
        [slug]
      );
      return (res.rows[0] as BusinessConfig) || null;
    } catch (pgErr) {
      console.error("Postgres query error:", pgErr);
      throw new Error(`Database query error: ${(pgErr as Error).message}`);
    }
  }

  // 2. Supabase REST Client
  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase
      .from("businesses")
      .select("*")
      .eq("slug", slug)
      .single();

    if (error || !data) {
      return null;
    }

    return data as BusinessConfig;
  }

  // 3. Local development fallback
  const list = getLocalBusinesses();
  const found = list.find((b) => b.slug === slug);
  return found || null;
}

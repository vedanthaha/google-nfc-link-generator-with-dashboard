const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  try {
    console.log("Connecting to Supabase PostgreSQL database...");
    
    // Enable RLS
    await pool.query("ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;");
    console.log("✓ ROW LEVEL SECURITY enabled on public.businesses");

    // Drop existing policies if any
    await pool.query('DROP POLICY IF EXISTS "Allow public read access" ON public.businesses;');
    await pool.query('DROP POLICY IF EXISTS "Allow public insert" ON public.businesses;');
    await pool.query('DROP POLICY IF EXISTS "Deny public update" ON public.businesses;');
    await pool.query('DROP POLICY IF EXISTS "Deny public delete" ON public.businesses;');

    // 1. Allow public / anon read access (needed so customers can view business review pages)
    await pool.query(
      'CREATE POLICY "Allow public read access" ON public.businesses FOR SELECT USING (true);'
    );
    console.log("✓ Policy created: 'Allow public read access' (SELECT)");

    // 2. Allow public / anon insert access (needed so new businesses can be registered)
    await pool.query(
      'CREATE POLICY "Allow public insert" ON public.businesses FOR INSERT WITH CHECK (true);'
    );
    console.log("✓ Policy created: 'Allow public insert' (INSERT)");

    // Check status
    const statusRes = await pool.query(`
      SELECT tablename, rowsecurity
      FROM pg_tables
      WHERE schemaname = 'public' AND tablename = 'businesses';
    `);
    console.log("Table status:", statusRes.rows[0]);

    const policiesRes = await pool.query(`
      SELECT policyname, permissive, roles, cmd
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'businesses';
    `);
    console.log("Active policies:", policiesRes.rows);

    console.log("RLS setup completed successfully!");
  } catch (err) {
    console.error("Error setting up RLS:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();

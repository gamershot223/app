/*
# Create valuations and coefficients tables for local Supabase auth

## What this migration does
Replaces the platform-auth-based schema with Supabase-native tables that use
`auth.uid()` for row-level security. This makes the app work both locally and
when deployed, using Supabase Auth instead of Bolt's platform /auth endpoints.

## New Tables

### coefficients
- id (bigserial, primary key)
- user_id (uuid, NOT NULL, defaults to auth.uid() — the signed-in user)
- key (text, NOT NULL) — setting key, e.g. "age_rate" or "price:Kia Rio"
- value (numeric, NOT NULL) — the setting value
- updated_at (timestamptz, default now())
- UNIQUE(user_id, key)

### valuations
- id (bigserial, primary key)
- user_id (uuid, NOT NULL, defaults to auth.uid())
- brand, model, year, mileage, body_condition, interior_condition, accidents,
  rental_hours, region, trim — car parameters
- base_price, recommended_price, price_min, price_max (numeric) — pricing
- breakdown (jsonb, default '[]') — factor contribution details
- status (text, default 'draft') — one of draft/approved/purchased
- created_at (timestamptz, default now())
- Index on (user_id, created_at DESC)

## Security
- RLS enabled on both tables.
- GRANT CRUD to authenticated only (app requires sign-in).
- Owner-scoped policies: each authenticated user can only access rows where
  user_id = auth.uid().
- user_id defaults to auth.uid() so inserts that omit user_id still work.
*/

CREATE TABLE IF NOT EXISTS coefficients (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  key text NOT NULL,
  value numeric NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, key)
);
ALTER TABLE coefficients ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON coefficients TO authenticated;

DROP POLICY IF EXISTS "select_own_coefficients" ON coefficients;
CREATE POLICY "select_own_coefficients" ON coefficients
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_coefficients" ON coefficients;
CREATE POLICY "insert_own_coefficients" ON coefficients
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_coefficients" ON coefficients;
CREATE POLICY "update_own_coefficients" ON coefficients
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_coefficients" ON coefficients;
CREATE POLICY "delete_own_coefficients" ON coefficients
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS valuations (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  brand text NOT NULL,
  model text NOT NULL,
  year integer NOT NULL,
  mileage integer NOT NULL,
  body_condition integer NOT NULL,
  interior_condition integer NOT NULL,
  accidents integer NOT NULL DEFAULT 0,
  rental_hours integer NOT NULL DEFAULT 0,
  region text NOT NULL,
  trim text NOT NULL,
  base_price numeric NOT NULL,
  recommended_price numeric NOT NULL,
  price_min numeric NOT NULL,
  price_max numeric NOT NULL,
  breakdown jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS valuations_user_created_idx ON valuations (user_id, created_at DESC);
ALTER TABLE valuations ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON valuations TO authenticated;

DROP POLICY IF EXISTS "select_own_valuations" ON valuations;
CREATE POLICY "select_own_valuations" ON valuations
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_valuations" ON valuations;
CREATE POLICY "insert_own_valuations" ON valuations
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_valuations" ON valuations;
CREATE POLICY "update_own_valuations" ON valuations
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_valuations" ON valuations;
CREATE POLICY "delete_own_valuations" ON valuations
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

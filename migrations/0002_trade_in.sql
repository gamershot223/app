-- Оценки trade-in и персональные настройки модели (коэффициенты и базовые цены).
-- Всё привязано к сотруднику через user_id из токена платформенного входа.

CREATE TABLE IF NOT EXISTS coefficients (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL,
  key text NOT NULL,
  value numeric NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, key)
);
ALTER TABLE coefficients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS coefficients_owner_select ON coefficients;
CREATE POLICY coefficients_owner_select ON coefficients
  FOR SELECT
  USING (user_id::text = coalesce(current_setting('request.jwt.claims', true)::json->>'user_id', ''));

DROP POLICY IF EXISTS coefficients_owner_insert ON coefficients;
CREATE POLICY coefficients_owner_insert ON coefficients
  FOR INSERT
  WITH CHECK (
    user_id::text = coalesce(current_setting('request.jwt.claims', true)::json->>'user_id', '')
    AND length(key) BETWEEN 1 AND 100
    AND value BETWEEN -100000000 AND 100000000
  );

DROP POLICY IF EXISTS coefficients_owner_update ON coefficients;
CREATE POLICY coefficients_owner_update ON coefficients
  FOR UPDATE
  USING (user_id::text = coalesce(current_setting('request.jwt.claims', true)::json->>'user_id', ''))
  WITH CHECK (
    user_id::text = coalesce(current_setting('request.jwt.claims', true)::json->>'user_id', '')
    AND value BETWEEN -100000000 AND 100000000
  );
-- anon-update: coefficients (value, updated_at)

DROP POLICY IF EXISTS coefficients_owner_delete ON coefficients;
CREATE POLICY coefficients_owner_delete ON coefficients
  FOR DELETE
  USING (user_id::text = coalesce(current_setting('request.jwt.claims', true)::json->>'user_id', ''));

CREATE TABLE IF NOT EXISTS valuations (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL,
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

DROP POLICY IF EXISTS valuations_owner_select ON valuations;
CREATE POLICY valuations_owner_select ON valuations
  FOR SELECT
  USING (user_id::text = coalesce(current_setting('request.jwt.claims', true)::json->>'user_id', ''));

DROP POLICY IF EXISTS valuations_owner_insert ON valuations;
CREATE POLICY valuations_owner_insert ON valuations
  FOR INSERT
  WITH CHECK (
    user_id::text = coalesce(current_setting('request.jwt.claims', true)::json->>'user_id', '')
    AND length(brand) BETWEEN 1 AND 100
    AND length(model) BETWEEN 1 AND 100
    AND length(region) BETWEEN 1 AND 100
    AND length(trim) BETWEEN 1 AND 100
    AND year BETWEEN 1990 AND 2100
    AND mileage BETWEEN 0 AND 2000000
    AND body_condition BETWEEN 1 AND 5
    AND interior_condition BETWEEN 1 AND 5
    AND accidents BETWEEN 0 AND 20
    AND rental_hours BETWEEN 0 AND 200000
    AND status IN ('draft', 'approved', 'purchased')
    AND length(breakdown::text) <= 20000
  );

DROP POLICY IF EXISTS valuations_owner_update ON valuations;
CREATE POLICY valuations_owner_update ON valuations
  FOR UPDATE
  USING (user_id::text = coalesce(current_setting('request.jwt.claims', true)::json->>'user_id', ''))
  WITH CHECK (
    user_id::text = coalesce(current_setting('request.jwt.claims', true)::json->>'user_id', '')
    AND status IN ('draft', 'approved', 'purchased')
  );
-- anon-update: valuations (status)

DROP POLICY IF EXISTS valuations_owner_delete ON valuations;
CREATE POLICY valuations_owner_delete ON valuations
  FOR DELETE
  USING (user_id::text = coalesce(current_setting('request.jwt.claims', true)::json->>'user_id', ''));

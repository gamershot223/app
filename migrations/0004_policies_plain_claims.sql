-- Те же правила доступа, переписанные в простой форме: строка принадлежит владельцу из токена.
DROP POLICY IF EXISTS coefficients_owner_select ON coefficients;
CREATE POLICY coefficients_owner_select ON coefficients
  FOR SELECT
  USING (user_id::text = current_setting('request.jwt.claims', true)::json->>'user_id');

DROP POLICY IF EXISTS coefficients_owner_insert ON coefficients;
CREATE POLICY coefficients_owner_insert ON coefficients
  FOR INSERT
  WITH CHECK (
    user_id::text = current_setting('request.jwt.claims', true)::json->>'user_id'
    AND length(key) BETWEEN 1 AND 100
    AND value BETWEEN -100000000 AND 100000000
  );

DROP POLICY IF EXISTS coefficients_owner_update ON coefficients;
CREATE POLICY coefficients_owner_update ON coefficients
  FOR UPDATE
  USING (user_id::text = current_setting('request.jwt.claims', true)::json->>'user_id');
-- anon-update: coefficients (value, updated_at)

DROP POLICY IF EXISTS coefficients_owner_delete ON coefficients;
CREATE POLICY coefficients_owner_delete ON coefficients
  FOR DELETE
  USING (user_id::text = current_setting('request.jwt.claims', true)::json->>'user_id');

DROP POLICY IF EXISTS valuations_owner_select ON valuations;
CREATE POLICY valuations_owner_select ON valuations
  FOR SELECT
  USING (user_id::text = current_setting('request.jwt.claims', true)::json->>'user_id');

DROP POLICY IF EXISTS valuations_owner_insert ON valuations;
CREATE POLICY valuations_owner_insert ON valuations
  FOR INSERT
  WITH CHECK (
    user_id::text = current_setting('request.jwt.claims', true)::json->>'user_id'
    AND length(brand) BETWEEN 1 AND 100
    AND length(model) BETWEEN 1 AND 100
    AND length(region) BETWEEN 1 AND 100
    AND length("trim") BETWEEN 1 AND 100
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
  USING (user_id::text = current_setting('request.jwt.claims', true)::json->>'user_id');
-- anon-update: valuations (status)

DROP POLICY IF EXISTS valuations_owner_delete ON valuations;
CREATE POLICY valuations_owner_delete ON valuations
  FOR DELETE
  USING (user_id::text = current_setting('request.jwt.claims', true)::json->>'user_id');

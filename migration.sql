CREATE TABLE IF NOT EXISTS items (
  id bigserial PRIMARY KEY,
  name text NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE items FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS items_anon_insert ON items;
-- Политика — это и валидация входа. Публичная INSERT-политика ОБЯЗАНА
-- ограничивать длину текстовых полей: посетитель шлёт POST в PostgREST
-- напрямую, минуя нашу форму, поэтому проверка на клиенте не защищает ни от
-- чего — мегабайтная строка в заявке раздует тенантскую БД. Те же границы
-- продублируйте в UI, чтобы человек получил понятную ошибку, а не 400.
CREATE POLICY items_anon_insert ON items
  FOR INSERT
  WITH CHECK (
    length(name) BETWEEN 1 AND 100
    AND length(message) BETWEEN 1 AND 3000
  );

-- W19-1 reference: RPC функция для серверных вычислений (пример — не CRUD,
-- поэтому не через обычный select=). SECURITY INVOKER (по умолчанию, не
-- писать SECURITY DEFINER), STABLE — read-only, PostgREST сам разрешает GET.
-- search_path FROM CURRENT: preview = proj_*, prod publish = public
-- (SET search_path = public ломает CREATE FUNCTION LANGUAGE sql в preview).
-- workai-public-capability: {"v":1,"action":"grant","resource":{"kind":"function","schema":"tenant","name":"items_count","args":[],"mode":"read","writes":[]}}
CREATE OR REPLACE FUNCTION items_count()
RETURNS bigint
LANGUAGE sql
STABLE
SET search_path FROM CURRENT
AS $$
  SELECT count(*) FROM items;
$$;

-- W19-2: публичная проекция (без message). security_invoker = RLS вызывающего
-- (anon); без FOR SELECT policy view/aggregates вернут deny. Агрегаты
-- (sum/count) — через PostgREST ?select=…sum(), не через отдельный RPC.
CREATE OR REPLACE VIEW items_public
WITH (security_invoker = true)
AS
  SELECT id, name, created_at FROM items;

DROP POLICY IF EXISTS items_anon_select ON items;
CREATE POLICY items_anon_select ON items
  FOR SELECT
  USING (true);
-- UI: GET …/items_public (или items?select=id,name,created_at). Не строить
-- «админ-список» сырых заявок с message — для shop orders оставляйте только
-- INSERT policy (без FOR SELECT).

-- W19-3: заявка + уведомление владельцу в одной TX. Таблица _workai._outbox
-- уже создана платформой (не CREATE TABLE _outbox здесь). to/subject/body —
-- запрещены в payload (RLS WITH CHECK). Frontend: POST …/rpc/submit_item_notify
-- с JSON { "p_name": "…", "p_message": "…" }.
-- workai-public-capability: {"v":1,"action":"grant","resource":{"kind":"function","schema":"tenant","name":"submit_item_notify","args":[{"name":"p_name","type":"text"},{"name":"p_message","type":"text"}],"mode":"submission","writes":[{"schema":"tenant","relation":"items","operations":["insert"]}]}}
CREATE OR REPLACE FUNCTION submit_item_notify(p_name text, p_message text)
RETURNS bigint
LANGUAGE plpgsql
VOLATILE
SET search_path FROM CURRENT
AS $$
DECLARE
  new_id bigint;
BEGIN
  -- RPC идёт от имени вызывающего, значит попадает под ту же политику
  -- items_anon_insert. Проверяем сами, чтобы фронт получил внятный текст,
  -- а не «42501 row-level security policy».
  IF length(p_name) NOT BETWEEN 1 AND 100
     OR length(p_message) NOT BETWEEN 1 AND 3000 THEN
    RAISE EXCEPTION 'name 1..100, message 1..3000 символов';
  END IF;
  INSERT INTO items (name, message) VALUES (p_name, p_message)
  RETURNING id INTO new_id;
  INSERT INTO _workai._outbox (action_type, payload)
  VALUES (
    'send_email',
    jsonb_build_object(
      'template_id', 'lead_notification',
      'vars', jsonb_build_object(
        'name', p_name,
        'message', p_message,
        'item_id', new_id
      )
    )
  );
  RETURN new_id;
END;
$$;

-- W19-3b reference: outbound webhook (Slack/Zapier/CRM) instead of email —
-- the target URL is NEVER in the payload (RLS rejects url/target_url/host/
-- headers keys). It resolves server-side from a project secret the human
-- owner sets afterwards, named WEBHOOK_URL_<webhook_key>. Uncomment/adapt
-- only if the product actually needs an outbound webhook:
-- INSERT INTO _workai._outbox (action_type, payload)
-- VALUES (
--   'call_webhook',
--   jsonb_build_object(
--     'webhook_key', 'order_placed',
--     'vars', jsonb_build_object('order_id', new_id)
--   )
-- );

-- W23 reference: уведомление в Telegram вместо письма — когда владелец хочет
-- видеть заявки в чате, а не в почте. Правила те же, что у вебхука: ни токена
-- бота, ни chat_id в payload быть не может (RLS отклонит ключи token/
-- bot_token/chat_id), их владелец задаёт секретами проекта
-- TELEGRAM_BOT_TOKEN_<telegram_key> и TELEGRAM_CHAT_ID_<telegram_key>.
-- Ключ 'text' тоже запрещён: текст сообщения собирает платформа из vars с
-- экранированием, иначе строка из БД уехала бы в Telegram как HTML-разметка.
-- INSERT INTO _workai._outbox (action_type, payload)
-- VALUES (
--   'send_telegram',
--   jsonb_build_object(
--     'telegram_key', 'new_lead',
--     'vars', jsonb_build_object('name', p_name, 'message', p_message)
--   )
-- );

-- W20: user-scoped notes (JWT claim user_id; platform /auth issues token).
CREATE TABLE IF NOT EXISTS notes (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notes_owner_select ON notes;
CREATE POLICY notes_owner_select ON notes
  FOR SELECT
  USING (
    user_id::text = coalesce(
      current_setting('request.jwt.claims', true)::json->>'user_id',
      ''
    )
  );
DROP POLICY IF EXISTS notes_owner_insert ON notes;
-- Границы длин нужны и здесь: пишет залогиненный пользователь, но токен есть
-- у любого, кто прошёл signup, а тело запроса он формирует сам.
CREATE POLICY notes_owner_insert ON notes
  FOR INSERT
  WITH CHECK (
    user_id::text = current_setting('request.jwt.claims', true)::json->>'user_id'
    AND length(body) BETWEEN 1 AND 5000
  );

-- W21-3 reference: роль конечного пользователя. Роль хранит платформа
-- (app_users.role) и кладёт в клейм app_role. Назначает роль владелец проекта
-- сам, в кабинете проекта, раздел «Пользователи сайта» (под капотом API платформы
-- PATCH projects/:id/app-users/:appUserId/role), поэтому до первого назначения все
-- аккаунты остаются 'member': роль-зависимый экран обязан осмысленно выглядеть и для
-- него. Клейм называется app_role, а НЕ role: имя role PostgREST понимает как
-- команду переключить роль БД.
-- Раскомментируйте, если продукту нужен персонал, видящий чужие записи:
-- политика ДОБАВЛЯЕТСЯ рядом с notes_owner_select, а не заменяет её, потому что
-- permissive-политики складываются по OR — получается «своё ИЛИ staff».
--
-- Роль фильтрует строки и не даёт никаких привилегий БД: SET ROLE / GRANT по
-- app_role невозможны и не нужны. И не пишите вместо этого
-- FOR ALL USING (…) WITH CHECK (true) — такая политика отдаёт staff право
-- переписать чужую строку под себя.
-- DROP POLICY IF EXISTS notes_staff_select ON notes;
-- CREATE POLICY notes_staff_select ON notes
--   FOR SELECT
--   USING (
--     current_setting('request.jwt.claims', true)::json->>'app_role' = 'staff'
--   );

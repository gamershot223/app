-- Демо-таблица items из каркаса не используется приложением: закрываем её чтение.
DROP POLICY IF EXISTS items_anon_select ON items;

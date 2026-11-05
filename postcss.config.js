/**
 * ⚠️ ОХРАНКА (инсайт №8).
 *
 * Vite сам находит этот файл в корне проекта и применяет его ко ВСЕМУ
 * импортированному CSS — дублировать те же плагины через `css.postcss` в
 * vite.config.ts НЕЛЬЗЯ: inline-конфиг там ОТМЕНЯЕТ этот файл целиком, и
 * Tailwind тихо перестанет обрабатываться (белые стили на публикации).
 *
 * Плагин ровно один. С Tailwind 4 он переехал в отдельный пакет
 * `@tailwindcss/postcss`, а `autoprefixer` и `postcss-import` УДАЛЕНЫ
 * осознанно — дока v4: «imports and vendor prefixing are now handled
 * automatically, allowing for the removal of dependencies like postcss-import
 * and autoprefixer». Вернёте autoprefixer «на всякий случай» — получите
 * второй проход по всему CSS каждого пользовательского проекта и двойные
 * префиксы.
 *
 * Vite-плагин `@tailwindcss/vite` сознательно НЕ используется, хотя дока
 * называет его предпочтительным для Vite: `vite.config.ts` у нас рендерит
 * платформа (`builder-web-vite-config.ts`) и раскладывает по всем шаблонам,
 * поэтому подключение Tailwind туда развело бы источник правды по двум местам
 * и вступило бы в прямое противоречие с охранкой того файла. Здесь дельта
 * меньше и не трогает платформенный генератор.
 *
 * Файл байт в байт одинаков во ВСЕХ веб-шаблонах (тест
 * `builder-web-template-configs-identical.spec.ts`). Поправил один — прогони
 * `node scripts/sync-template-configs.js`.
 */
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};

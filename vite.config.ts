// WORKAI:GENERATED-VITE-CONFIG — сгенерирован платформой WorkAI при публикации.
// Источник: src/modules/builder/services/builder-web-vite-config.ts
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * ⚠️ ОХРАНКА (инсайт №8). Прочитай до того, как что-то здесь править.
 *
 * 1. ЭТОТ ФАЙЛ РЕНДЕРИТ ПЛАТФОРМА. Он собирается на сервере
 *    (`builder-web-vite-config.ts`): при публикации его кладёт
 *    `ensureViteConfig` рядом с `ensureDockerfile`, в превью — раннер
 *    (`writeWorkaiViteConfig`). Правка сборки — это правка платформы, а не
 *    одного проекта: она доезжает до ВСЕХ проектов деплоем сервера.
 *
 * 2. НЕ ДОБАВЛЯЙ сюда плагины «на всякий случай». `react()` уже подключён —
 *    второй `@vitejs/plugin-react` в списке ломает сборку дублем Fast Refresh.
 *    Tailwind/autoprefixer подключать здесь тоже не надо: Vite сам
 *    подхватывает `postcss.config.js` из корня проекта (Vite 5, CSS → PostCSS),
 *    а инлайновый `css.postcss` этот файл ОТМЕНЯЕТ — Tailwind тихо перестанет
 *    обрабатываться. И НЕ УБИРАЙ `resolve.dedupe` — это гарантия одной копии
 *    React на весь граф; без неё транзитивная зависимость со своим React даёт
 *    «Cannot read properties of null (reading 'useState')» прямо в кадре.
 *
 * 3. Правки без маркера `WORKAI:GENERATED-VITE-CONFIG` в первой строке
 *    публикация считает осознанными и НЕ перетирает — но в превью их всё равно
 *    не видно: раннер пишет свой конфиг (ему нужны `base` и HMR через
 *    preview-proxy). Отсюда старая ловушка «в превью работало, на публикации
 *    сломалось». Не заводи её заново.
 */

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
    dedupe: ['react', 'react-dom'],
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    hmr: {
      protocol: "ws",
      host: "localhost",
      clientPort: 3000,
    },
  },
});

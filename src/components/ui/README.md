# src/components/ui — готовые компоненты

Библиотека shadcn/ui (MIT), адаптированная под наш стек: **React 19, Tailwind 4,
токены шаблона**. Компоненты уже лежат в проекте — **писать свои диалоги,
дропдауны, таблицы и поля формы с нуля не нужно**, импортируй отсюда.

Примитивы здесь — нового поколения апстрима: обычные функции без
`React.forwardRef` (в React 19 `ref` — обычный проп и приезжает вместе со
спредом), типы через `React.ComponentProps<…>`, и у каждой части своя пометка
`data-slot="<имя>"`. По ней можно стилизовать вложенные части снаружи, не
трогая сам файл: `[&_[data-slot=card-title]]:text-2xl`.

## Правила

1. Импорт — `@/components/ui/button` **или** относительным путём
   `./components/ui/button`: работают оба. Алиас `@` → `src` WorkAI прописывает
   сам, в `vite.config.ts` и `tsconfig.json`, и в превью, и при публикации.
   Другие корни (`~/`, `@components/`) не заводить — их никто не рендерит.
2. Цвета — только токены (`bg-primary`, `text-foreground`, `border-border`,
   поверхность карточек). Ни одного литерального цвета в этих файлах нет и быть
   не должно: quality-гейт `no_inline_hex` / `no_inline_rgb_in_tsx` — критический.
3. Роль важнее похожести. Поля ввода — `border-input`, кольцо фокуса —
   `ring-ring`, приглушённый текст — `text-muted-foreground` (а не
   `text-foreground/60` прозрачностью поверх чего попало), ошибки —
   `bg-destructive` / `text-destructive`, всплывающие слои — `bg-popover
   text-popover-foreground`. В светлой теме часть этих токенов совпадает по
   значению с соседями, в тёмной — нет.
4. Надпись поверх заливки — два РАЗНЫХ токена, не путай их:
   `text-primary-foreground` лежит на `bg-primary` (кнопка, бейдж, выбранный
   день календаря), `text-background` — на инвертированной поверхности (тултип
   с `bg-foreground`). В светлой теме они совпадают по значению, в тёмной — нет,
   и подмена красит надпись в цвет подложки.
5. Перекрасить тему — значит поменять ТОКЕНЫ в `src/index.css`, а не классы в
   этих файлах. `tailwind.config.js` больше нет: в Tailwind 4 вся тема живёт в
   CSS, в блоке `@theme inline`. Там же переопределена шкала радиусов — поэтому
   `rounded-sm` в этих компонентах означает радиус СИСТЕМЫ, а не стоковые 2px;
   менять его на `rounded-xs` нельзя, вид поедет.
6. Компоненты можно править под задачу — это твой код, а не пакет из node_modules.
7. Установка новых пакетов ради UI почти всегда лишняя: см. список ниже.

## Что есть — 46 компонентов

**Формы и ввод:** button, checkbox, form, input, input-otp, label, radio-group,
select, slider, switch, textarea, toggle, toggle-group.

**Оверлеи:** alert-dialog, command (палитра команд), context-menu, dialog,
drawer, dropdown-menu, hover-card, popover, sheet, tooltip.

**Навигация:** breadcrumb, menubar, navigation-menu, pagination, sidebar, tabs.

**Вывод данных:** accordion, alert, aspect-ratio, avatar, badge, calendar, card,
carousel, chart (графики на recharts), collapsible, progress, resizable,
scroll-area, separator, skeleton, sonner (тосты), table.

Рядом: `../../lib/utils` — `cn()` для склейки классов; `../../hooks/use-mobile` —
`useIsMobile()`, её использует sidebar.

## Как устроены самые крупные

- **sidebar** — три файла: `sidebar.tsx` (каркас: `Sidebar`, `SidebarTrigger`,
  `SidebarInset`, `SidebarHeader/Content/Footer`), `sidebar-context.tsx`
  (`SidebarProvider`, `useSidebar`, ширины), `sidebar-menu.tsx` (`SidebarMenu*`,
  `SidebarGroup*`). Импортировать всё можно из `./sidebar` — он реэкспортирует
  остальные два. Приложение оберни в `<SidebarProvider>`.
- **chart** — обёртка над recharts. Цвета серий задаются в `config` и
  раздаются как CSS-переменные `--color-<ключ>`:

  ```tsx
  const config = { revenue: { label: 'Выручка', color: 'var(--chart-1)' } };

  <ChartContainer config={config}>
    <BarChart data={data}>
      <Bar dataKey="revenue" fill="var(--color-revenue)" />
      <ChartTooltip />
    </BarChart>
  </ChartContainer>;
  ```

  Цвет — ГОТОВОЕ значение токена: `var(--chart-1)`, `var(--accent)`. Обёртка
  `hsl(...)` осталась в Tailwind 3, где токен хранил голую HSL-тройку; сейчас в
  `index.css` лежат `oklch(...)`, и `hsl(var(--chart-1))` дало бы невалидное
  значение — правило молча выпало бы, а серия осталась без цвета. Для серий
  заведены `--chart-1`…`--chart-5`. Свои hex/rgb в графиках запрещены ровно так
  же, как везде.

## Чего нет

Всё, что есть у shadcn/ui, уже лежит здесь. Если нужен контрол, которого нет в
списке выше, — собери его из имеющихся примитивов (`dialog`, `popover`,
`dropdown-menu`, `command`), а не ставь новый пакет: превью поднимается только
на зависимостях из allowlist.

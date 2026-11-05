// Готовый компонент проекта (shadcn/ui, MIT), адаптированный под React 19 +
// Tailwind 4 и токены этого шаблона. Не переписывай его с нуля — импортируй.
// Цвета только токенами: см. src/components/ui/README.md.
import * as React from 'react';
import * as RechartsPrimitive from 'recharts';
import { cn } from '../../lib/utils';

/**
 * Обёртка над recharts: контейнер задаёт размер и раздаёт цвета серий через
 * CSS-переменные `--color-<ключ>`, чтобы в самих графиках не было ни одного
 * литерального цвета.
 *
 *   const config = {
 *     revenue: { label: 'Выручка', color: 'var(--chart-1)' },
 *     orders: { label: 'Заказы', color: 'var(--chart-2)' },
 *   } satisfies ChartConfig;
 *
 *   <ChartContainer config={config}>
 *     <BarChart data={data}>
 *       <Bar dataKey="revenue" fill="var(--color-revenue)" />
 *       <ChartTooltip />
 *     </BarChart>
 *   </ChartContainer>
 *
 * ВАЖНО про формат цвета. В `config.color` кладётся ГОТОВЫЙ цвет — то есть
 * `var(--chart-1)`, а не `hsl(var(--chart-1))`. В Tailwind 3 токен хранил голую
 * HSL-тройку и обёртка `hsl()` была обязательна; с переходом на Tailwind 4
 * токены в `index.css` стали значениями `oklch(...)`, и та же обёртка дала бы
 * `hsl(oklch(...))` — невалидное значение. Браузер молча выбросил бы правило,
 * а серия осталась бы без цвета. Серии графиков живут в `--chart-1..5`.
 *
 * Своих hex/rgb здесь быть не должно — критический гейт no_inline_hex.
 */
export type ChartConfig = Record<
  string,
  { label?: React.ReactNode; icon?: React.ComponentType; color?: string }
>;

/** Одна строка легенды/тултипа. Типы recharts 2 и 3 несовместимы — держим свой. */
type ChartPayloadItem = {
  dataKey?: string | number;
  name?: string | number;
  value?: string | number;
  color?: string;
  payload?: Record<string, unknown>;
};

const ChartContext = React.createContext<ChartConfig>({});

function useChartConfig() {
  return React.useContext(ChartContext);
}

function labelFor(config: ChartConfig, item: ChartPayloadItem): React.ReactNode {
  const key = String(item.dataKey ?? item.name ?? '');
  return config[key]?.label ?? item.name ?? key;
}

function ChartContainer({
  config,
  className,
  children,
  style,
  ...props
}: React.ComponentProps<'div'> & {
  config: ChartConfig;
  children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>['children'];
}) {
  const vars = React.useMemo(() => {
    const out: Record<string, string> = {};
    for (const [key, item] of Object.entries(config)) {
      if (item.color) out['--color-' + key] = item.color;
    }
    return out;
  }, [config]);

  return (
    <ChartContext.Provider value={config}>
      <div
        data-slot="chart"
        className={cn('flex aspect-video w-full justify-center text-xs', className)}
        style={{ ...vars, ...style } as React.CSSProperties}
        {...props}
      >
        <RechartsPrimitive.ResponsiveContainer>{children}</RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

type TooltipProps = React.ComponentProps<typeof RechartsPrimitive.Tooltip>;
type LegendProps = React.ComponentProps<typeof RechartsPrimitive.Legend>;

function ChartTooltipContent({
  active,
  payload,
  label,
  hideLabel,
  className,
}: {
  active?: boolean;
  payload?: ChartPayloadItem[];
  label?: React.ReactNode;
  hideLabel?: boolean;
  className?: string;
}) {
  const config = useChartConfig();
  if (!active || !payload?.length) return null;
  return (
    <div
      data-slot="chart-tooltip-content"
      className={cn(
        'grid min-w-[8rem] gap-1.5 rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-lg',
        className,
      )}
    >
      {!hideLabel && label != null ? <div className="font-medium">{label}</div> : null}
      {payload.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <span
            data-slot="chart-tooltip-indicator"
            className="size-2.5 shrink-0 rounded-sm bg-primary"
            style={item.color ? { backgroundColor: item.color } : undefined}
          />
          <span className="text-muted-foreground">{labelFor(config, item)}</span>
          <span className="ml-auto font-mono font-medium">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

function ChartLegendContent({
  payload,
  className,
}: {
  payload?: ChartPayloadItem[];
  className?: string;
}) {
  const config = useChartConfig();
  if (!payload?.length) return null;
  return (
    <div
      data-slot="chart-legend-content"
      className={cn('flex flex-wrap items-center justify-center gap-4 pt-3', className)}
    >
      {payload.map((item, i) => (
        <div key={i} className="flex items-center gap-1.5 text-xs">
          <span
            data-slot="chart-legend-indicator"
            className="size-2.5 shrink-0 rounded-sm bg-primary"
            style={item.color ? { backgroundColor: item.color } : undefined}
          />
          {labelFor(config, item)}
        </div>
      ))}
    </div>
  );
}

/**
 * `as unknown as` — сознательно: типы `content` у recharts 2 и 3 разные и
 * несовместимые между собой, а рантайм-контракт (active/payload/label) один и
 * тот же. Приведение здесь держит компонент рабочим на обеих мажорных версиях.
 */
function ChartTooltip({
  content,
  ...props
}: Omit<TooltipProps, 'content'> & { content?: React.ReactElement }) {
  return (
    <RechartsPrimitive.Tooltip
      cursor={false}
      content={(content ?? <ChartTooltipContent />) as unknown as TooltipProps['content']}
      {...props}
    />
  );
}

// `ref` из props выкидываем: recharts объявляет его прямо в Props легенды, и
// после спреда TS сводит его к типу элемента, а не самого компонента.
function ChartLegend({
  content,
  ...props
}: Omit<LegendProps, 'content' | 'ref'> & { content?: React.ReactElement }) {
  return (
    <RechartsPrimitive.Legend
      content={(content ?? <ChartLegendContent />) as unknown as LegendProps['content']}
      {...props}
    />
  );
}

export { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent };

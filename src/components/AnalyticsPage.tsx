import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from './ui/chart';
import { fetchValuations, type ValuationRow } from '../lib/store';
import { rub } from '../lib/pricing';
import { userErrorText } from '../lib/api-error';
import { cardCls } from '../lib/ui-classes';

const brandCfg = { avg: { label: 'Средняя цена, тыс. ₽', color: 'var(--chart-1)' } } satisfies ChartConfig;
const trendCfg = { count: { label: 'Оценок', color: 'var(--chart-2)' } } satisfies ChartConfig;
const condCfg = { count: { label: 'Оценок', color: 'var(--chart-3)' } } satisfies ChartConfig;

export function AnalyticsPage() {
  const [rows, setRows] = useState<ValuationRow[] | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    fetchValuations()
      .then(setRows)
      .catch((e) => {
        setErr(userErrorText(e, 'Не удалось загрузить данные.'));
        setRows([]);
      });
  }, []);

  const data = useMemo(() => {
    const list = rows ?? [];
    const byBrand = new Map<string, { sum: number; n: number }>();
    const byDay = new Map<string, number>();
    const byCond = new Map<string, number>();
    for (const r of list) {
      const b = byBrand.get(r.brand) ?? { sum: 0, n: 0 };
      b.sum += r.recommended_price;
      b.n += 1;
      byBrand.set(r.brand, b);
      const day = r.created_at.slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + 1);
      const c = Math.round((r.body_condition + r.interior_condition) / 2);
      byCond.set(String(c), (byCond.get(String(c)) ?? 0) + 1);
    }
    return {
      brand: [...byBrand].map(([name, v]) => ({ name, avg: Math.round(v.sum / v.n / 1000) })),
      trend: [...byDay].sort(([a], [b]) => a.localeCompare(b)).map(([d, count]) => ({ name: d.slice(5).split('-').reverse().join('.'), count })),
      cond: ['1', '2', '3', '4', '5'].map((c) => ({ name: `${c} балл.`, count: byCond.get(c) ?? 0 })),
      total: list.length,
      avg: list.length ? list.reduce((s, r) => s + r.recommended_price, 0) / list.length : 0,
    };
  }, [rows]);

  if (rows === null) return <p className="text-muted-foreground">Загружаю…</p>;

  return (
    <div data-section="analytics" className="space-y-6">
      <div>
        <h1 className="text-display font-display font-semibold">Аналитика оценок</h1>
        <p className="mt-2 text-muted-foreground">
          Всего оценок: {data.total}{data.total ? ` · средняя цена ${rub(data.avg)}` : ''}
        </p>
      </div>
      {err ? <p className="text-sm text-destructive" role="alert">{err}</p> : null}
      {data.total === 0 ? (
        <div className={`${cardCls} text-muted-foreground`}>Пока нет данных. Сохраните несколько оценок в калькуляторе — графики появятся здесь.</div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className={cardCls}>
            <h2 className="mb-3 font-display text-lg font-semibold">Средняя цена по маркам</h2>
            <ChartContainer config={brandCfg} className="aspect-[4/3]">
              <BarChart data={data.brand}>
                <CartesianGrid vertical={false} strokeOpacity={0.3} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} width={48} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="avg" fill="var(--color-avg)" radius={6} />
              </BarChart>
            </ChartContainer>
          </section>
          <section className={cardCls}>
            <h2 className="mb-3 font-display text-lg font-semibold">Динамика оценок по дням</h2>
            <ChartContainer config={trendCfg} className="aspect-[4/3]">
              <LineChart data={data.trend}>
                <CartesianGrid vertical={false} strokeOpacity={0.3} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={32} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line dataKey="count" stroke="var(--color-count)" strokeWidth={2} dot />
              </LineChart>
            </ChartContainer>
          </section>
          <section className={`${cardCls} lg:col-span-2`}>
            <h2 className="mb-3 font-display text-lg font-semibold">Распределение по состоянию (средний балл кузова и салона)</h2>
            <ChartContainer config={condCfg} className="aspect-[16/6] min-h-48">
              <BarChart data={data.cond}>
                <CartesianGrid vertical={false} strokeOpacity={0.3} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={32} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--color-count)" radius={6} />
              </BarChart>
            </ChartContainer>
          </section>
        </div>
      )}
    </div>
  );
}

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calculator, Save } from 'lucide-react';
import { CAR_MODELS, CURRENT_YEAR, REGIONS, TRIMS } from '../content/model';
import { calculate, rub, type CarInput } from '../lib/pricing';
import { createValuation } from '../lib/store';
import { useSettings } from '../hooks/use-settings';
import { userErrorText } from '../lib/api-error';
import type { AuthUser } from '../lib/auth';
import { btnPrimary, cardCls, fieldCls } from '../lib/ui-classes';

const initial: CarInput = {
  brand: CAR_MODELS[0].brand,
  model: CAR_MODELS[0].model,
  year: 2023,
  mileage: 85000,
  bodyCondition: 4,
  interiorCondition: 3,
  accidents: 0,
  rentalHours: 1800,
  region: REGIONS[0],
  trim: TRIMS[1],
};

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}

export function CalculatorPage({ user }: { user: AuthUser | null }) {
  const { overrides, loading } = useSettings();
  const [car, setCar] = useState<CarInput>(initial);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle');
  const [err, setErr] = useState('');

  const result = useMemo(() => calculate(car, overrides), [car, overrides]);
  const set = <K extends keyof CarInput>(k: K, v: CarInput[K]) => {
    setCar((c) => ({ ...c, [k]: v }));
    setSaveState('idle');
  };
  const num = (v: string) => (v === '' ? 0 : Number(v));
  const maxAbs = Math.max(...result.breakdown.map((b) => Math.abs(b.delta)), 1);

  async function save() {
    if (!user) return;
    setSaveState('saving');
    setErr('');
    try {
      await createValuation({
        user_id: user.id,
        brand: car.brand,
        model: car.model,
        year: car.year,
        mileage: car.mileage,
        body_condition: car.bodyCondition,
        interior_condition: car.interiorCondition,
        accidents: car.accidents,
        rental_hours: car.rentalHours,
        region: car.region,
        trim: car.trim,
        base_price: result.basePrice,
        recommended_price: result.price,
        price_min: result.min,
        price_max: result.max,
        breakdown: result.breakdown,
      });
      setSaveState('ok');
    } catch (e) {
      setSaveState('error');
      setErr(userErrorText(e, 'Не удалось сохранить оценку.'));
    }
  }

  const modelValue = `${car.brand}|${car.model}`;

  return (
    <div data-section="calculator" className="space-y-6">
      <div>
        <h1 className="text-display font-display font-semibold">Оценка trade-in</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Введите данные автомобиля из автопарка — цена и вклад каждого фактора пересчитываются сразу.
          {loading || !user ? '' : Object.keys(overrides).length ? ' Используются ваши настройки модели.' : ' Используются коэффициенты по умолчанию.'}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <form className={`${cardCls} grid gap-4 sm:grid-cols-2`} onSubmit={(e) => e.preventDefault()}>
          <div className="sm:col-span-2">
            <Field id="car-model" label="Марка и модель">
              <select
                id="car-model"
                className={fieldCls}
                value={modelValue}
                onChange={(e) => {
                  const [brand, model] = e.target.value.split('|');
                  setCar((c) => ({ ...c, brand, model }));
                  setSaveState('idle');
                }}
              >
                {CAR_MODELS.map((m) => (
                  <option key={m.brand + m.model} value={`${m.brand}|${m.model}`}>{m.brand} {m.model}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field id="car-year" label="Год выпуска">
            <input id="car-year" type="number" min={2010} max={CURRENT_YEAR} className={fieldCls} value={car.year} onChange={(e) => set('year', Math.min(CURRENT_YEAR, Math.max(2010, num(e.target.value))))} />
          </Field>
          <Field id="car-mileage" label="Пробег, км">
            <input id="car-mileage" type="number" min={0} max={1000000} step={1000} className={fieldCls} value={car.mileage} onChange={(e) => set('mileage', Math.min(1000000, num(e.target.value)))} />
          </Field>
          <Field id="car-body" label="Состояние кузова (1–5)">
            <select id="car-body" className={fieldCls} value={car.bodyCondition} onChange={(e) => set('bodyCondition', Number(e.target.value))}>
              {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </Field>
          <Field id="car-interior" label="Состояние салона (1–5)">
            <select id="car-interior" className={fieldCls} value={car.interiorCondition} onChange={(e) => set('interiorCondition', Number(e.target.value))}>
              {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </Field>
          <Field id="car-accidents" label="Число ДТП">
            <input id="car-accidents" type="number" min={0} max={20} className={fieldCls} value={car.accidents} onChange={(e) => set('accidents', Math.min(20, num(e.target.value)))} />
          </Field>
          <Field id="car-hours" label="Часов аренды в каршеринге">
            <input id="car-hours" type="number" min={0} max={100000} step={100} className={fieldCls} value={car.rentalHours} onChange={(e) => set('rentalHours', Math.min(100000, num(e.target.value)))} />
          </Field>
          <Field id="car-region" label="Регион">
            <select id="car-region" className={fieldCls} value={car.region} onChange={(e) => set('region', e.target.value)}>
              {REGIONS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </Field>
          <Field id="car-trim" label="Комплектация">
            <select id="car-trim" className={fieldCls} value={car.trim} onChange={(e) => set('trim', e.target.value)}>
              {TRIMS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </Field>
          <div className="flex items-center gap-2 text-sm text-muted-foreground sm:col-span-2">
            <Calculator className="size-4" aria-hidden="true" />
            Расчёт обновляется сразу при изменении любого поля.
          </div>
        </form>

        <section id="valuation-result" className={`${cardCls} space-y-5`} aria-live="polite">
          <div>
            <p className="text-sm text-muted-foreground">Рекомендованная цена trade-in</p>
            <p className="mt-1 font-display text-4xl font-semibold md:text-5xl" data-testid="price">{rub(result.price)}</p>
            <p className="mt-1 text-sm text-muted-foreground">Диапазон: {rub(result.min)} — {rub(result.max)}</p>
            <p className="text-sm text-muted-foreground">Базовая рыночная цена модели: {rub(result.basePrice)}</p>
          </div>
          <ul className="space-y-3">
            {result.breakdown.map((b) => (
              <li key={b.key} className="space-y-1">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span>{b.label} <span className="text-muted-foreground">×{b.factor.toFixed(3)}</span></span>
                  <span className={`font-mono whitespace-nowrap ${b.delta < 0 ? 'text-destructive' : 'text-foreground'}`}>
                    {b.delta > 0 ? '+' : ''}{rub(b.delta)}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${b.delta < 0 ? 'bg-destructive' : 'bg-chart-3'}`}
                    style={{ width: `${Math.max(2, (Math.abs(b.delta) / maxAbs) * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
          {user ? (
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => void save()} disabled={saveState === 'saving'} className={btnPrimary}>
                <Save className="size-4" aria-hidden="true" />
                {saveState === 'saving' ? 'Сохраняю…' : 'Сохранить оценку'}
              </button>
              {saveState === 'ok' ? <p id="save-success" className="text-sm text-chart-3" role="status">Оценка сохранена в историю</p> : null}
              {saveState === 'error' ? <p className="text-sm text-destructive" role="alert">{err}</p> : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Чтобы сохранять оценки и видеть историю, <Link to="/login" className="text-accent underline">войдите как сотрудник</Link>.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

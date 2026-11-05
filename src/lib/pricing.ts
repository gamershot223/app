import { CURRENT_YEAR, defaultSettings, modelKey } from '../content/model';

export type CarInput = {
  brand: string;
  model: string;
  year: number;
  mileage: number;
  bodyCondition: number;
  interiorCondition: number;
  accidents: number;
  rentalHours: number;
  region: string;
  trim: string;
};

export type Contribution = { key: string; label: string; factor: number; delta: number };
export type PriceResult = {
  basePrice: number;
  price: number;
  min: number;
  max: number;
  breakdown: Contribution[];
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function seasonKey(month: number): string {
  if (month === 11 || month <= 1) return 'season:winter';
  if (month <= 4) return 'season:spring';
  if (month <= 7) return 'season:summer';
  return 'season:autumn';
}

/**
 * Прозрачная формульная модель: цена последовательно умножается на коэффициенты,
 * вклад фактора — разница цены до и после него, поэтому вклады в сумме дают итог.
 */
export function calculate(
  car: CarInput,
  overrides: Record<string, number>,
  month: number = new Date().getMonth(),
): PriceResult {
  const s = { ...defaultSettings(), ...overrides };
  const base = s[modelKey(car)] ?? 0;
  const age = Math.max(0, CURRENT_YEAR - car.year);
  const avgCond = (car.bodyCondition + car.interiorCondition) / 2;

  const steps: { key: string; label: string; factor: number }[] = [
    { key: 'age', label: `Возраст (${age} г.)`, factor: clamp(Math.pow(1 - s.age_rate, age), 0.2, 1) },
    { key: 'mileage', label: `Пробег (${car.mileage.toLocaleString('ru-RU')} км)`, factor: clamp(1 - (s.mileage_rate * car.mileage) / 10000, 0.5, 1) },
    { key: 'condition', label: 'Состояние кузова и салона', factor: clamp(1 - s.condition_rate * (5 - avgCond), 0.6, 1) },
    { key: 'intensity', label: `Эксплуатация в каршеринге (${car.rentalHours.toLocaleString('ru-RU')} ч)`, factor: clamp(1 - (s.intensity_rate * car.rentalHours) / 1000, 0.6, 1) },
    { key: 'accidents', label: `ДТП (${car.accidents})`, factor: clamp(1 - s.accident_rate * car.accidents, 0.5, 1) },
    { key: 'trim', label: `Комплектация «${car.trim}»`, factor: s[`trim:${car.trim}`] ?? 1 },
    { key: 'region', label: `Регион: ${car.region}`, factor: s[`region:${car.region}`] ?? 1 },
    { key: 'season', label: 'Сезонность', factor: s[seasonKey(month)] ?? 1 },
  ];

  let price = base;
  const breakdown: Contribution[] = steps.map((st) => {
    const next = price * st.factor;
    const delta = next - price;
    price = next;
    return { ...st, delta: Math.round(delta) };
  });
  const rounded = Math.round(price / 1000) * 1000;
  const range = s.range_pct;
  return {
    basePrice: base,
    price: rounded,
    min: Math.round((price * (1 - range)) / 1000) * 1000,
    max: Math.round((price * (1 + range)) / 1000) * 1000,
    breakdown,
  };
}

export const rub = (n: number) => `${Math.round(n).toLocaleString('ru-RU')} ₽`;

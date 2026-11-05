/** Справочники и параметры по умолчанию для модели trade-in. Все цифры — демонстрационные. */

export type ParamDef = {
  key: string;
  label: string;
  hint: string;
  def: number;
  step: number;
  group: 'weights' | 'regions' | 'trims' | 'season';
  suffix?: string;
};

export const CURRENT_YEAR = 2026;

export const STATUSES = [
  { id: 'draft', label: 'Черновик' },
  { id: 'approved', label: 'Согласовано' },
  { id: 'purchased', label: 'Выкуплено' },
] as const;
export type StatusId = (typeof STATUSES)[number]['id'];

export const CAR_MODELS: { brand: string; model: string; price: number }[] = [
  { brand: 'Kia', model: 'Rio', price: 1_650_000 },
  { brand: 'Hyundai', model: 'Solaris', price: 1_600_000 },
  { brand: 'Volkswagen', model: 'Polo', price: 1_750_000 },
  { brand: 'Skoda', model: 'Rapid', price: 1_700_000 },
  { brand: 'Renault', model: 'Kaptur', price: 2_150_000 },
  { brand: 'Haval', model: 'Jolion', price: 2_300_000 },
  { brand: 'Geely', model: 'Coolray', price: 2_450_000 },
  { brand: 'Chery', model: 'Tiggo 7 Pro', price: 2_550_000 },
];

export const REGIONS = ['Москва', 'Санкт-Петербург', 'Казань', 'Другие регионы'];
export const TRIMS = ['Базовая', 'Комфорт', 'Максимум'];

export const modelKey = (m: { brand: string; model: string }) => `price:${m.brand} ${m.model}`;

export const PARAMS: ParamDef[] = [
  { key: 'age_rate', label: 'Износ за год возраста', hint: 'Потеря цены за каждый год', def: 0.08, step: 0.005, group: 'weights' },
  { key: 'mileage_rate', label: 'Пробег: потеря за 10 000 км', hint: 'Доля цены', def: 0.012, step: 0.001, group: 'weights' },
  { key: 'condition_rate', label: 'Состояние: штраф на 1 балл ниже «5»', hint: 'Средний балл кузова и салона', def: 0.045, step: 0.005, group: 'weights' },
  { key: 'intensity_rate', label: 'Эксплуатация в каршеринге: потеря за 1000 ч аренды', hint: 'Интенсивность использования', def: 0.025, step: 0.005, group: 'weights' },
  { key: 'accident_rate', label: 'Штраф за одно ДТП', hint: 'Доля цены', def: 0.04, step: 0.005, group: 'weights' },
  { key: 'range_pct', label: 'Ширина диапазона цены (±)', hint: 'Неопределённость оценки', def: 0.06, step: 0.005, group: 'weights' },
  { key: 'region:Москва', label: 'Москва', hint: 'Множитель', def: 1.0, step: 0.01, group: 'regions' },
  { key: 'region:Санкт-Петербург', label: 'Санкт-Петербург', hint: 'Множитель', def: 0.97, step: 0.01, group: 'regions' },
  { key: 'region:Казань', label: 'Казань', hint: 'Множитель', def: 0.94, step: 0.01, group: 'regions' },
  { key: 'region:Другие регионы', label: 'Другие регионы', hint: 'Множитель', def: 0.9, step: 0.01, group: 'regions' },
  { key: 'trim:Базовая', label: 'Базовая', hint: 'Множитель', def: 1.0, step: 0.01, group: 'trims' },
  { key: 'trim:Комфорт', label: 'Комфорт', hint: 'Множитель', def: 1.04, step: 0.01, group: 'trims' },
  { key: 'trim:Максимум', label: 'Максимум', hint: 'Множитель', def: 1.08, step: 0.01, group: 'trims' },
  { key: 'season:winter', label: 'Зима (дек–фев)', hint: 'Множитель', def: 0.97, step: 0.01, group: 'season' },
  { key: 'season:spring', label: 'Весна (мар–май)', hint: 'Множитель', def: 1.02, step: 0.01, group: 'season' },
  { key: 'season:summer', label: 'Лето (июн–авг)', hint: 'Множитель', def: 1.0, step: 0.01, group: 'season' },
  { key: 'season:autumn', label: 'Осень (сен–ноя)', hint: 'Множитель', def: 0.99, step: 0.01, group: 'season' },
];

export const GROUP_TITLES: Record<ParamDef['group'], string> = {
  weights: 'Веса факторов',
  regions: 'Региональные множители',
  trims: 'Комплектация',
  season: 'Сезонность',
};

export function defaultSettings(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of PARAMS) out[p.key] = p.def;
  for (const m of CAR_MODELS) out[modelKey(m)] = m.price;
  return out;
}

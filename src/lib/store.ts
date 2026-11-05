import { apiUrl } from './api';
import { authenticatedFetch } from './app-auth';
import { apiFailure } from './api-error';
import type { Contribution } from './pricing';
import type { StatusId } from '../content/model';

export type ValuationRow = {
  id: number;
  brand: string;
  model: string;
  year: number;
  mileage: number;
  body_condition: number;
  interior_condition: number;
  accidents: number;
  rental_hours: number;
  region: string;
  trim: string;
  base_price: number;
  recommended_price: number;
  price_min: number;
  price_max: number;
  breakdown: Contribution[];
  status: StatusId;
  created_at: string;
};

export type NewValuation = Omit<ValuationRow, 'id' | 'created_at' | 'status'> & { user_id: string };

type SettingRow = { id: number; key: string; value: number };

async function call(path: string, init: RequestInit | undefined, fallback: string): Promise<Response> {
  const res = await authenticatedFetch(apiUrl(path), init);
  if (!res) throw new Error('Сессия истекла. Войдите снова.');
  if (!res.ok) throw await apiFailure(res, fallback);
  return res;
}

export async function fetchSettingRows(): Promise<SettingRow[]> {
  const res = await call('coefficients?select=id,key,value', undefined, 'Не удалось загрузить настройки модели.');
  const rows = (await res.json()) as SettingRow[];
  return rows.map((r) => ({ ...r, value: Number(r.value) }));
}

export async function saveSettings(changes: Record<string, number>, userId: string): Promise<void> {
  const existing = await fetchSettingRows();
  const byKey = new Map(existing.map((r) => [r.key, r.id]));
  for (const [key, value] of Object.entries(changes)) {
    const id = byKey.get(key);
    if (id) {
      await call(
        `coefficients?id=eq.${id}`,
        {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal, handling=strict, max-affected=1' },
          body: JSON.stringify({ value, updated_at: new Date().toISOString() }),
        },
        'Не удалось сохранить настройки.',
      );
    } else {
      await call(
        'coefficients',
        {
          method: 'POST',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ user_id: userId, key, value }),
        },
        'Не удалось сохранить настройки.',
      );
    }
  }
}

export async function resetSettings(userId: string): Promise<void> {
  await call(`coefficients?user_id=eq.${userId}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }, 'Не удалось сбросить настройки.');
}

export async function fetchValuations(): Promise<ValuationRow[]> {
  const res = await call('valuations?order=created_at.desc&limit=500', undefined, 'Не удалось загрузить историю оценок.');
  const rows = (await res.json()) as ValuationRow[];
  return rows.map((r) => ({
    ...r,
    base_price: Number(r.base_price),
    recommended_price: Number(r.recommended_price),
    price_min: Number(r.price_min),
    price_max: Number(r.price_max),
  }));
}

export async function createValuation(v: NewValuation): Promise<void> {
  await call('valuations', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(v) }, 'Не удалось сохранить оценку.');
}

export async function updateStatus(id: number, status: StatusId): Promise<void> {
  await call(
    `valuations?id=eq.${id}`,
    { method: 'PATCH', headers: { Prefer: 'return=minimal, handling=strict, max-affected=1' }, body: JSON.stringify({ status }) },
    'Не удалось изменить статус.',
  );
}

export async function deleteValuation(id: number): Promise<void> {
  await call(`valuations?id=eq.${id}`, { method: 'DELETE', headers: { Prefer: 'return=minimal, handling=strict, max-affected=1' } }, 'Не удалось удалить оценку.');
}

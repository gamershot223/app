import { supabase } from './supabase';
import { userSafeError } from './api-error';
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

function translateError(message: string, fallback: string): Error {
  if (message.includes('JWT') || message.includes('session') || message.includes('auth'))
    return userSafeError('Сессия истекла. Войдите снова.');
  return userSafeError(fallback);
}

export async function fetchSettingRows(): Promise<SettingRow[]> {
  const { data, error } = await supabase
    .from('coefficients')
    .select('id,key,value');
  if (error) throw translateError(error.message, 'Не удалось загрузить настройки модели.');
  return (data ?? []).map((r) => ({ ...r, value: Number(r.value) }));
}

export async function saveSettings(changes: Record<string, number>, userId: string): Promise<void> {
  const { data: existing, error: existingErr } = await supabase
    .from('coefficients')
    .select('id,key');
  if (existingErr) throw translateError(existingErr.message, 'Не удалось сохранить настройки.');

  const byKey = new Map((existing ?? []).map((r) => [r.key, r.id]));

  for (const [key, value] of Object.entries(changes)) {
    const id = byKey.get(key);
    if (id) {
      const { error } = await supabase
        .from('coefficients')
        .update({ value, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw translateError(error.message, 'Не удалось сохранить настройки.');
    } else {
      const { error } = await supabase
        .from('coefficients')
        .insert({ user_id: userId, key, value });
      if (error) throw translateError(error.message, 'Не удалось сохранить настройки.');
    }
  }
}

export async function resetSettings(userId: string): Promise<void> {
  const { error } = await supabase
    .from('coefficients')
    .delete()
    .eq('user_id', userId);
  if (error) throw translateError(error.message, 'Не удалось сбросить настройки.');
}

export async function fetchValuations(): Promise<ValuationRow[]> {
  const { data, error } = await supabase
    .from('valuations')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw translateError(error.message, 'Не удалось загрузить историю оценок.');
  return (data ?? []).map((r) => ({
    ...r,
    base_price: Number(r.base_price),
    recommended_price: Number(r.recommended_price),
    price_min: Number(r.price_min),
    price_max: Number(r.price_max),
    breakdown: r.breakdown ?? [],
  }));
}

export async function createValuation(v: NewValuation): Promise<void> {
  const { error } = await supabase.from('valuations').insert(v);
  if (error) throw translateError(error.message, 'Не удалось сохранить оценку.');
}

export async function updateStatus(id: number, status: StatusId): Promise<void> {
  const { error } = await supabase
    .from('valuations')
    .update({ status })
    .eq('id', id);
  if (error) throw translateError(error.message, 'Не удалось изменить статус.');
}

export async function deleteValuation(id: number): Promise<void> {
  const { error } = await supabase
    .from('valuations')
    .delete()
    .eq('id', id);
  if (error) throw translateError(error.message, 'Не удалось удалить оценку.');
}

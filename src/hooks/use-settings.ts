import { useCallback, useEffect, useState } from 'react';
import { fetchSettingRows } from '../lib/store';

/** Пользовательские переопределения модели (ключ → значение). Пусто = значения по умолчанию. */
export function useSettings() {
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const rows = await fetchSettingRows();
      const map: Record<string, number> = {};
      for (const r of rows) map[r.key] = r.value;
      setOverrides(map);
    } catch {
      setOverrides({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { overrides, loading, reload };
}

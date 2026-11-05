import { Fragment, useEffect, useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { STATUSES, REGIONS, type StatusId } from '../content/model';
import { deleteValuation, fetchValuations, updateStatus, type ValuationRow } from '../lib/store';
import { rub } from '../lib/pricing';
import { userErrorText } from '../lib/api-error';
import { cardCls, fieldCls } from '../lib/ui-classes';

export function HistoryPage() {
  const [rows, setRows] = useState<ValuationRow[] | null>(null);
  const [err, setErr] = useState('');
  const [status, setStatus] = useState('');
  const [region, setRegion] = useState('');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<number | null>(null);

  async function load() {
    try {
      setRows(await fetchValuations());
    } catch (e) {
      setErr(userErrorText(e, 'Не удалось загрузить историю.'));
      setRows([]);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(
    () =>
      (rows ?? []).filter(
        (r) =>
          (!status || r.status === status) &&
          (!region || r.region === region) &&
          (!query || `${r.brand} ${r.model}`.toLowerCase().includes(query.toLowerCase())),
      ),
    [rows, status, region, query],
  );

  async function change(id: number, s: StatusId) {
    setErr('');
    try {
      await updateStatus(id, s);
      setRows((rs) => (rs ?? []).map((r) => (r.id === id ? { ...r, status: s } : r)));
    } catch (e) {
      setErr(userErrorText(e, 'Не удалось изменить статус.'));
    }
  }
  async function remove(id: number) {
    if (!window.confirm('Удалить оценку из истории?')) return;
    setErr('');
    try {
      await deleteValuation(id);
      setRows((rs) => (rs ?? []).filter((r) => r.id !== id));
    } catch (e) {
      setErr(userErrorText(e, 'Не удалось удалить оценку.'));
    }
  }

  return (
    <div data-section="history" className="space-y-6">
      <div>
        <h1 className="text-display font-display font-semibold">История оценок</h1>
        <p className="mt-2 text-muted-foreground">Все сохранённые оценки вашего аккаунта. Нажмите на автомобиль, чтобы увидеть разбивку по факторам.</p>
      </div>

      <div className={`${cardCls} grid gap-4 sm:grid-cols-3`}>
        <div className="space-y-1.5">
          <label htmlFor="f-query" className="text-sm font-medium">Поиск по модели</label>
          <input id="f-query" className={fieldCls} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Например, Kia" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="f-status" className="text-sm font-medium">Статус</label>
          <select id="f-status" className={fieldCls} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Все</option>
            {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="f-region" className="text-sm font-medium">Регион</label>
          <select id="f-region" className={fieldCls} value={region} onChange={(e) => setRegion(e.target.value)}>
            <option value="">Все</option>
            {REGIONS.map((r) => <option key={r}>{r}</option>)}
          </select>
        </div>
      </div>

      {err ? <p className="text-sm text-destructive" role="alert">{err}</p> : null}

      {rows === null ? (
        <p className="text-muted-foreground">Загружаю…</p>
      ) : filtered.length === 0 ? (
        <div className={`${cardCls} text-muted-foreground`}>
          {rows.length === 0 ? 'Пока нет сохранённых оценок. Рассчитайте автомобиль и нажмите «Сохранить оценку».' : 'По выбранным фильтрам ничего не найдено.'}
        </div>
      ) : (
        <div className={`${cardCls} overflow-x-auto p-0 md:p-0`}>
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-border text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Дата</th>
                <th className="px-4 py-3 font-medium">Автомобиль</th>
                <th className="px-4 py-3 font-medium">Год / пробег</th>
                <th className="px-4 py-3 font-medium">Регион</th>
                <th className="px-4 py-3 text-right font-medium">Цена</th>
                <th className="px-4 py-3 font-medium">Статус</th>
                <th className="px-4 py-3"><span className="sr-only">Действия</span></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <Fragment key={r.id}>
                  <tr className="border-b border-border/60">
                    <td className="px-4 py-3 whitespace-nowrap">{new Date(r.created_at).toLocaleDateString('ru-RU')}</td>
                    <td className="px-4 py-3">
                      <button type="button" className="min-h-11 text-left underline-offset-2 hover:underline" onClick={() => setOpen(open === r.id ? null : r.id)} aria-expanded={open === r.id}>
                        {r.brand} {r.model}
                      </button>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{r.year} · {r.mileage.toLocaleString('ru-RU')} км</td>
                    <td className="px-4 py-3">{r.region}</td>
                    <td className="px-4 py-3 text-right font-mono whitespace-nowrap">{rub(r.recommended_price)}</td>
                    <td className="px-4 py-3">
                      <label className="sr-only" htmlFor={`st-${r.id}`}>Статус оценки</label>
                      <select id={`st-${r.id}`} className="min-h-11 rounded-full border border-border bg-background px-3 text-sm" value={r.status} onChange={(e) => void change(r.id, e.target.value as StatusId)}>
                        {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => void remove(r.id)} aria-label="Удалить оценку" className="inline-flex size-11 items-center justify-center rounded-full text-muted-foreground hover:text-destructive">
                        <Trash2 className="size-4" aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                  {open === r.id ? (
                    <tr className="border-b border-border/60 bg-background/40">
                      <td colSpan={7} className="px-4 py-4">
                        <p className="mb-2 text-xs text-muted-foreground">Диапазон {rub(r.price_min)} — {rub(r.price_max)} · базовая цена {rub(r.base_price)} · ДТП: {r.accidents} · аренда: {r.rental_hours.toLocaleString('ru-RU')} ч · {r.trim}</p>
                        <ul className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
                          {r.breakdown.map((b) => (
                            <li key={b.key} className="flex justify-between gap-3 text-sm">
                              <span>{b.label}</span>
                              <span className="font-mono">{b.delta > 0 ? '+' : ''}{rub(b.delta)}</span>
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

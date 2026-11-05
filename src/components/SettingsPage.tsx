import { useEffect, useState } from 'react';
import { RotateCcw, Save } from 'lucide-react';
import { CAR_MODELS, GROUP_TITLES, PARAMS, defaultSettings, modelKey, type ParamDef } from '../content/model';
import { resetSettings, saveSettings } from '../lib/store';
import { useSettings } from '../hooks/use-settings';
import { userErrorText } from '../lib/api-error';
import type { AuthUser } from '../lib/auth';
import { btnGhost, btnPrimary, cardCls, fieldCls } from '../lib/ui-classes';

export function SettingsPage({ user }: { user: AuthUser }) {
  const { overrides, loading, reload } = useSettings();
  const [draft, setDraft] = useState<Record<string, number>>(defaultSettings());
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading) setDraft({ ...defaultSettings(), ...overrides });
  }, [loading, overrides]);

  const defaults = defaultSettings();
  const setVal = (k: string, v: string) => setDraft((d) => ({ ...d, [k]: v === '' ? 0 : Number(v) }));

  async function save() {
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      const changes: Record<string, number> = {};
      for (const k of Object.keys(draft)) {
        const current = overrides[k] ?? defaults[k];
        if (draft[k] !== current) changes[k] = draft[k];
      }
      await saveSettings(changes, user.id);
      await reload();
      setMsg(Object.keys(changes).length ? 'Настройки сохранены — расчёт использует новые значения.' : 'Изменений нет.');
    } catch (e) {
      setErr(userErrorText(e, 'Не удалось сохранить настройки.'));
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      await resetSettings(user.id);
      await reload();
      setDraft(defaultSettings());
      setMsg('Возвращены значения по умолчанию.');
    } catch (e) {
      setErr(userErrorText(e, 'Не удалось сбросить настройки.'));
    } finally {
      setBusy(false);
    }
  }

  const groups = (['weights', 'regions', 'trims', 'season'] as ParamDef['group'][]).map((g) => ({
    g,
    items: PARAMS.filter((p) => p.group === g),
  }));

  return (
    <div data-section="settings" className="space-y-6">
      <div>
        <h1 className="text-display font-display font-semibold">Настройка модели</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Базовые цены моделей и веса факторов. Значения личные для вашего аккаунта и сразу применяются в калькуляторе.
        </p>
      </div>

      <section className={cardCls}>
        <h2 className="mb-4 font-display text-xl font-semibold">Базовые рыночные цены, ₽</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CAR_MODELS.map((m) => {
            const k = modelKey(m);
            return (
              <div key={k} className="space-y-1.5">
                <label htmlFor={`set-${k}`} className="text-sm font-medium">{m.brand} {m.model}</label>
                <input id={`set-${k}`} type="number" min={0} step={10000} className={fieldCls} value={draft[k] ?? 0} onChange={(e) => setVal(k, e.target.value)} />
              </div>
            );
          })}
        </div>
      </section>

      {groups.map(({ g, items }) => (
        <section key={g} className={cardCls}>
          <h2 className="mb-4 font-display text-xl font-semibold">{GROUP_TITLES[g]}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((p) => (
              <div key={p.key} className="space-y-1.5">
                <label htmlFor={`set-${p.key}`} className="text-sm font-medium">{p.label}</label>
                <input id={`set-${p.key}`} type="number" step={p.step} min={0} className={fieldCls} value={draft[p.key] ?? 0} onChange={(e) => setVal(p.key, e.target.value)} />
                <p className="text-xs text-muted-foreground">{p.hint}. По умолчанию {p.def}</p>
              </div>
            ))}
          </div>
        </section>
      ))}

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => void save()} disabled={busy} className={btnPrimary}>
          <Save className="size-4" aria-hidden="true" />
          Сохранить настройки
        </button>
        <button type="button" onClick={() => void reset()} disabled={busy} className={btnGhost}>
          <RotateCcw className="size-4" aria-hidden="true" />
          Сбросить к значениям по умолчанию
        </button>
        {msg ? <p className="text-sm text-chart-3" role="status">{msg}</p> : null}
        {err ? <p className="text-sm text-destructive" role="alert">{err}</p> : null}
      </div>
    </div>
  );
}

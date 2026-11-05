import { ArrowRight } from 'lucide-react';
import { ecoFlows, ecoNodes, layerTitles, type EcoNode } from '../content/ecosystem';

const layers: EcoNode['layer'][] = ['source', 'core', 'model', 'out'];

export function EcosystemPage() {
  return (
    <div data-section="ecosystem" className="space-y-8">
      <div>
        <h1 className="text-display font-display font-semibold">Цифровая экосистема предприятия</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          Учебная схема: как данные каршеринга проходят от приложения и автомобиля до рекомендованной цены выкупа.
          Модель trade-in — это отдельный модуль, который берёт данные из соседних систем и отдаёт цену в аналитику.
        </p>
      </div>

      <div id="eco-diagram" className="grid gap-4 lg:grid-cols-4">
        {layers.map((layer, i) => (
          <section key={layer} className="relative space-y-3" aria-label={layerTitles[layer]}>
            <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{layerTitles[layer]}</h2>
            {ecoNodes
              .filter((n) => n.layer === layer)
              .map((n) => (
                <article
                  key={n.id}
                  className={`rounded-2xl border p-4 ${n.layer === 'model' ? 'border-accent bg-accent/10' : 'border-border bg-card'}`}
                >
                  <h3 className="font-display text-base font-semibold">{n.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{n.text}</p>
                </article>
              ))}
            {i < layers.length - 1 ? (
              <ArrowRight className="absolute top-1/2 -right-4 hidden size-5 text-muted-foreground lg:block" aria-hidden="true" />
            ) : null}
          </section>
        ))}
      </div>

      <section className="rounded-2xl border border-border bg-card p-5 md:p-6">
        <h2 className="mb-4 font-display text-xl font-semibold">Потоки данных</h2>
        <ul className="divide-y divide-border">
          {ecoFlows.map((f) => (
            <li key={f.from + f.to} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 text-sm">
              <span className="font-medium">{f.from}</span>
              <ArrowRight className="size-4 text-muted-foreground" aria-hidden="true" />
              <span className="font-medium">{f.to}</span>
              <span className="text-muted-foreground">— {f.data}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-muted-foreground">В этой версии интеграции не подключены: данные в калькулятор вводятся вручную.</p>
      </section>
    </div>
  );
}

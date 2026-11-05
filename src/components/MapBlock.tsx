/**
 * W23: блок «как нас найти».
 *
 * Виджет Яндекс.Карт через iframe — сознательно вместо JS SDK. У SDK два
 * непреодолимых для нас минуса: он требует ключ API (владелец проекта должен
 * его завести и вписать, то есть блок не работает «из коробки») и добавляет
 * зависимость, которой нет в списке предустановленных пакетов рантайма
 * превью — то есть живое превью на нём сломается.
 *
 * `loading="lazy"` не косметика: карта весит больше всей остальной страницы,
 * а стоит она почти всегда внизу — грузить её до того, как посетитель туда
 * доскроллил, значит платить за неё в LCP.
 *
 * Агент: блок НЕ смонтирован в App.tsx. Подключать только если у бизнеса
 * реально есть адрес — карта в лендинге онлайн-сервиса выглядит нелепо.
 */

type MapBlockProps = {
  /** Заголовок секции. */
  title?: string;
  /** Адрес как в поиске Яндекса: «Москва, Тверская 1». */
  address: string;
  /** Подпись под картой — часы работы, вход со двора и т.п. */
  note?: string;
};

export function MapBlock({ title = 'Как нас найти', address, note }: MapBlockProps) {
  const src = `https://yandex.ru/map-widget/v1/?text=${encodeURIComponent(
    address,
  )}&z=16`;

  return (
    <section data-section="map" className="mx-auto max-w-5xl px-6 py-20">
      <h2 className="font-display text-3xl md:text-4xl">{title}</h2>
      <p className="mt-3 text-foreground/70">{address}</p>
      <div className="mt-6 overflow-hidden rounded-2xl border border-foreground/10">
        <iframe
          src={src}
          title={`Карта: ${address}`}
          loading="lazy"
          className="h-[360px] w-full border-0"
          allowFullScreen
        />
      </div>
      {note ? <p className="mt-3 text-sm text-foreground/60">{note}</p> : null}
    </section>
  );
}

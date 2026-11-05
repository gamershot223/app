export type EcoNode = { id: string; title: string; text: string; layer: 'source' | 'core' | 'model' | 'out' };

export const ecoNodes: EcoNode[] = [
  { id: 'app', title: 'Мобильное приложение', text: 'Аренда, поездки, оценка состояния машины клиентом, жалобы.', layer: 'source' },
  { id: 'telematics', title: 'Телематика автомобилей', text: 'Пробег, часы аренды, стиль вождения, ДТП и срабатывания датчиков.', layer: 'source' },
  { id: 'crm', title: 'CRM и клиентский сервис', text: 'Обращения, акты осмотра, история повреждений и ремонтов.', layer: 'core' },
  { id: 'billing', title: 'Биллинг', text: 'Тарифы, списания, выручка по автомобилю за всё время работы.', layer: 'core' },
  { id: 'tradein', title: 'Модель оценки trade-in', text: 'Формула: базовая цена × износ × пробег × состояние × эксплуатация × ДТП × регион × сезон.', layer: 'model' },
  { id: 'analytics', title: 'Аналитика и отчётность', text: 'Средняя цена выкупа, динамика, окупаемость автомобиля, решения о списании.', layer: 'out' },
];

export const ecoFlows = [
  { from: 'Телематика', to: 'Модель trade-in', data: 'пробег, часы аренды, ДТП' },
  { from: 'CRM', to: 'Модель trade-in', data: 'состояние кузова и салона, история ремонтов' },
  { from: 'Биллинг', to: 'Модель trade-in', data: 'выручка и срок эксплуатации автомобиля' },
  { from: 'Приложение', to: 'CRM', data: 'жалобы и фото повреждений' },
  { from: 'Модель trade-in', to: 'Аналитика', data: 'рекомендованная цена, диапазон, вклад факторов' },
];

export const layerTitles: Record<EcoNode['layer'], string> = {
  source: '1. Источники данных',
  core: '2. Учётные системы',
  model: '3. Наша модель',
  out: '4. Решения и отчёты',
};

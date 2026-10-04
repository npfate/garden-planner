import type { GardenObjectType, IsoDate } from '../types/garden';

export const MARKER_SIZE = 10;

// Контрастные цвета меток объектов для быстрого распознавания на схеме
const MARKER_COLORS: Record<GardenObjectType, string> = {
  tree: '#2E7D32',
  bed: '#8D6E63',
  seedling: '#00ACC1',
  greenhouse: '#F9A825',
  building: '#455A64',
  path: '#9E9E9E',
  custom: '#7B1FA2',
};

export function getMarkerColor(type: GardenObjectType): string {
  return MARKER_COLORS[type] ?? MARKER_COLORS.custom;
}

export function todayIso(): IsoDate {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function isoYear(date: IsoDate | null | undefined): number | null {
  if (!date) return null;
  const y = Number(date.slice(0, 4));
  return Number.isFinite(y) ? y : null;
}

// Сдвиг ISO-даты на N дней (для стрелок «день назад/вперёд» wayback-машины).
export function shiftIsoDate(date: IsoDate, days: number): IsoDate {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

const MONTH_NAMES = [
  'янв', 'фев', 'мар', 'апр', 'мая', 'июн',
  'июл', 'авг', 'сен', 'окт', 'ноя', 'дек',
];

export function formatDateRu(date: IsoDate | null | undefined): string {
  if (!date) return '—';
  const m = Number(date.slice(5, 7));
  const d = Number(date.slice(8, 10));
  if (Number.isNaN(m) || Number.isNaN(d)) return date;
  return `${d} ${MONTH_NAMES[m - 1] ?? '?'} ${date.slice(0, 4)}`;
}

// Централизованная конфигурация журнала активности (wayback machine).
//
// Это «единственная точка правды» для всего, что касается отображения
// событий. Любые будущие изменения делаются здесь, а не в компонентах:
//  - добавить новый вид события   -> ActivityKind (types/garden.ts) + запись в ACTIVITY_META;
//  - изменить иконку/цвет/подпись -> только ACTIVITY_META;
//  - изменить пороги тепловой карты -> HEATMAP_LEVELS (порог "до" включительно);
//  - изменить палитру heat-map      -> HEATMAP_LEVELS[].colorClass;
//  - поменять порядок значков в legend/filter -> ACTIVITY_ORDER.
//
// Компоненты (DiaryPage и др.) обязаны читать метаданные отсюда, чтобы
// тепловая карта и лента событий оставались консистентными при расширении.

import {
  Flower2,
  MapPinOff,
  MessageSquare,
  MoveRight,
  Ruler,
  Sprout,
  StickyNote,
  ThumbsDown,
  ThumbsUp,
  Trash2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ActivityKind } from '../types/garden';

export interface ActivityMeta {
  icon: LucideIcon;
  /** Человекочитаемая подпись типа события */
  label: string;
  /** Tailwind-классы бейджа/иконки в ленте событий */
  className: string;
}

export const ACTIVITY_META: Record<ActivityKind, ActivityMeta> = {
  planted: { icon: Sprout, label: 'Посадка', className: 'bg-green-100 text-green-700' },
  moved: { icon: MoveRight, label: 'Перемещение', className: 'bg-blue-100 text-blue-700' },
  harvest: { icon: Flower2, label: 'Урожай', className: 'bg-amber-100 text-amber-700' },
  dug: { icon: MapPinOff, label: 'Выкопка', className: 'bg-orange-100 text-orange-700' },
  destroyed: { icon: Trash2, label: 'В корзину', className: 'bg-red-100 text-red-700' },
  rating: { icon: ThumbsUp, label: 'Оценка', className: 'bg-violet-100 text-violet-700' },
  resized: { icon: Ruler, label: 'Размер', className: 'bg-cyan-100 text-cyan-700' },
  note: { icon: StickyNote, label: 'Заметка', className: 'bg-gray-100 text-gray-700' },
};

/** Порядок обхода типов (легенда, фильтр «все типы», переключатели). */
export const ACTIVITY_ORDER: ActivityKind[] = [
  'planted',
  'moved',
  'harvest',
  'dug',
  'destroyed',
  'rating',
  'resized',
  'note',
];

/** Иконка оценки по значению рейтинга (для событий kind='rating'). */
export function ratingIcon(value: 'like' | 'dislike'): LucideIcon {
  return value === 'like' ? ThumbsUp : ThumbsDown;
}

/** Запасная иконка для неизвестных типов событий (на случай расширения enum без обновления конфига). */
export const FALLBACK_ICON: LucideIcon = MessageSquare;

/**
 * Уровни насыщенности тепловой карты.
 * until — верхняя граница числа событий (включительно) для уровня.
 * Последний уровень — «всё, что больше предыдущего порога».
 * Чтобы настроить карту, достаточно отредактировать этот массив
 * (добавить уровни, изменить пороги или цвета) — код Heatmap трогать не нужно.
 */
export const HEATMAP_LEVELS: { until: number; colorClass: string }[] = [
  { until: 0, colorClass: 'bg-gray-100' }, // нет событий
  { until: 1, colorClass: 'bg-green-200' },
  { until: 3, colorClass: 'bg-green-400' },
  { until: Infinity, colorClass: 'bg-green-600' },
];

/** CSS-класс ячейки heat-map по количеству событий за день. */
export function heatmapCellClass(count: number): string {
  for (const level of HEATMAP_LEVELS) {
    if (count <= level.until) return level.colorClass;
  }
  return HEATMAP_LEVELS[HEATMAP_LEVELS.length - 1].colorClass;
}

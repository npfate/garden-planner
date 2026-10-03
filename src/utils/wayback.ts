import type { ActivityEvent, GardenObject, IsoDate } from '../types/garden';
import { isoYear, todayIso } from './markers';

// --- Wayback machine: временна́я модель сада ---
//
// Каждый объект живёт в интервале [plantedAt, removedAt]. Переключая год и
// дату (как в web.archive.org), мы смотрим на сад «в тот момент времени»:
//  - многолетники (perennial) видны во всех годах после посадки;
//  - однолетники (annual) — только в сезон посадки;
//  - пересаживание кустарника = старая запись получает removedAt, новая —
//    plantedAt (объект «исчезает» с одного места и «появляется» на другом);
//  - события (посадки, перемещения, сборы урожая) падают в журнал ActivityEvent.

export const DEFAULT_LIFECYCLE = 'perennial' as const;

export function lifecycleOf(obj: GardenObject): 'perennial' | 'annual' {
  return obj.lifecycle ?? DEFAULT_LIFECYCLE;
}

export function isAnnual(obj: GardenObject): boolean {
  return lifecycleOf(obj) === 'annual';
}

// Границы жизни объекта. Если календарные даты не заданы (старые данные),
// выводим их из года посадки (начало/конец года).
export function lifeBounds(obj: GardenObject): { start: IsoDate; end: IsoDate | null } {
  const start = obj.plantedAt ?? `${obj.year}-01-01`;
  const end = obj.removedAt ?? null;
  return { start, end };
}

// Виден ли объект на схеме по состоянию на конец выбранного года
// (годовой режим — как сейчас в YearSwitcher).
export function isVisibleInYear(obj: GardenObject, year: number): boolean {
  const { start, end } = lifeBounds(obj);
  const startY = isoYear(start) ?? obj.year;
  if (year < startY) return false; // ещё не посажен
  if (end) {
    const endY = isoYear(end) ?? year;
    if (year > endY) return false; // выкопан/удалён до начала этого года
  }
  if (isAnnual(obj)) {
    // однолетник живёт только сезон посадки
    // (если выкопан в том же году раньше — считаем видимым до конца сезона,
    //  точную дату покажет режим даты)
    return year === startY;
  }
  return true;
}

// --- Журнал активности (лента «как на GitHub») ---

let eventSeq = 0;

export function makeEvent(
  kind: ActivityEvent['kind'],
  object: Pick<GardenObject, 'id' | 'name'> | null,
  details: string,
  date?: IsoDate,
): ActivityEvent {
  eventSeq += 1;
  return {
    id: `evt-${Date.now().toString(36)}-${eventSeq}`,
    date: date ?? todayIso(),
    objectId: object?.id ?? null,
    objectName: object?.name ?? 'Проект',
    kind,
    details,
  };
}

export function sortEvents(events: ActivityEvent[]): ActivityEvent[] {
  return [...events].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

// Группировка событий по дням для визуальной ленты.
export interface EventDayGroup {
  date: IsoDate;
  events: ActivityEvent[];
}

export function groupEventsByDay(events: ActivityEvent[]): EventDayGroup[] {
  const sorted = sortEvents(events);
  const groups: EventDayGroup[] = [];
  for (const ev of sorted) {
    const last = groups[groups.length - 1];
    if (last && last.date === ev.date) last.events.push(ev);
    else groups.push({ date: ev.date, events: [ev] });
  }
  return groups;
}

// Годы, в которые попадали события (для фильтрации ленты по году).
export function eventYears(events: ActivityEvent[]): number[] {
  const years = new Set<number>();
  for (const ev of events) {
    const y = isoYear(ev.date);
    if (y !== null) years.add(y);
  }
  return [...years].sort((a, b) => b - a);
}

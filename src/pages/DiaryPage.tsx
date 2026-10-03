import { useMemo, useState } from 'react';
import { useGardenStore } from '../store/gardenStore';
import type { ActivityEvent, ActivityKind } from '../types/garden';
import { formatDateRu, isoYear } from '../utils/markers';
import { groupEventsByDay } from '../utils/wayback';
// Метаданные событий и настройки тепловой карты — единый источник из config.
// Новые типы событий / пороги / цвета добавляются в src/config/activity.ts,
// этот компонент менять не нужно.
import { ACTIVITY_META, ACTIVITY_ORDER, heatmapCellClass } from '../config/activity';

// Тепловая сетка «как на GitHub»: события по дням за выбранный год.
function Heatmap({ events, year }: { events: ActivityEvent[]; year: number }) {
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const ev of events) {
      if (isoYear(ev.date) !== year) continue;
      map.set(ev.date, (map.get(ev.date) ?? 0) + 1);
    }
    return map;
  }, [events, year]);

  const days: string[] = [];
  const d = new Date(year, 0, 1);
  while (d.getFullYear() === year) {
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    days.push(`${year}-${m}-${day}`);
    d.setDate(d.getDate() + 1);
  }

  return (
    <div className="grid grid-flow-col gap-1 auto-cols-max overflow-x-auto p-2 panel rounded-lg border border-border">
      {days.map((date) => {
        const count = counts.get(date) ?? 0;
        return (
          <div
            key={date}
            title={`${formatDateRu(date)}: ${count} событ.`}
            className={`w-3 h-3 rounded-sm flex-shrink-0 ${heatmapCellClass(count)}`}
          />
        );
      })}
    </div>
  );
}

export default function DiaryPage() {
  const events = useGardenStore((s) => s.events);
  const currentYear = useGardenStore((s) => s.currentYear);
  const setYear = useGardenStore((s) => s.setYear);
  const selectObject = useGardenStore((s) => s.selectObject);
  const [filterKind, setFilterKind] = useState<ActivityKind | 'all'>('all');

  const years = useMemo(() => {
    const set = new Set<number>([currentYear]);
    for (const ev of events) {
      const y = isoYear(ev.date);
      if (y !== null) set.add(y);
    }
    return [...set].sort((a, b) => b - a);
  }, [events, currentYear]);

  const filtered = useMemo(
    () => (filterKind === 'all' ? events : events.filter((e) => e.kind === filterKind)),
    [events, filterKind],
  );
  const groups = useMemo(() => groupEventsByDay(filtered), [filtered]);

  return (
    <div className="p-6 space-y-4 max-w-3xl mx-auto overflow-y-auto h-full">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-text-primary">Журнал сада</h1>
        <div className="flex items-center gap-2">
          <select
            value={filterKind}
            onChange={(e) => setFilterKind(e.target.value as ActivityKind | 'all')}
            className="rounded-md border border-border bg-white px-3 py-1.5 text-sm outline-none focus:border-primary"
            aria-label="Фильтр по типу"
          >
            <option value="all">Все события</option>
            {ACTIVITY_ORDER.map((kind) => (
              <option key={kind} value={kind}>
                {ACTIVITY_META[kind].label}
              </option>
            ))}
          </select>
          <select
            value={currentYear}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-md border border-border bg-white px-3 py-1.5 text-sm outline-none focus:border-primary"
            aria-label="Год"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Heatmap events={events} year={currentYear} />

      {groups.length === 0 && (
        <p className="text-text-secondary text-sm">
          Пока пусто. Добавляйте, перемещайте и убирайте объекты на схеме, собирайте урожай —
          события появятся здесь.
        </p>
      )}

      {/* Лента как на GitHub: день → список действий */}
      <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-1 before:bottom-1 before:w-px before:bg-border">
        {groups.map((group) => (
          <section key={group.date} className="relative">
            <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-primary border-2 border-white" />
            <h2 className="text-sm font-semibold text-text-primary mb-2">{formatDateRu(group.date)}</h2>
            <ul className="space-y-2">
              {group.events.map((ev) => {
                const meta = ACTIVITY_META[ev.kind];
                const Icon = meta.icon;
                return (
                  <li
                    key={ev.id}
                    className="flex items-start gap-2 panel rounded-md border border-border px-3 py-2"
                  >
                    <span
                      className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${meta.className}`}
                    >
                      <Icon size={14} />
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs uppercase tracking-wide text-text-secondary">
                        {meta.label}
                      </div>
                      <div className="text-sm text-text-primary break-words">{ev.details}</div>
                    </div>
                    {ev.objectId && (
                      <button
                        type="button"
                        onClick={() => {
                          selectObject(ev.objectId);
                          // переход на схему для просмотра объекта
                          window.location.href = '/';
                        }}
                        className="ml-auto text-xs text-primary hover:underline whitespace-nowrap"
                      >
                        На схеме →
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

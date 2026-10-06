import { useMemo, useState } from 'react';
import * as LucideIcons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';
import { useGardenStore } from '../../store/gardenStore';
import { LIBRARY_ITEMS_FLAT } from '../../constants/objectLibrary';
import type { GardenObject } from '../../types/garden';

// Инвентарь и canvas используют ОДНУ временну́ю модель: store.visibleObjects()
// (см. utils/wayback.ts). Раньше здесь была упрощённая копия фильтра, которая
// расходилась с канвасом в двух местах:
//  - момент «сейчас»: канвас смотрит на СЕГОДНЯШНЮЮ дату (momentOf), а список
//    — на конец выбранного года → объекты, посаженные/выкопанные в текущем
//    году, были в списке, но отсутствовали на схеме (и наоборот);
//  - правило пересадок: канвас скрывает промежуточные звенья цепочки только
//    если следующее место ещё живо; старая копия скрывала их всегда.

// Инвентарь — список ЭКЗЕМПЛЯРОВ, уже размещённых на схеме.
// Аналог «дерева объектов» в CAD / «слоёв» в Photoshop:
// клик по строке выделяет объект и перемещает камеру к нему (focusOnObject).

interface IconProps {
  name: string;
  size?: number;
}

function InvIcon({ name, size = 14 }: IconProps) {
  const Icon = (LucideIcons as unknown as Record<string, LucideIcon>)[name] ?? LucideIcons.Square;
  return <Icon size={size} />;
}

// Иконка объекта: сначала шаблон из библиотеки, иначе — дефолт по типу.
const DEFAULT_TYPE_ICON: Record<string, string> = {
  tree: 'TreePine',
  bed: 'LayoutGrid',
  seedling: 'Sprout',
  greenhouse: 'Tent',
  building: 'Home',
  path: 'Route',
  custom: 'Shapes',
};

function iconFor(obj: GardenObject): string {
  if (obj.libraryItemId) {
    const tpl = LIBRARY_ITEMS_FLAT.find((i) => i.id === obj.libraryItemId);
    if (tpl) return tpl.icon;
  }
  return DEFAULT_TYPE_ICON[obj.type] ?? 'Shapes';
}

interface Group {
  key: string;
  label: string;
  icon: string;
  objects: GardenObject[];
}

export default function Inventory() {
  // Единый источник истины для фильтра по времени — тот же селектор,
  // которым канвас решает, что рисовать (utils/wayback.filterVisible).
  // getVisibleObjects() возвращает КЭШИРОВАННУЮ ссылку на массив: без кэша
  // useSyncExternalStore получал бы новый массив при каждом рендере и
  // зацикливал обновления ("The result of getSnapshot should be cached").
  const visibleObjects = useGardenStore((s) => s.getVisibleObjects());
  const viewDate = useGardenStore((s) => s.viewDate);
  const currentYear = useGardenStore((s) => s.currentYear);
  const selectedObjectId = useGardenStore((s) => s.selectedObjectId);
  const focusOnObject = useGardenStore((s) => s.focusOnObject);
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const groups = useMemo<Group[]>(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? visibleObjects.filter((o) => o.name.toLowerCase().includes(q))
      : visibleObjects;
    const map = new Map<string, Group>();
    for (const o of filtered) {
      const key = o.libraryItemId ?? `type:${o.type}`;
      const tpl = o.libraryItemId
        ? LIBRARY_ITEMS_FLAT.find((i) => i.id === o.libraryItemId)
        : undefined;
      let group = map.get(key);
      if (!group) {
        group = {
          key,
          label: tpl?.name ?? o.name,
          icon: tpl?.icon ?? DEFAULT_TYPE_ICON[o.type] ?? 'Shapes',
          objects: [],
        };
        map.set(key, group);
      }
      group.objects.push(o);
    }
    // Сортировка групп по алфавиту, внутри — по имени экземпляра.
    return [...map.values()]
      .sort((a, b) => a.label.localeCompare(b.label, 'ru'))
      .map((g) => ({ ...g, objects: g.objects.sort((a, b) => a.name.localeCompare(b.name, 'ru')) }));
  }, [visibleObjects, query]);

  const totalShown = groups.reduce((acc, g) => acc + g.objects.length, 0);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-2 border-b border-border">
        <div className="relative">
          <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск объекта…"
            className="w-full pl-7 pr-2 py-1.5 text-xs rounded-md bg-background border border-border focus:outline-none focus:border-primary"
          />
        </div>
        <div className="mt-1.5 text-[11px] text-text-secondary px-1">
          Размещено: {totalShown} · год {currentYear}
          {viewDate ? `, ${viewDate.split('-').reverse().join('.')}` : ''}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {groups.length === 0 && (
          <div className="text-xs text-text-secondary text-center py-6">
            {query ? 'Ничего не найдено' : 'На схеме пока нет объектов.\nРазместите их через Библиотеку.'}
          </div>
        )}
        {groups.map((group) => {
          const isCollapsed = collapsed[group.key] ?? false;
          return (
            <div key={group.key}>
              <button
                type="button"
                onClick={() => setCollapsed((c) => ({ ...c, [group.key]: !isCollapsed }))}
                className="w-full flex items-center gap-2 px-2 py-1 rounded-md text-xs font-medium text-text-primary hover:bg-background transition-colors"
              >
                {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                <InvIcon name={group.icon} />
                <span className="flex-1 text-left truncate">{group.label}</span>
                <span className="text-text-secondary">{group.objects.length}</span>
              </button>
              {!isCollapsed && (
                <ul className="ml-3 mt-0.5 space-y-0.5 border-l border-border pl-2">
                  {group.objects.map((o) => {
                    const isSelected = selectedObjectId === o.id;
                    return (
                      <li key={o.id}>
                        <button
                          type="button"
                          onClick={() => focusOnObject(o.id)}
                          title="Показать на схеме (фокус камеры)"
                          className={`w-full flex items-center gap-2 px-2 py-1 rounded-md text-xs text-left transition-colors ${
                            isSelected
                              ? 'bg-primary/10 text-primary font-medium'
                              : 'text-text-secondary hover:bg-background hover:text-text-primary'
                          }`}
                        >
                          <InvIcon name={iconFor(o)} />
                          <span className="flex-1 truncate">{o.name}</span>
                          {o.parentId && (
                            <span className="text-[10px] text-text-secondary" title="Внутри другого объекта">
                              ↳
                            </span>
                          )}
                          <span className="text-[10px] text-text-secondary tabular-nums">
                            {Math.round(o.width)}×{Math.round(o.height)} м
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

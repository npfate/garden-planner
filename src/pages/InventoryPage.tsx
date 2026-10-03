import { useMemo } from 'react';
import { ThumbsDown, ThumbsUp } from 'lucide-react';
import { INVENTORY_ITEMS } from '../constants/inventory';
import { useGardenStore } from '../store/gardenStore';

interface RatedVariety {
  name: string;
  likes: number;
  dislikes: number;
}

// Агрегация оценок сортов по всем объектам и годам (Этап 3 — вкладка «Избранные сорта»)
function collectRatings(objects: ReturnType<typeof useGardenStore.getState>['objects']): RatedVariety[] {
  const map = new Map<string, RatedVariety>();
  for (const obj of objects) {
    const names = [obj.name, ...obj.varieties.map((v) => v.name)];
    for (const entry of Object.values(obj.history)) {
      if (!entry.rating) continue;
      for (const name of names) {
        const item = map.get(name) ?? { name, likes: 0, dislikes: 0 };
        if (entry.rating === 'like') item.likes += 1;
        else item.dislikes += 1;
        map.set(name, item);
      }
    }
  }
  return [...map.values()].sort((a, b) => b.likes - a.likes || a.name.localeCompare(b.name));
}

export default function InventoryPage() {
  const objects = useGardenStore((s) => s.objects);
  const ratings = useMemo(() => collectRatings(objects), [objects]);

  return (
    <div className="p-6 space-y-8 overflow-y-auto h-full">
      <section>
        <h2 className="text-lg font-bold text-text-primary mb-3">Библиотека объектов</h2>
        <ul className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {INVENTORY_ITEMS.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 px-3 py-2 rounded-md border border-border bg-surface text-sm text-text-primary"
            >
              <span className="text-xl">{item.icon}</span>
              <span>{item.name}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-bold text-text-primary mb-3">Оценённые сорта</h2>
        {ratings.length === 0 ? (
          <p className="text-text-secondary text-sm">
            Пока нет оценок. Ставьте 👍/👎 сортам в панели свойств на схеме.
          </p>
        ) : (
          <ul className="space-y-1">
            {ratings.map((r) => (
              <li
                key={r.name}
                className="flex items-center justify-between px-3 py-2 rounded-md border border-border bg-surface text-sm max-w-md"
              >
                <span className="font-medium text-text-primary">{r.name}</span>
                <span className="flex items-center gap-3 text-text-secondary">
                  <span className="flex items-center gap-1 text-green-700">
                    <ThumbsUp size={14} /> {r.likes}
                  </span>
                  <span className="flex items-center gap-1 text-red-600">
                    <ThumbsDown size={14} /> {r.dislikes}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

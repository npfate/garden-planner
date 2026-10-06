import { useState } from 'react';
import { Boxes, List } from 'lucide-react';
import ObjectLibrary from './ObjectLibrary';
import Inventory from './Inventory';

// Левая панель страницы «Схема» (Спринт 5).
// Два таба: «Библиотека» — каталог шаблонов для размещения на canvas,
// «Инвентарь» — список экземпляров, уже размещённых на схеме.

type PanelTab = 'library' | 'inventory';

interface TabDef {
  id: PanelTab;
  label: string;
  icon: typeof Boxes;
}

const TABS: TabDef[] = [
  { id: 'library', label: 'Библиотека', icon: Boxes },
  { id: 'inventory', label: 'Инвентарь', icon: List },
];

export default function SchemaSidePanel() {
  const [tab, setTab] = useState<PanelTab>('library');

  return (
    <aside className="w-[280px] panel z-10 flex flex-col flex-shrink-0 border-r border-border min-h-0">
      <div
        role="tablist"
        aria-label="Панель схемы"
        className="flex border-b border-border flex-shrink-0"
      >
        {TABS.map(({ id, label, icon: Icon }) => {
          const isActive = tab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setTab(id)}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors border-b-2 ${
                isActive
                  ? 'border-primary text-primary bg-primary/5'
                  : 'border-transparent text-text-secondary hover:text-text-primary hover:bg-background'
              }`}
            >
              <Icon size={16} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* Оба таба остаются смонтированными (hidden), чтобы состояние
          поиска и сворачивания групп не сбрасывалось при переключении. */}
      <div className={`flex-1 min-h-0 ${tab === 'library' ? 'block' : 'hidden'}`}>
        <ObjectLibrary />
      </div>
      <div className={`flex-1 min-h-0 ${tab === 'inventory' ? 'block' : 'hidden'}`}>
        <Inventory />
      </div>
    </aside>
  );
}

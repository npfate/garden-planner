import { useMemo, useState } from 'react';
import * as LucideIcons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';
import { useCanvasStore } from '../../store/gardenStore';
import {
  OBJECT_LIBRARY,
  type LibraryCategory,
  type LibraryItem,
} from '../../constants/objectLibrary';

// Библиотека объектов — каталог ТИПОВ для размещения на схеме.
// Клик по элементу активирует инструмент размещения (placement tool).

interface IconProps {
  name: string;
  size?: number;
}

// Разрешение имени иконки (строка из objectLibrary) в компонент lucide-react.
function LibIcon({ name, size = 16 }: IconProps) {
  const Icon = (LucideIcons as unknown as Record<string, LucideIcon>)[name] ?? LucideIcons.Square;
  return <Icon size={size} />;
}

function matchesSearch(item: LibraryItem, query: string): boolean {
  if (!query) return true;
  return item.name.toLowerCase().includes(query);
}

function filterCategory(cat: LibraryCategory, query: string): LibraryCategory | null {
  const items = cat.items?.filter((item) => matchesSearch(item, query));
  const children = cat.children
    ?.map((child) => filterCategory(child, query))
    .filter((child): child is LibraryCategory => child !== null && ((child.items?.length ?? 0) > 0 || (child.children?.length ?? 0) > 0));

  if (!items?.length && !children?.length) return null;
  return { ...cat, items, children };
}

interface ItemRowProps {
  item: LibraryItem;
}

function ItemRow({ item }: ItemRowProps) {
  const activeTool = useCanvasStore((s) => s.activeTool);
  const setActiveTool = useCanvasStore((s) => s.setActiveTool);
  const isActive = activeTool === `place:${item.id}`;

  // Клик по активной кнопке — повторное нажатие отключает инструмент (toggle).
  const handleClick = (): void => {
    setActiveTool(isActive ? 'select' : `place:${item.id}`);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      title={`Разместить: ${item.name}`}
      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-left transition-colors ${
        isActive
          ? 'bg-primary text-white hover:bg-primary-hover'
          : 'text-text-secondary hover:bg-background hover:text-text-primary'
      }`}
    >
      <LibIcon name={item.icon} />
      <span className="truncate">{item.name}</span>
    </button>
  );
}

interface CategoryBlockProps {
  category: LibraryCategory;
  defaultOpen: boolean;
  forceOpen: boolean; // при активном поиске раскрываем всё
}

function CategoryBlock({ category, defaultOpen, forceOpen }: CategoryBlockProps) {
  const [open, setOpen] = useState(defaultOpen);
  const expanded = forceOpen || open;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm font-medium text-text-primary hover:bg-background transition-colors"
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <LibIcon name={category.icon} size={15} />
        <span className="truncate">{category.name}</span>
      </button>

      {expanded && (
        <div className="ml-3 border-l border-border pl-2 mb-1">
          {category.items?.map((item) => (
            <ItemRow key={item.id} item={item} />
          ))}
          {category.children?.map((child) => (
            <CategoryBlock
              key={child.id}
              category={child}
              defaultOpen={false}
              forceOpen={forceOpen}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ObjectLibrary() {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return OBJECT_LIBRARY;
    return OBJECT_LIBRARY.map((cat) => filterCategory(cat, q)).filter(
      (cat): cat is LibraryCategory => cat !== null,
    );
  }, [query]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-2 border-b border-border">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по библиотеке…"
            className="w-full pl-7 pr-2 py-1.5 text-xs rounded-md bg-background border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-1 space-y-0.5">
        {filtered.length === 0 && (
          <p className="text-xs text-text-muted p-3 text-center">Ничего не найдено</p>
        )}
        {filtered.map((cat, index) => (
          <CategoryBlock
            key={cat.id}
            category={cat}
            defaultOpen={index === 0}
            forceOpen={query.trim().length > 0}
          />
        ))}
      </div>

      <div className="p-2 border-t border-border text-[11px] text-text-muted leading-snug">
        Выберите объект и кликните по схеме, чтобы разместить его. Повторный клик по кнопке или Esc — выход из режима размещения.
      </div>
    </div>
  );
}

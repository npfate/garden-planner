import { MousePointer2, Square, Circle, Type, Trash2 } from 'lucide-react';

type ToolId = 'pointer' | 'square' | 'circle' | 'text' | 'eraser';

const TOOLS: Array<{ id: ToolId; label: string; icon: typeof MousePointer2 }> = [
  { id: 'pointer', label: 'Указатель', icon: MousePointer2 },
  { id: 'square', label: 'Прямоугольник', icon: Square },
  { id: 'circle', label: 'Круг', icon: Circle },
  { id: 'text', label: 'Текст', icon: Type },
  { id: 'eraser', label: 'Ластик', icon: Trash2 },
];

export default function Toolbar() {
  return (
    <header className="h-12 flex items-center gap-2 px-4 panel z-10 flex-shrink-0">
      <div className="font-bold text-text-primary mr-6 select-none">
        🌱 GardenPlanner Pro
      </div>
      <nav className="flex items-center gap-1" role="toolbar" aria-label="Инструменты рисования">
        {TOOLS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            title={label}
            aria-label={label}
            className={`w-9 h-9 flex items-center justify-center rounded-md border border-border text-text-secondary hover:text-text-primary hover:bg-background transition-colors ${
              id === 'pointer' ? 'bg-background text-primary border-primary' : ''
            }`}
          >
            <Icon size={18} />
          </button>
        ))}
      </nav>
    </header>
  );
}

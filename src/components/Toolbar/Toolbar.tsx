import { MousePointer2, Square, Circle, Type, Trash2, ZoomIn, ZoomOut } from 'lucide-react';
import { useGardenStore } from '../../store/gardenStore';

type ToolId = 'pointer' | 'square' | 'circle' | 'text' | 'eraser';

const TOOLS: Array<{ id: ToolId; label: string; icon: typeof MousePointer2 }> = [
  { id: 'pointer', label: 'Указатель', icon: MousePointer2 },
  { id: 'square', label: 'Прямоугольник', icon: Square },
  { id: 'circle', label: 'Круг', icon: Circle },
  { id: 'text', label: 'Текст', icon: Type },
  { id: 'eraser', label: 'Ластик', icon: Trash2 },
];

export default function Toolbar() {
  const scale = useGardenStore((s) => s.scale);
  const setScale = useGardenStore((s) => s.setScale);

  const zoomBy = (factor: number): void => {
    setScale(Math.round(scale * factor));
  };

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

      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          title="Уменьшить масштаб"
          aria-label="Уменьшить масштаб"
          onClick={() => zoomBy(1 / 1.1)}
          disabled={scale <= 10}
          className="w-9 h-9 flex items-center justify-center rounded-md border border-border text-text-secondary hover:text-text-primary hover:bg-background transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ZoomOut size={18} />
        </button>
        <div className="min-w-[52px] text-center text-sm font-medium text-text-primary px-2 select-none">
          {scale}%
        </div>
        <button
          type="button"
          title="Увеличить масштаб"
          aria-label="Увеличить масштаб"
          onClick={() => zoomBy(1.1)}
          disabled={scale >= 500}
          className="w-9 h-9 flex items-center justify-center rounded-md border border-border text-text-secondary hover:text-text-primary hover:bg-background transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ZoomIn size={18} />
        </button>
      </div>
    </header>
  );
}

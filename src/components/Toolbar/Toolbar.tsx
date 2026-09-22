import { useRef } from 'react';
import {
  MousePointer2,
  Hexagon,
  Type,
  Eraser,
  TreePine,
  Drum,
  Droplets,
  House,
  Warehouse,
  ZoomIn,
  ZoomOut,
  Image as ImageIcon,
  Lock,
  Unlock,
  Grid3X3,
} from 'lucide-react';
import { useGardenStore, type ToolId } from '../../store/gardenStore';

type ToolbarTool = {
  id: ToolId;
  label: string;
  icon: typeof MousePointer2;
};

const TOOLS: ToolbarTool[] = [
  { id: 'pointer', label: 'Указатель', icon: MousePointer2 },
  { id: 'polygon', label: 'Полигон', icon: Hexagon },
  { id: 'text', label: 'Текст', icon: Type },
  { id: 'eraser', label: 'Ластик', icon: Eraser },
  { id: 'tree', label: 'Дерево', icon: TreePine },
  { id: 'barrel', label: 'Бочка', icon: Drum },
  { id: 'well', label: 'Колодец', icon: Droplets },
  { id: 'greenhouse', label: 'Теплица', icon: House },
  { id: 'shed', label: 'Сарай', icon: Warehouse },
];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function Toolbar() {
  const scale = useGardenStore((s) => s.scale);
  const activeTool = useGardenStore((s) => s.activeTool);
  const snapToGrid = useGardenStore((s) => s.snapToGrid);
  const backgroundLocked = useGardenStore((s) => s.backgroundLocked);
  const hasBackground = useGardenStore((s) => !!s.backgroundImage);
  const setScale = useGardenStore((s) => s.setScale);
  const setActiveTool = useGardenStore((s) => s.setActiveTool);
  const setSnapToGrid = useGardenStore((s) => s.setSnapToGrid);
  const setBackgroundImage = useGardenStore((s) => s.setBackgroundImage);
  const setBackgroundLocked = useGardenStore((s) => s.setBackgroundLocked);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const zoomBy = (factor: number): void => {
    setScale(Math.round(scale * factor));
  };

  const onPickFile = async (evt: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = evt.target.files?.[0];
    evt.target.value = '';
    if (!file) return;
    const base64 = await fileToBase64(file);
    setBackgroundImage(base64);
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
            onClick={() => setActiveTool(id)}
            className={`w-9 h-9 flex items-center justify-center rounded-md border border-border text-text-secondary hover:text-text-primary hover:bg-background transition-colors ${
              activeTool === id ? 'bg-background text-primary border-primary' : ''
            }`}
          >
            <Icon size={18} />
          </button>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          title={snapToGrid ? 'Отключить привязку к сетке' : 'Включить привязку к сетке'}
          aria-label={snapToGrid ? 'Отключить привязку к сетке' : 'Включить привязку к сетке'}
          onClick={() => setSnapToGrid(!snapToGrid)}
          className={`w-9 h-9 flex items-center justify-center rounded-md border border-border transition-colors ${
            snapToGrid
              ? 'bg-primary text-white border-primary hover:bg-primary-hover'
              : 'text-text-secondary hover:text-text-primary hover:bg-background'
          }`}
        >
          <Grid3X3 size={18} />
        </button>
        <div className="flex items-center gap-1 mr-2 pr-3 border-r border-border">
          <button
            type="button"
            title="Загрузить фон"
            aria-label="Загрузить фон"
            onClick={() => fileInputRef.current?.click()}
            className="w-9 h-9 flex items-center justify-center rounded-md border border-border text-text-secondary hover:text-text-primary hover:bg-background transition-colors"
          >
            <ImageIcon size={18} />
          </button>
          <button
            type="button"
            title={backgroundLocked ? 'Открепить фон' : 'Закрепить фон'}
            aria-label={backgroundLocked ? 'Открепить фон' : 'Закрепить фон'}
            disabled={!hasBackground}
            onClick={() => setBackgroundLocked(!backgroundLocked)}
            className={`w-9 h-9 flex items-center justify-center rounded-md border border-border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              backgroundLocked
                ? 'bg-primary text-white border-primary hover:bg-primary-hover'
                : 'text-text-secondary hover:text-text-primary hover:bg-background'
            }`}
          >
            {backgroundLocked ? <Lock size={18} /> : <Unlock size={18} />}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={onPickFile}
            className="hidden"
          />
        </div>

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

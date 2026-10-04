import { useRef } from 'react';
import {
  MousePointer2,
  Square,
  Hand,
  Sprout,
  ZoomIn,
  ZoomOut,
  Image as ImageIcon,
  Lock,
  Unlock,
  Grid3X3,
  Save,
  FolderOpen,
} from 'lucide-react';
import { useCanvasStore, useGardenStore, type ToolId } from '../../store/gardenStore';
import { downloadTextFile, fileToBase64, readFileAsText } from '../../utils/fileIO';

type ToolbarTool = {
  id: ToolId;
  label: string;
  icon: typeof MousePointer2;
};

const TOOLS: ToolbarTool[] = [
  { id: 'select', label: 'Выделение', icon: MousePointer2 },
  { id: 'pan', label: 'Рука (Перемещение схемы)', icon: Hand },
  { id: 'bed', label: 'Грядка', icon: Square },
  { id: 'tree', label: 'Добавить дерево', icon: Sprout },
];

const btnClass =
  'w-9 h-9 flex items-center justify-center rounded-md border border-border text-text-secondary hover:text-text-primary hover:bg-background transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

export default function Toolbar() {
  const scale = useCanvasStore((s) => s.scale);
  const activeTool = useCanvasStore((s) => s.activeTool);
  const snapToGrid = useCanvasStore((s) => s.snapToGrid);
  const backgroundLocked = useCanvasStore((s) => s.backgroundLocked);
  const hasBackground = useCanvasStore((s) => !!s.backgroundImage);
  const setScale = useCanvasStore((s) => s.setScale);
  const setActiveTool = useCanvasStore((s) => s.setActiveTool);
  const setSnapToGrid = useCanvasStore((s) => s.setSnapToGrid);
  const setBackgroundImage = useCanvasStore((s) => s.setBackgroundImage);
  const setBackgroundLocked = useCanvasStore((s) => s.setBackgroundLocked);

  const saveToFile = useGardenStore((s) => s.saveToFile);
  const loadFromFile = useGardenStore((s) => s.loadFromFile);

  const bgInputRef = useRef<HTMLInputElement | null>(null);
  const gardenInputRef = useRef<HTMLInputElement | null>(null);

  const zoomBy = (factor: number): void => {
    setScale(Math.round(scale * factor));
  };

  const onPickBackground = async (evt: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = evt.target.files?.[0];
    evt.target.value = '';
    if (!file) return;
    setBackgroundImage(await fileToBase64(file));
  };

  const onSaveProject = (): void => {
    downloadTextFile(saveToFile(), 'garden.garden');
  };

  const onLoadProject = async (evt: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = evt.target.files?.[0];
    evt.target.value = '';
    if (!file) return;
    try {
      loadFromFile(await readFileAsText(file));
    } catch {
      alert('Не удалось прочитать файл .garden — проверьте формат.');
    }
  };

  return (
    <header className="h-12 flex items-center gap-2 px-4 panel z-10 flex-shrink-0">
      <div className="font-bold text-text-primary mr-6 select-none">🌱 GardenPlanner Pro</div>
      <nav className="flex items-center gap-1" role="toolbar" aria-label="Инструменты рисования">
        {TOOLS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            title={
              id === 'bed' || id === 'tree'
                ? `${label} — несколько подряд; Esc или повторный клик по кнопке — выход (Shift+drag — двигать объект)`
                : label
            }
            aria-label={label}
            onClick={() => setActiveTool(activeTool === id ? 'select' : id)}
            className={`${btnClass} ${activeTool === id ? 'bg-primary text-white border-primary' : ''}`}
          >
            <Icon size={18} />
          </button>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          title="Сохранить проект (.garden)"
          aria-label="Сохранить проект"
          onClick={onSaveProject}
          className={btnClass}
        >
          <Save size={18} />
        </button>
        <button
          type="button"
          title="Открыть проект (.garden)"
          aria-label="Открыть проект"
          onClick={() => gardenInputRef.current?.click()}
          className={btnClass}
        >
          <FolderOpen size={18} />
        </button>
        <input
          ref={gardenInputRef}
          type="file"
          accept=".garden,application/json"
          onChange={onLoadProject}
          className="hidden"
        />

        <div className="mx-2 w-px h-6 bg-border" />

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
            onClick={() => bgInputRef.current?.click()}
            className={btnClass}
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
            ref={bgInputRef}
            type="file"
            accept="image/*"
            onChange={onPickBackground}
            className="hidden"
          />
        </div>

        <button
          type="button"
          title="Уменьшить масштаб"
          aria-label="Уменьшить масштаб"
          onClick={() => zoomBy(1 / 1.1)}
          disabled={scale <= 10}
          className={btnClass}
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
          className={btnClass}
        >
          <ZoomIn size={18} />
        </button>
      </div>
    </header>
  );
}

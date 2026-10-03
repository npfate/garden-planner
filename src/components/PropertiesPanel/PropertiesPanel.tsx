import type { ReactNode } from 'react';
import { ThumbsDown, ThumbsUp, Trash2 } from 'lucide-react';
import { useGardenStore } from '../../store/gardenStore';
import type { VarietyRating } from '../../types/garden';

interface FieldRowProps {
  label: string;
  readOnly?: boolean;
  children: ReactNode;
}

function FieldRow({ label, readOnly, children }: FieldRowProps) {
  return (
    <div className="space-y-1">
      <label className="block text-xs uppercase tracking-wide text-text-secondary">{label}</label>
      {children ?? (
        <span className={readOnly ? 'text-text-secondary' : ''}>{String(children)}</span>
      )}
    </div>
  );
}

const inputClass =
  'w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary';
const readonlyClass =
  'w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-text-secondary';

export default function PropertiesPanel() {
  const object = useGardenStore((s) => s.objects.find((item) => item.id === s.selectedObjectId) ?? null);
  const currentYear = useGardenStore((s) => s.currentYear);
  const updateObject = useGardenStore((s) => s.updateObject);
  const removeObject = useGardenStore((s) => s.removeObject);

  if (!object) {
    return (
      <aside className="w-[300px] panel z-10 flex flex-col flex-shrink-0">
        <div className="panel-header">Свойства</div>
        <div className="flex-1 p-6 flex items-center justify-center text-text-secondary text-center text-sm select-none">
          Выберите объект
        </div>
      </aside>
    );
  }

  const yearEntry = object.history[currentYear] ?? {};
  const rating: VarietyRating = yearEntry.rating ?? null;

  const setHistoryField = (
    updates: Partial<(typeof object.history)[number]>,
  ): void => {
    updateObject(object.id, {
      history: {
        ...object.history,
        [currentYear]: { ...yearEntry, ...updates },
      },
    });
  };

  const toggleRating = (value: Exclude<VarietyRating, null>): void => {
    setHistoryField({ rating: rating === value ? null : value });
  };

  return (
    <aside className="w-[300px] panel z-10 flex flex-col flex-shrink-0 overflow-y-auto">
      <div className="panel-header">Свойства</div>
      <div className="flex-1 p-4 space-y-4 text-sm text-text-primary">
        <FieldRow label="Название">
          <input
            type="text"
            value={object.name}
            onChange={(event) => updateObject(object.id, { name: event.target.value })}
            className={inputClass}
          />
        </FieldRow>

        <FieldRow label="Тип" readOnly>
          <input type="text" value={object.type} readOnly className={readonlyClass} />
        </FieldRow>

        <FieldRow label="Год посадки">
          <input
            type="number"
            value={object.year}
            onChange={(event) => updateObject(object.id, { year: Number(event.target.value) })}
            className={inputClass}
          />
        </FieldRow>

        <div className="grid grid-cols-2 gap-3">
          <FieldRow label="X" readOnly>
            <input type="text" value={Math.round(object.x)} readOnly className={readonlyClass} />
          </FieldRow>
          <FieldRow label="Y" readOnly>
            <input type="text" value={Math.round(object.y)} readOnly className={readonlyClass} />
          </FieldRow>
          <FieldRow label="Ширина" readOnly>
            <input type="text" value={Math.round(object.width)} readOnly className={readonlyClass} />
          </FieldRow>
          <FieldRow label="Высота" readOnly>
            <input type="text" value={Math.round(object.height)} readOnly className={readonlyClass} />
          </FieldRow>
        </div>

        <div className="border-t border-border pt-4 space-y-3">
          <div className="text-xs uppercase tracking-wide text-text-secondary">
            Урожай за {currentYear} год, кг
          </div>
          <input
            type="number"
            min={0}
            step={0.1}
            value={yearEntry.harvest ?? 0}
            onChange={(event) => setHistoryField({ harvest: Number(event.target.value) })}
            className={inputClass}
          />

          <div className="flex items-center gap-2">
            <button
              type="button"
              title="Нравится сорт"
              onClick={() => toggleRating('like')}
              className={`flex-1 h-9 flex items-center justify-center gap-2 rounded-md border transition-colors ${
                rating === 'like'
                  ? 'bg-primary text-white border-primary'
                  : 'border-border text-text-secondary hover:text-text-primary hover:bg-background'
              }`}
            >
              <ThumbsUp size={16} /> Нравится
            </button>
            <button
              type="button"
              title="Не нравится сорт"
              onClick={() => toggleRating('dislike')}
              className={`flex-1 h-9 flex items-center justify-center gap-2 rounded-md border transition-colors ${
                rating === 'dislike'
                  ? 'bg-red-500 text-white border-red-500'
                  : 'border-border text-text-secondary hover:text-text-primary hover:bg-background'
              }`}
            >
              <ThumbsDown size={16} /> Не нравится
            </button>
          </div>

          <textarea
            placeholder="Заметки по году…"
            value={yearEntry.notes ?? ''}
            onChange={(event) => setHistoryField({ notes: event.target.value })}
            rows={3}
            className={`${inputClass} resize-none`}
          />
        </div>

        <button
          type="button"
          onClick={() => removeObject(object.id)}
          className="w-full h-9 flex items-center justify-center gap-2 rounded-md border border-red-300 text-red-600 hover:bg-red-50 transition-colors"
        >
          <Trash2 size={16} /> Удалить объект
        </button>
      </div>
    </aside>
  );
}

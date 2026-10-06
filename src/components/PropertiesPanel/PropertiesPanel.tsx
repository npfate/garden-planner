import { useState } from 'react';
import type { ReactNode } from 'react';
import { Move, Plus, Shovel, ThumbsDown, ThumbsUp, Trash2, X } from 'lucide-react';
import { useGardenStore } from '../../store/gardenStore';
import { getLibraryItem, getCategoryName } from '../../constants/objectLibrary';
import type { PlantLifecycle, VarietyRating } from '../../types/garden';
import { formatDateRu, todayIso } from '../../utils/markers';
import { makeEvent } from '../../utils/wayback';

function makeHarvestEvent(name: string, kg: number, total: number) {
  return makeEvent('harvest', { id: '', name }, `Собран урожай ${name}: +${kg} кг (всего за год ${total} кг)`);
}

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
  const [harvestInput, setHarvestInput] = useState('');
  const [varietyInput, setVarietyInput] = useState('');
  const object = useGardenStore((s) => s.objects.find((item) => item.id === s.selectedObjectId) ?? null);
  const currentYear = useGardenStore((s) => s.currentYear);
  const updateObject = useGardenStore((s) => s.updateObject);
  const removeObject = useGardenStore((s) => s.removeObject);
  const destroyObject = useGardenStore((s) => s.destroyObject);
  const transplantObject = useGardenStore((s) => s.transplantObject);
  const addEvent = useGardenStore((s) => s.addEvent);
  const viewDate = useGardenStore((s) => s.viewDate);

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
    const next = rating === value ? null : value;
    setHistoryField({ rating: next });
    if (next) {
      addEvent(
        makeEvent(
          'rating',
          object,
          `Оценка сорта ${object.name}: ${next === 'like' ? '👍 нравится' : '👎 не нравится'} (${currentYear})`,
        ),
      );
    }
  };

  // Сбор урожая: сумма копится в history[currentYear].harvest + событие в журнал.
  const addHarvest = (kg: number): void => {
    if (kg <= 0) return;
    const total = (yearEntry.harvest ?? 0) + kg;
    updateObject(object.id, {
      history: { ...object.history, [currentYear]: { ...yearEntry, harvest: total } },
    });
    addEvent(makeHarvestEvent(object.name, kg, total));
  };

  // Сорта (плодовые деревья из Библиотеки: яблоня, груша и т.д.).
  // Добавление/удаление обновляет object.varieties через updateObject.
  const addVariety = (): void => {
    const name = varietyInput.trim();
    if (!name) return;
    if (object.varieties.some((v) => v.name.toLowerCase() === name.toLowerCase())) {
      setVarietyInput('');
      return;
    }
    updateObject(object.id, {
      varieties: [...object.varieties, { id: crypto.randomUUID(), name }],
    });
    setVarietyInput('');
  };
  const removeVariety = (id: string): void => {
    updateObject(object.id, { varieties: object.varieties.filter((v) => v.id !== id) });
  };

  // Пересадка одним действием: старая запись «выкапывается» в выбранную дату,
  // новая садится рядом со всеми сохранёнными свойствами (размер, тип, цикл).
  // Canvas подписан на событие garden:transplanted — добавит fabric-объект копии.
  const relocateNow = (): void => {
    const date = viewDate ?? todayIso();
    const next = transplantObject(object.id, date);
    window.dispatchEvent(new CustomEvent('garden:transplanted', { detail: next }));
  };

  // Выкопка: объект исчезает со схемы после сегодняшней даты, но остаётся
  // в истории wayback-машины (можно отматать назад и увидеть его на месте).
  const digOut = (): void => {
    removeObject(object.id);
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

        {/* Источник из Библиотеки объектов: показываем шаблон, по которому
            создан экземпляр, агросправку шаблона и даём возможность отвязать связь. */}
        {(() => {
          const tpl = object.libraryItemId ? getLibraryItem(object.libraryItemId) : undefined;
          if (!tpl) return null;
          const m = tpl.meta;
          return (
            <div className="rounded-md border border-emerald-200 bg-emerald-50/60 p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs uppercase tracking-wide text-emerald-700">
                    Шаблон (Библиотека)
                  </div>
                  <div className="text-sm font-medium text-text-primary">
                    {tpl.name} · {getCategoryName(tpl.category)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => updateObject(object.id, { libraryItemId: null })}
                  className="text-xs text-text-secondary hover:text-text-primary underline underline-offset-2 flex-shrink-0"
                  title="Отвязать объект от шаблона Библиотеки"
                >
                  Отвязать
                </button>
              </div>

              {m?.description && (
                <p className="text-xs leading-relaxed text-emerald-900">{m.description}</p>
              )}

              {m && (
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-emerald-900">
                  {typeof m.heightM === 'number' && (
                    <div className="flex gap-1">
                      <dt className="text-emerald-700">Высота:</dt>
                      <dd>{m.heightM} м</dd>
                    </div>
                  )}
                  {typeof m.spacingM === 'number' && (
                    <div className="flex gap-1">
                      <dt className="text-emerald-700">Отступ:</dt>
                      <dd>{m.spacingM} м</dd>
                    </div>
                  )}
                  {m.frostResistance && (
                    <div className="flex gap-1">
                      <dt className="text-emerald-700">Зимостойкость:</dt>
                      <dd>{m.frostResistance}</dd>
                    </div>
                  )}
                  {m.ripening && (
                    <div className="flex gap-1">
                      <dt className="text-emerald-700">Сроки:</dt>
                      <dd>{m.ripening}</dd>
                    </div>
                  )}
                </dl>
              )}
            </div>
          );
        })()}

        {typeof object.crownDiameter === 'number' && (
          <FieldRow label="Диаметр кроны / габарита, м">
            <input
              type="number"
              min={0}
              step={0.1}
              value={object.crownDiameter}
              onChange={(event) =>
                updateObject(object.id, { crownDiameter: Number(event.target.value) })
              }
              className={inputClass}
            />
          </FieldRow>
        )}

        {/* Сорта: актуально для плодовых деревьев из Библиотеки (яблоня и т.п.),
            но показываем для любого объекта — список ведёт пользователь. */}
        <FieldRow label={`Сорта (${object.varieties.length})`}>
          <div className="space-y-2">
            {object.varieties.length > 0 && (
              <ul className="space-y-1">
                {object.varieties.map((v) => (
                  <li
                    key={v.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-border bg-white px-2 py-1 text-sm"
                  >
                    <span className="truncate">{v.name}</span>
                    <button
                      type="button"
                      onClick={() => removeVariety(v.id)}
                      title="Удалить сорт"
                      className="text-text-secondary hover:text-red-600 flex-shrink-0"
                    >
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={varietyInput}
                onChange={(event) => setVarietyInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    addVariety();
                  }
                }}
                placeholder="Название сорта"
                className={inputClass}
              />
              <button
                type="button"
                onClick={addVariety}
                title="Добавить сорт"
                className="btn-primary h-9 !py-0 px-3 flex items-center gap-1 text-sm flex-shrink-0"
              >
                <Plus size={14} /> Добавить
              </button>
            </div>
          </div>
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
          <FieldRow label="Цикл">
            <select
              value={object.lifecycle ?? 'perennial'}
              onChange={(event) =>
                updateObject(object.id, { lifecycle: event.target.value as PlantLifecycle })
              }
              className={inputClass}
            >
              <option value="perennial">Многолетник</option>
              <option value="annual">Однолетник</option>
            </select>
          </FieldRow>
          <FieldRow label="Посажен">
            <input
              type="date"
              value={object.plantedAt ?? ''}
              onChange={(event) => updateObject(object.id, { plantedAt: event.target.value || null })}
              className={inputClass}
            />
          </FieldRow>
        </div>

        {/* Свойство «Пересажен» появляется только если объект действительно
            был пересажен (есть связь с прежним местом). */}
        {object.transplantedAt && (
          <div className="rounded-md bg-indigo-50 border border-indigo-200 px-3 py-2 text-xs text-indigo-800 flex items-center gap-2">
            <Move size={14} className="flex-shrink-0" />
            <span>
              Пересажен {formatDateRu(object.transplantedAt)}
              {object.transplantedFromId ? ' — на схеме показана стрелка от прежнего места' : ''}
            </span>
          </div>
        )}

        {object.removedAt && (
          <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
            Выкопан {formatDateRu(object.removedAt)} — виден на схеме до этого дня включительно,
            со следующего дня исчезает (история сохраняется)
          </div>
        )}

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
            Урожай за {currentYear} год, кг — всего {yearEntry.harvest ?? 0}
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              min={0}
              step={0.1}
              value={harvestInput}
              onChange={(event) => setHarvestInput(event.target.value)}
              placeholder="Сколько собрали"
              className={inputClass}
            />
            <button
              type="button"
              onClick={() => {
                addHarvest(Number(harvestInput));
                setHarvestInput('');
              }}
              className="btn-primary h-9 !py-0 text-sm whitespace-nowrap"
            >
              Собрать
            </button>
          </div>

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
            onBlur={() => {
              const note = (yearEntry.notes ?? '').trim();
              if (note) addEvent(makeEvent('note', object, `Заметка (${currentYear}): ${note}`));
            }}
            rows={3}
            className={`${inputClass} resize-none`}
          />
        </div>

        <button
          type="button"
          onClick={relocateNow}
          className="w-full h-9 flex items-center justify-center gap-2 rounded-md border border-border text-text-secondary hover:text-text-primary hover:bg-background transition-colors"
        >
          <Move size={16} /> Пересадить (сохранит свойства на новом месте)
        </button>

        <button
          type="button"
          onClick={digOut}
          className="w-full h-9 flex items-center justify-center gap-2 rounded-md border border-amber-300 text-amber-700 hover:bg-amber-50 transition-colors"
        >
          <Shovel size={16} /> Выкопать (останется в истории по годам)
        </button>

        <button
          type="button"
          onClick={() => destroyObject(object.id)}
          className="w-full h-9 flex items-center justify-center gap-2 rounded-md border border-red-300 text-red-600 hover:bg-red-50 transition-colors"
        >
          <Trash2 size={16} /> В корзину (уничтожить во всех годах)
        </button>
      </div>
    </aside>
  );
}

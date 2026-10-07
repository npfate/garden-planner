import { create } from 'zustand';
import type { Canvas as FabricCanvas } from 'fabric';
import type { ActivityEvent, GardenObject, IsoDate } from '../types/garden';
import { formatDateRu, isoYear, todayIso } from '../utils/markers';
import { filterVisible, makeEvent, momentOf } from '../utils/wayback';
import { ACTIVITY_META } from '../config/activity';
import { getLibraryItem, LIBRARY_ITEMS_FLAT } from '../constants/objectLibrary';

// Ключ runtime-идентификатора схемы на fabric-объекте. ДОЛЖЕН совпадать с
// GARDEN_ID_KEY в components/Canvas/fabricSync.ts. Раньше здесь был расхождение
// в написании ключа — поиск объекта по id всегда возвращал undefined, и
// focusOnObject из Инвентаря работал «по координатам» без реального выделения
// (пользователь видел рамку от прошлого выделения, а клики «не срабатывали»).
const GARDEN_ID_KEY = '__gardenObjectId';

// Поиск fabric-объекта по garden-id. Локальный хелпер (в components/Canvas/fabricSync
// такая же функция есть, но импорт оттуда создал бы цикл store -> components).
function findFabricObjectByGardenId(canvas: FabricCanvas, id: string) {
  return canvas.getObjects().find((o) => (o as unknown as Record<string, unknown>)[GARDEN_ID_KEY] === id);
}

// Инструменты тулбара + динамические инструменты размещения из Библиотеки
// объектов: 'place:<itemId>' (см. src/constants/objectLibrary.ts).
export type ToolId = 'select' | 'pan' | 'bed' | 'tree' | `place:${string}`;

export interface GardenFileSnapshot {
  version: number;
  savedAt: string;
  objects: GardenObject[];
  events: ActivityEvent[];
  backgroundImage: string | null;
  currentYear: number;
  // Wayback: дата просмотра на момент сохранения (не обязательна в старых файлах)
  viewDate?: IsoDate | null;
  scale: number;
  snapToGrid: boolean;
  activeTool: ToolId;
}

interface GardenState {
  objects: GardenObject[];
  currentYear: number;
  // Wayback machine: дата просмотра схемы (внутри currentYear).
  // null = «конец года» (годовой режим без точной даты).
  viewDate: IsoDate | null;
  events: ActivityEvent[];
  selectedObjectId: string | null;
  canvas: FabricCanvas | null;
}

interface GardenActions {
  /** Восстановление снапшота (localStorage / .garden). Поддерживает legacy-формат
   *  без поля events (журнал появился позже) — тогда события остаются как есть. */
  restoreSnapshot: (json: string) => void;
  addObject: (obj: GardenObject) => void;
  updateObject: (id: string, updates: Partial<GardenObject>) => void;
  /** Выкопка (soft-delete): removedAt = дата, объект исчезает со схемы после неё,
   *  но остаётся в истории wayback-машины. */
  removeObject: (id: string) => void;
  /** «В корзину» — полное уничтожение объекта из всех годов и из истории. */
  destroyObject: (id: string) => void;
  relocateObject: (id: string, date: IsoDate) => void;
  /** Пересадка одним действием: старая запись «выкапывается», новая садится
   *  с сохранёнными свойствами (размер, тип, цикл, название). */
  transplantObject: (id: string, date: IsoDate) => GardenObject | null;
  addEvent: (event: ActivityEvent) => void;
  setObjects: (objects: GardenObject[]) => void;
  setYear: (year: number) => void;
  setViewDate: (date: IsoDate | null) => void;
  selectObject: (id: string | null) => void;
  /** Фокус камеры на объекте из Инвентаря: выделить, отцентрировать вьюпорт. */
  focusOnObject: (id: string) => void;
  setCanvas: (canvas: FabricCanvas | null) => void;
  visibleObjects: () => GardenObject[];
  /** Кэш селектора visibleObjects для React-подписок (стабильная ссылка). */
  _visibleCache: { objects: GardenObject[]; year: number; date: IsoDate | null; result: GardenObject[] } | null;
  /** Кэшированный вариант visibleObjects() для React-подписок (стабильная ссылка). */
  getVisibleObjects: () => GardenObject[];
  saveToFile: () => string;
  loadFromFile: (json: string) => void;
}

export type GardenStore = GardenState & GardenActions;

// Год по умолчанию — текущий (не захардкожен).
const CURRENT_YEAR_DEFAULT = Number(todayIso().slice(0, 4));

// Единый момент «сейчас» для всей временнóй логики. Раньше годовой режим
// (viewDate === null) трактовался как «конец года» (YYYY-12-31), а UI показывал
// сегодняшнюю дату — из-за этого объекты при перемотке вели себя несогласованно.
// Теперь: если точная дата просмотра не выбрана, смотрим на сад «сегодня».
// Реализация — в utils/wayback.momentOf (переэкспортируем для совместности).
export { momentOf } from '../utils/wayback';


export const useGardenStore = create<GardenStore>((set, get) => ({
  objects: [],
  currentYear: CURRENT_YEAR_DEFAULT,
  viewDate: null,
  events: [],
  selectedObjectId: null,
  canvas: null,

  addObject: (obj: GardenObject): void => {
    set((state) => ({
      objects: [...state.objects, { ...obj, updatedAt: new Date().toISOString() }],
    }));
    get().addEvent(
      makeEvent('planted', obj, `Посадка: ${obj.name} (${formatDateRu(obj.plantedAt ?? todayIso())})`),
    );
  },

  updateObject: (id: string, updates: Partial<GardenObject>): void => {
    set((state) => ({
      objects: state.objects.map((o) =>
        o.id === id ? { ...o, ...updates, updatedAt: new Date().toISOString() } : o,
      ),
    }));
  },

  removeObject: (id: string): void => {
    const obj = get().objects.find((o) => o.id === id);
    if (!obj) return;
    // Выкопка (soft-delete): removedAt = дата *последнего дня жизни* —
    // объект исчезает со схемы начиная со следующего дня после этой даты,
    // но остаётся в истории (можно отматать назад и увидеть, что он рос здесь).
    // Дата берётся из текущего момента просмотра (wayback), а не системных
    // часов: если смотрим на сад, например, на 4 августа и нажимаем «выкопать»,
    // дерево должно пропасть с 5-го числа именно того года, который открыт.
    // Если дата выкопки уже стоит и она раньше выбранной — не затираем:
    // иначе «выкопанное в мае» внезапно ожило бы к августу.
    const date = momentOf(get().viewDate);
    set((state) => ({
      objects: state.objects.map((o) =>
        o.id === id && (!o.removedAt || o.removedAt > date) ? { ...o, removedAt: date } : o,
      ),
    }));
    // Событие пишем только если дата выкопки реально установлена/обновлена
    // (повторное «выкопать» не должно плодить дубли в журнале).
    const updated = get().objects.find((o) => o.id === id);
    if (updated?.removedAt === date) {
      get().addEvent(makeEvent('dug', obj, `Выкопан: ${obj.name}, ${formatDateRu(date)} (остался в истории)`, date));
    }
  },

  // «В корзину»: полное уничтожение объекта во всех временнóх срезах.
  destroyObject: (id: string): void => {
    const obj = get().objects.find((o) => o.id === id);
    set((state) => ({
      objects: state.objects.filter((o) => o.id !== id),
      selectedObjectId: state.selectedObjectId === id ? null : state.selectedObjectId,
    }));
    if (obj) {
      get().addEvent(makeEvent('destroyed', obj, `Уничтожен (в корзину): ${obj.name}`));
    }
  },

  // Пересадка: в указанный день объект «исчезает» со старого места.
  // Пользователь тут же рисует новый объект (новая дата посадки) — на новом месте.
  relocateObject: (id: string, date: IsoDate): void => {
    const obj = get().objects.find((o) => o.id === id);
    if (!obj) return;
    set((state) => ({
      objects: state.objects.map((o) => (o.id === id ? { ...o, removedAt: date } : o)),
      selectedObjectId: null,
    }));
    get().addEvent(
      makeEvent(
        'moved',
        obj,
        `Пересадка: ${obj.name} выкопан ${formatDateRu(date)} — посадите его заново в новом месте`,
        date,
      ),
    );
  },

  // Пересадка одним действием: старая запись «выкапывается» в date,
  // новая сажается рядом с полным сохранением свойств (тип, название, размер,
  // цикл, иконка) и датированной историей. Возвращает новую запись —
  // вызывающий добавит её на canvas.
  // Связь мест: old.transplantedToId ↔ new.transplantedFromId + transplantedAt
  // (canvas рисует по ней пунктирную стрелку «откуда → куда»).
  transplantObject: (id: string, date: IsoDate): GardenObject | null => {
    const obj = get().objects.find((o) => o.id === id);
    if (!obj) return null;
    const now = new Date().toISOString();
    const nextId = crypto.randomUUID();
    const next: GardenObject = {
      ...obj,
      id: nextId,
      x: obj.x + 30,
      y: obj.y + 30,
      year: isoYear(date) ?? obj.year,
      plantedAt: date,
      removedAt: null,
      // история переносится к новому объекту (урожай/оценки не теряются)
      history: { ...obj.history },
      transplantedFromId: obj.id,
      transplantedToId: null,
      transplantedAt: date,
      createdAt: now,
      updatedAt: now,
    };
    set((state) => ({
      objects: state.objects.map((o) =>
        o.id === id ? { ...o, removedAt: date, transplantedToId: nextId, updatedAt: now } : o,
      ),
    }));
    get().addObject(next);
    get().addEvent(
      makeEvent(
        'moved',
        obj,
        `Пересадка: ${obj.name} → новое место, посажен ${formatDateRu(date)}`,
        date,
      ),
    );
    return next;
  },

  addEvent: (event: ActivityEvent): void => {
    set((state) => ({
      events: [...state.events, event].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)),
    }));
  },

  setObjects: (objects: GardenObject[]): void => {
    set({ objects });
  },

  // Смена года сохраняет день и месяц выбранной даты просмотра
  // (годовой режим больше не «рушит» дневной срез). Если дата не выбрана —
  // просто переключаем год, «сейчас» остаётся сегодняшним числом.
  setYear: (year: number): void => {
    set((state) => {
      if (!state.viewDate) return { currentYear: year };
      const [, m, d] = state.viewDate.split('-');
      // 29 февраля переносим на 28, если целевой год невисокосный
      const lastDay = new Date(Date.UTC(year, Number(m), 0)).getUTCDate();
      const safeDay = String(Math.min(Number(d), lastDay)).padStart(2, '0');
      const next = `${year}-${m}-${safeDay}` as IsoDate;
      return { currentYear: year, viewDate: next };
    });
  },

  setViewDate: (date: IsoDate | null): void => {
    const y = isoYear(date);
    set((state) => ({
      viewDate: date,
      currentYear: date && y !== null ? y : state.currentYear,
    }));
  },

  selectObject: (id: string | null): void => {
    set({ selectedObjectId: id });
  },

  // Фокус камеры по клику в Инвентаре. Реализация через fabric-объект, если он
  // есть на холсте; иначе — по координатам из стора (объект может быть скрыт
  // wayback-фильтром, но камера всё равно покажет его место).
  focusOnObject: (id: string): void => {
    const state = get();
    // Если активен инструмент размещения (Библиотека/тулбар), клик в Инвентаре
    // должен переключить на «Выделение», иначе сразу после фокуса канвас
    // проигнорирует выделение («выделяется другое место»).
    useCanvasStore.getState().setActiveTool('select');
    // Клик по пустому месту вне холста не порождает событие selection:cleared,
    // поэтому снимаем выделение с канваса вручную — иначе рамка выделения
    // останется на старом объекте, а Инвентарь подсветит другой.
    // Но если цель уже выделена (повторный клик в Инвентаре), ничего не
    // сбрасываем: иначе discardActiveObject() породил бы selection:cleared →
    // selectObject(null) и «закрутился» бы цикл перерисовок (белый экран).
    if (state.canvas && state.selectedObjectId !== id) {
      state.canvas.discardActiveObject();
    }
    set({ selectedObjectId: id });
    const canvas = state.canvas;
    if (!canvas) return;
    const entry = state.objects.find((o) => o.id === id);
    if (!entry) return;
    // Центр считаем из записи store — это единственный источник истины.
    // getCenterPoint() у fabric-объекта при originX/'Y' = 'center' возвращает
    // смещённую точку (левый верхний угол вместо центра), поэтому к нему
    // обращаться нельзя.
    const cx = entry.x + entry.width / 2;
    const cy = entry.y + entry.height / 2;
    // Порядок критичен: сначала двигаем камеру, и только потом выделяем объект.
    // Иначе control-точки рамки выделения вычисляются в старых координатах
    // вьюпорта и рамка «появляется не в том месте», а при первом клике по
    // ручке пересчитывается и «перепрыгивает» на объект.
    const zoom = canvas.getZoom() || 1;
    const vpt = canvas.viewportTransform;
    if (!vpt) return;
    vpt[0] = zoom;
    vpt[3] = zoom;
    vpt[4] = (canvas.getWidth() ?? 0) / 2 - cx * zoom;
    vpt[5] = (canvas.getHeight() ?? 0) / 2 - cy * zoom;
    // setViewportTransform пересчитывает геометрию контрол-точек всех объектов
    // под новый вьюпорт (прямое присваивание vpt этого не делает).
    canvas.setViewportTransform(vpt);

    // Выделение ставим ПОСЛЕ камеры — тогда oCorners/рамка рисуются уже в
    // правильных экранных координатах.
    const fabricObj = findFabricObjectByGardenId(canvas, id);
    if (fabricObj) canvas.setActiveObject(fabricObj);
    canvas.requestRenderAll();
  },

  setCanvas: (canvas: FabricCanvas | null): void => {
    set({ canvas });
  },

  // Объекты, видимые «на этот момент времени» (год + опциональная дата).
  // Правило пересадок: у объекта, который был пересажен (transplantedToId),
  // «живёт» только последняя запись цепочки — промежуточные места сами по
  // себе на схеме не показываются (их видно через стрелку-подсказку при
  // клике на актуальный объект). Если же пересаженный объект позже выкопан
  // («выкопать» без новой посадки), его старое место снова становится
  // актуальным и рисуется.
  visibleObjects: (): GardenObject[] => {
    const { objects, currentYear, viewDate } = get();
    return filterVisible(objects, currentYear, viewDate);
  },

  // Кэш селектора для React-подписок (useSyncExternalStore): возвращает ту же
  // ссылку на массив, пока входные данные (objects/currentYear/viewDate) не
  // менялись. Без этого Inventory получал новый массив при каждом рендере ->
  // "getSnapshot should be cached" и бесконечный цикл обновлений.
  _visibleCache: null as { objects: GardenObject[]; year: number; date: IsoDate | null; result: GardenObject[] } | null,
  getVisibleObjects: (): GardenObject[] => {
    const { objects, currentYear, viewDate, _visibleCache } = get();
    if (_visibleCache && _visibleCache.objects === objects && _visibleCache.year === currentYear && _visibleCache.date === viewDate) {
      return _visibleCache.result;
    }
    const result = filterVisible(objects, currentYear, viewDate);
    set({ _visibleCache: { objects, year: currentYear, date: viewDate, result } }, false);
    return result;
  },

  // Собирает снапшот, подтягивая не-доменные поля из canvasStore.
  // Используется ленивый import через getState, чтобы избежать циклической зависимости.
  saveToFile: (): string => {
    const state: GardenStore = get();
    const cs = useCanvasStore.getState();
    const snapshot: GardenFileSnapshot = {
      version: 1,
      savedAt: new Date().toISOString(),
      objects: state.objects,
      events: state.events,
      backgroundImage: cs.backgroundImage,
      currentYear: state.currentYear,
      viewDate: state.viewDate,
      scale: cs.scale,
      snapToGrid: cs.snapToGrid,
      activeTool: cs.activeTool,
    };
    return JSON.stringify(snapshot, null, 2);
  },

  // Восстановление автосейва: то же, что loadFromFile, но если в снапшоте
  // отсутствует поле events (legacy-формат, сохранённый до появления журнала),
  // текущий журнал НЕ затирается — иначе события «пропадали» после F5.
  restoreSnapshot: (json: string): void => {
    let hasEvents: boolean;
    try {
      const parsed: unknown = JSON.parse(json);
      hasEvents = !!parsed && typeof parsed === 'object' && Array.isArray((parsed as Partial<GardenFileSnapshot>).events);
    } catch {
      return; // повреждённый снапшот — игнорируем
    }
    if (!hasEvents) {
      // legacy-снапшот: подтягиваем объекты/год, события оставляем как есть
      const prevEvents = get().events;
      get().loadFromFile(json);
      set({ events: prevEvents });
      return;
    }
    get().loadFromFile(json);
  },

  loadFromFile: (json: string): void => {
    try {
      const parsed: unknown = JSON.parse(json);
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Invalid file format');
      }
      const p = parsed as Partial<GardenFileSnapshot>;
      const rawObjects: GardenObject[] = Array.isArray(p.objects) ? p.objects : [];
      // Миграция объектов из старых .garden-файлов (до Спринта 5): поля
      // libraryItemId / crownDiameter отсутствовали. Подтягиваем дефолты из
      // Библиотеки объектов по типу, чтобы Инвентарь и Панель свойств
      // корректно группировали и отображали legacy-экземпляры.
      // Строим карту «тип объекта -> первый подходящий шаблон» один раз из
      // LIBRARY_ITEMS_FLAT: если в библиотеке появятся новые типы (tree,
      // seedling, flower...), миграция подхватит их автоматически.
      const TYPE_TO_LIBRARY_ITEM: Partial<Record<GardenObject['type'], string>> = {};
      for (const item of LIBRARY_ITEMS_FLAT) {
        if (!(item.objectType in TYPE_TO_LIBRARY_ITEM)) {
          TYPE_TO_LIBRARY_ITEM[item.objectType] = item.id;
        }
      }
      const objects: GardenObject[] = rawObjects.map((o) => {
        if (!o.libraryItemId) {
          const fallbackId = TYPE_TO_LIBRARY_ITEM[o.type];
          const tpl = fallbackId ? getLibraryItem(fallbackId) : undefined;
          return {
            ...o,
            libraryItemId: fallbackId ?? null,
            crownDiameter: o.crownDiameter ?? (tpl?.defaultProperties['crownDiameter'] as number | undefined),
          };
        }
        return {
          ...o,
          crownDiameter: o.crownDiameter ?? (getLibraryItem(o.libraryItemId)?.defaultProperties['crownDiameter'] as number | undefined),
        };
      });
      // Миграция legacy-снапшотов (старый localStorage / .garden): события могли
      // содержать kind из ранней схемы ('created', 'deleted') или без kind вовсе.
      // Маппим в актуальную ActivityKind, иначе UI падает на неизвестном ключе.
      const LEGACY_KIND_MAP: Record<string, ActivityEvent['kind']> = {
        created: 'planted',
        deleted: 'destroyed',
        add: 'planted',
        remove: 'destroyed',
        transplant: 'moved',
      };
      const rawEvents: ActivityEvent[] = Array.isArray(p.events) ? p.events : [];
      const events: ActivityEvent[] = rawEvents.map((ev) => {
        if (ev && ACTIVITY_META[ev.kind]) return ev;
        const mapped = ev && LEGACY_KIND_MAP[String(ev.kind)] ? LEGACY_KIND_MAP[String(ev.kind)] : 'note';
        return { ...ev, kind: mapped };
      });
      const currentYear: number =
        typeof p.currentYear === 'number' ? p.currentYear : CURRENT_YEAR_DEFAULT;
      // Восстанавливаем дату просмотра из снапшота (если она валидная) —
      // иначе после F5 wayback-состояние терялось и объекты «пропадали».
      const viewDate: IsoDate | null =
        typeof p.viewDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.viewDate)
          ? (p.viewDate as IsoDate)
          : null;
      set({ objects, events, currentYear, viewDate, selectedObjectId: null });
      const cs = useCanvasStore.getState();
      if (typeof p.backgroundImage === 'string') cs.setBackgroundImage(p.backgroundImage);
      else cs.setBackgroundImage(null);
      if (typeof p.scale === 'number') cs.setScale(p.scale);
      if (typeof p.snapToGrid === 'boolean') cs.setSnapToGrid(p.snapToGrid);
      if (typeof p.activeTool === 'string' && TOOL_IDS.includes(p.activeTool as ToolId)) {
        cs.setActiveTool(p.activeTool as ToolId);
      } else {
        cs.setActiveTool('select');
      }
    } catch (err) {
      console.error('Ошибка загрузки .garden файла:', err);
      throw err;
    }
  },
}));

// --- Canvas/UI-домен (сетка, зум, инструменты, фон) ---

interface CanvasState {
  scale: number;
  gridStep: number;
  snapToGrid: boolean;
  activeTool: ToolId;
  backgroundImage: string | null;
  backgroundLocked: boolean;
}

interface CanvasActions {
  setScale: (scale: number) => void;
  setGridStep: (step: number) => void;
  setSnapToGrid: (value: boolean) => void;
  setActiveTool: (tool: ToolId) => void;
  setBackgroundImage: (url: string | null) => void;
  setBackgroundLocked: (locked: boolean) => void;
}

export type CanvasStore = CanvasState & CanvasActions;

const TOOL_IDS: ToolId[] = ['select', 'pan', 'bed', 'tree'];

export const useCanvasStore = create<CanvasStore>((set) => ({
  scale: 100,
  gridStep: 1,
  snapToGrid: false,
  activeTool: 'select',
  backgroundImage: null,
  backgroundLocked: false,

  setScale: (scale: number): void => {
    set({ scale: Math.max(10, Math.min(1000, scale)) });
  },

  setGridStep: (step: number): void => {
    set({ gridStep: Math.max(0.1, step) });
  },

  setSnapToGrid: (value: boolean): void => {
    set({ snapToGrid: value });
  },

  setActiveTool: (tool: ToolId): void => {
    set({ activeTool: tool });
  },

  setBackgroundImage: (url: string | null): void => {
    set({ backgroundImage: url });
  },

  setBackgroundLocked: (locked: boolean): void => {
    set({ backgroundLocked: locked });
  },
}));

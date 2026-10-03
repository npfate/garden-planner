import { create } from 'zustand';
import type { Canvas as FabricCanvas } from 'fabric';
import type { ActivityEvent, GardenObject, IsoDate } from '../types/garden';
import { formatDateRu, isoYear, todayIso } from '../utils/markers';
import { isVisibleInYear, lifeBounds, makeEvent } from '../utils/wayback';

export type ToolId = 'select' | 'pan' | 'bed' | 'tree';

export interface GardenFileSnapshot {
  version: number;
  savedAt: string;
  objects: GardenObject[];
  events: ActivityEvent[];
  backgroundImage: string | null;
  currentYear: number;
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
  setCanvas: (canvas: FabricCanvas | null) => void;
  visibleObjects: () => GardenObject[];
  saveToFile: () => string;
  loadFromFile: (json: string) => void;
}

export type GardenStore = GardenState & GardenActions;

const CURRENT_YEAR_DEFAULT = 2024;

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
    // Выкопка (soft-delete): помечаем removedAt — объект исчезает со схемы
    // после этой даты, но остаётся в истории (можно отматать год назад и
    // увидеть, что он здесь рос). Если дата выкопки уже стоит — обновляем.
    const date = todayIso();
    set((state) => ({
      objects: state.objects.map((o) => (o.id === id ? { ...o, removedAt: date } : o)),
    }));
    get().addEvent(makeEvent('removed', obj, `Выкопан: ${obj.name}, ${formatDateRu(date)} (остался в истории)`, date));
  },

  // «В корзину»: полное уничтожение объекта во всех временнóх срезах.
  destroyObject: (id: string): void => {
    const obj = get().objects.find((o) => o.id === id);
    set((state) => ({
      objects: state.objects.filter((o) => o.id !== id),
      selectedObjectId: state.selectedObjectId === id ? null : state.selectedObjectId,
    }));
    if (obj) {
      get().addEvent(makeEvent('removed', obj, `Уничтожен (в корзину): ${obj.name}`));
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

  setYear: (year: number): void => {
    set({ currentYear: year, viewDate: null });
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

  setCanvas: (canvas: FabricCanvas | null): void => {
    set({ canvas });
  },

  // Объекты, видимые «на этот момент времени» (год + опциональная дата).
  visibleObjects: (): GardenObject[] => {
    const { objects, currentYear, viewDate } = get();
    return objects.filter((o) => {
      if (!isVisibleInYear(o, currentYear)) return false;
      if (viewDate) {
        const { start, end } = lifeBounds(o);
        if (o.plantedAt && start > viewDate) return false; // ещё не посажен на эту дату
        if (o.removedAt && end && end <= viewDate) return false; // уже выкопан
      }
      return true;
    });
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
      scale: cs.scale,
      snapToGrid: cs.snapToGrid,
      activeTool: cs.activeTool,
    };
    return JSON.stringify(snapshot, null, 2);
  },

  loadFromFile: (json: string): void => {
    try {
      const parsed: unknown = JSON.parse(json);
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Invalid file format');
      }
      const p = parsed as Partial<GardenFileSnapshot>;
      const objects: GardenObject[] = Array.isArray(p.objects) ? p.objects : [];
      const events: ActivityEvent[] = Array.isArray(p.events) ? p.events : [];
      const currentYear: number =
        typeof p.currentYear === 'number' ? p.currentYear : CURRENT_YEAR_DEFAULT;
      set({ objects, events, currentYear, viewDate: null, selectedObjectId: null });

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

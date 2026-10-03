import { create } from 'zustand';
import type { Canvas as FabricCanvas } from 'fabric';
import type { GardenObject } from '../types/garden';

export type ToolId = 'select' | 'pan' | 'bed' | 'tree';

export interface GardenFileSnapshot {
  version: number;
  savedAt: string;
  objects: GardenObject[];
  backgroundImage: string | null;
  currentYear: number;
  scale: number;
  snapToGrid: boolean;
  activeTool: ToolId;
}

interface GardenState {
  objects: GardenObject[];
  currentYear: number;
  selectedObjectId: string | null;
  canvas: FabricCanvas | null;
}

interface GardenActions {
  addObject: (obj: GardenObject) => void;
  updateObject: (id: string, updates: Partial<GardenObject>) => void;
  removeObject: (id: string) => void;
  setObjects: (objects: GardenObject[]) => void;
  setYear: (year: number) => void;
  selectObject: (id: string | null) => void;
  setCanvas: (canvas: FabricCanvas | null) => void;
  saveToFile: () => string;
  loadFromFile: (json: string) => void;
}

export type GardenStore = GardenState & GardenActions;

const CURRENT_YEAR_DEFAULT = 2024;

export const useGardenStore = create<GardenStore>((set, get) => ({
  objects: [],
  currentYear: CURRENT_YEAR_DEFAULT,
  selectedObjectId: null,
  canvas: null,

  addObject: (obj: GardenObject): void => {
    set((state) => ({
      objects: [...state.objects, { ...obj, updatedAt: new Date().toISOString() }],
    }));
  },

  updateObject: (id: string, updates: Partial<GardenObject>): void => {
    set((state) => ({
      objects: state.objects.map((o) =>
        o.id === id ? { ...o, ...updates, updatedAt: new Date().toISOString() } : o,
      ),
    }));
  },

  removeObject: (id: string): void => {
    set((state) => ({
      objects: state.objects.filter((o) => o.id !== id),
      selectedObjectId: state.selectedObjectId === id ? null : state.selectedObjectId,
    }));
  },

  setObjects: (objects: GardenObject[]): void => {
    set({ objects });
  },

  setYear: (year: number): void => {
    set({ currentYear: year });
  },

  selectObject: (id: string | null): void => {
    set({ selectedObjectId: id });
  },

  setCanvas: (canvas: FabricCanvas | null): void => {
    set({ canvas });
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
      const currentYear: number =
        typeof p.currentYear === 'number' ? p.currentYear : CURRENT_YEAR_DEFAULT;
      set({ objects, currentYear, selectedObjectId: null });

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

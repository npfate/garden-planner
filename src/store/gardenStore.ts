import { create } from 'zustand';
import type { Canvas as FabricCanvas } from 'fabric';
import type { GardenObject } from '../types/garden';

export type ToolId =
  | 'pointer'
  | 'bed'
  | 'polygon'
  | 'tree'
  | 'text'
  | 'eraser'
  | 'barrel'
  | 'well'
  | 'greenhouse'
  | 'shed';

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
  scale: number;
  gridStep: number;
  snapToGrid: boolean;
  activeTool: ToolId;
  backgroundImage: string | null;
  backgroundLocked: boolean;
  canvas: FabricCanvas | null;
}

interface GardenActions {
  addObject: (obj: GardenObject) => void;
  updateObject: (id: string, updates: Partial<GardenObject>) => void;
  removeObject: (id: string) => void;
  setYear: (year: number) => void;
  selectObject: (id: string | null) => void;
  setScale: (scale: number) => void;
  setGridStep: (step: number) => void;
  setSnapToGrid: (value: boolean) => void;
  setActiveTool: (tool: ToolId) => void;
  setBackgroundImage: (url: string | null) => void;
  setBackgroundLocked: (locked: boolean) => void;
  setCanvas: (canvas: FabricCanvas | null) => void;
  saveToFile: () => string;
  loadFromFile: (json: string) => void;
}

export type GardenStore = GardenState & GardenActions;

export const useGardenStore = create<GardenStore>((set, get) => ({
  objects: [],
  currentYear: 2024,
  selectedObjectId: null,
  scale: 100,
  gridStep: 1,
  snapToGrid: false,
  activeTool: 'pointer',
  backgroundImage: null,
  backgroundLocked: false,
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

  setYear: (year: number): void => {
    set({ currentYear: year });
  },

  selectObject: (id: string | null): void => {
    set({ selectedObjectId: id });
  },

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

  setCanvas: (canvas: FabricCanvas | null): void => {
    set({ canvas });
  },

  saveToFile: (): string => {
    const state: GardenStore = get();
    const snapshot: GardenFileSnapshot = {
      version: 1,
      savedAt: new Date().toISOString(),
      objects: state.objects,
      backgroundImage: state.backgroundImage,
      currentYear: state.currentYear,
      scale: state.scale,
      snapToGrid: state.snapToGrid,
      activeTool: state.activeTool,
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
      const backgroundImage: string | null =
        typeof p.backgroundImage === 'string' ? p.backgroundImage : null;
      const currentYear: number = typeof p.currentYear === 'number' ? p.currentYear : 2024;
      const scale: number = typeof p.scale === 'number' ? p.scale : 100;
      const snapToGrid: boolean = typeof p.snapToGrid === 'boolean' ? p.snapToGrid : false;
      const activeTool: ToolId =
        typeof p.activeTool === 'string' && ['pointer', 'bed', 'polygon', 'tree', 'text', 'eraser', 'barrel', 'well', 'greenhouse', 'shed'].includes(p.activeTool)
          ? (p.activeTool as ToolId)
          : 'pointer';
      set({ objects, backgroundImage, currentYear, scale, snapToGrid, activeTool, selectedObjectId: null });
    } catch (err) {
      console.error('Ошибка загрузки .garden файла:', err);
      throw err;
    }
  },
}));

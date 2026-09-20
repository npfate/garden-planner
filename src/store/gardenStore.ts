import { create } from 'zustand';
import type { GardenObject } from '../types/garden';

export interface GardenFileSnapshot {
  version: number;
  savedAt: string;
  objects: GardenObject[];
  backgroundImage: string | null;
  currentYear: number;
  scale: number;
}

interface GardenState {
  objects: GardenObject[];
  currentYear: number;
  selectedObjectId: string | null;
  scale: number;
  backgroundImage: string | null;
}

interface GardenActions {
  addObject: (obj: GardenObject) => void;
  updateObject: (id: string, updates: Partial<GardenObject>) => void;
  removeObject: (id: string) => void;
  setYear: (year: number) => void;
  selectObject: (id: string | null) => void;
  setScale: (scale: number) => void;
  setBackgroundImage: (url: string | null) => void;
  saveToFile: () => string;
  loadFromFile: (json: string) => void;
}

export type GardenStore = GardenState & GardenActions;

export const useGardenStore = create<GardenStore>((set, get) => ({
  objects: [],
  currentYear: 2024,
  selectedObjectId: null,
  scale: 100,
  backgroundImage: null,

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

  setBackgroundImage: (url: string | null): void => {
    set({ backgroundImage: url });
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
      set({ objects, backgroundImage, currentYear, scale, selectedObjectId: null });
    } catch (err) {
      console.error('Ошибка загрузки .garden файла:', err);
      throw err;
    }
  },
}));

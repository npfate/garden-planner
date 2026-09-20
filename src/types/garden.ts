export type GardenObjectType =
  | 'tree'
  | 'bed'
  | 'seedling'
  | 'greenhouse'
  | 'building'
  | 'path'
  | 'custom';

export type VarietyRating = 'like' | 'dislike' | null;

export interface YearHistoryEntry {
  harvest?: number;
  rating?: VarietyRating;
  notes?: string;
}

export interface Variety {
  id: string;
  name: string;
  graftingYear?: number | null;
  notes?: string | null;
}

export interface GardenObject {
  id: string;
  type: GardenObjectType;
  name: string;
  year: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  parentId: string | null;
  varieties: Variety[];
  history: Record<number, YearHistoryEntry>;
  customIcon?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Tree extends GardenObject {
  type: 'tree';
  trunkDiameter?: number;
}

export interface Bed extends GardenObject {
  type: 'bed';
  soilType?: string;
}

export interface Seedling extends GardenObject {
  type: 'seedling';
  variety?: Variety | null;
  quantity?: number;
}

export type AnyGardenObject = Tree | Bed | Seedling;

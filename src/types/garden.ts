export type GardenObjectType =
  | 'tree'
  | 'bed'
  | 'seedling'
  | 'greenhouse'
  | 'building'
  | 'path'
  | 'custom';

// Жизненный цикл растения — влияет на отображение в wayback-машине:
// perennial (многолетник) виден во всех годах после посадки;
// annual (однолетник) — только в год посадки.
export type PlantLifecycle = 'perennial' | 'annual';

// Полная дата события (wayback machine). Формат ISO yyyy-mm-dd,
// сравним лексикографически.
export type IsoDate = string;

export type ActivityKind =
  | 'planted' // посадка/появление объекта
  | 'moved' // перемещение или пересадка (обновлены координаты)
  | 'harvest' // сбор урожая
  | 'removed' // удаление объекта
  | 'note'; // заметка пользователя

export interface ActivityEvent {
  id: string;
  date: IsoDate; // дата действия (реальное время по умолчанию)
  objectId: string | null;
  objectName: string; // денормализация — событие остаётся читаемым после удаления объекта
  kind: ActivityKind;
  details: string; // человекочитаемое описание для ленты
}

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
  // Wayback machine: жизненный цикл (по умолчанию многолетник) и календарные даты.
  lifecycle?: PlantLifecycle;
  plantedAt?: IsoDate | null; // дата посадки (май, август и т.д.)
  removedAt?: IsoDate | null; // дата выкопки/удаления (объект «исчезает» после неё)
  // Пересадка: если объект появился в результате пересадки — ссылка на
  // предыдущее место и дату. Парная цепочка old.transplantedToId = new.id.
  transplantedFromId?: string | null;
  transplantedToId?: string | null;
  transplantedAt?: IsoDate | null;
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

import { FabricImage, Group, Line, Rect } from 'fabric';
import type { Canvas as FabricCanvas, FabricObject } from 'fabric';
import { useGardenStore, useCanvasStore } from '../../store/gardenStore';
import type { GardenObject } from '../../types/garden';
import { MARKER_SIZE, getMarkerColor } from '../../utils/markers';

export const GRID_COLOR = '#E5E7EB';
export const PIXELS_PER_METER = 50;

const GARDEN_ID_KEY = '__gardenObjectId';
const GRID_FLAG_KEY = '__gardenGrid';
const BG_FLAG_KEY = '__gardenBackground';

// Хелперы доступа к кастомным runtime-свойствам fabric-объектов
// (инкапсулируют единственные места с приведением типов).
export function getGardenId(obj: FabricObject): string | null {
  const v = (obj as unknown as Record<string, unknown>)[GARDEN_ID_KEY];
  return typeof v === 'string' ? v : null;
}

export function setGardenId(obj: FabricObject, id: string): void {
  (obj as unknown as Record<string, unknown>)[GARDEN_ID_KEY] = id;
}

export function isGridObject(obj: FabricObject): boolean {
  return (obj as unknown as Record<string, unknown>)[GRID_FLAG_KEY] === true;
}

export function isBackgroundObject(obj: FabricObject): boolean {
  return (obj as unknown as Record<string, unknown>)[BG_FLAG_KEY] === true;
}

export function markAsGrid(obj: FabricObject): void {
  (obj as unknown as Record<string, unknown>)[GRID_FLAG_KEY] = true;
}

export function markAsBackground(obj: FabricObject): void {
  (obj as unknown as Record<string, unknown>)[BG_FLAG_KEY] = true;
}

export function findObjectByGardenId(canvas: FabricCanvas, id: string): FabricObject | undefined {
  return canvas.getObjects().find((o) => getGardenId(o) === id);
}

export function createMarkerRect(entry: GardenObject): Rect {
  const rect = new Rect({
    left: entry.x,
    top: entry.y,
    width: MARKER_SIZE,
    height: MARKER_SIZE,
    fill: getMarkerColor(entry.type),
    stroke: '#FFFFFF',
    strokeWidth: 1,
    originX: 'center',
    originY: 'center',
    selectable: true,
    evented: true,
  });
  setGardenId(rect, entry.id);
  return rect;
}

// Полная синхронизация слоя объектов canvas со списком objects из store.
// Вызывается при загрузке файла и переключении года.
export function syncMarkersFromStore(canvas: FabricCanvas): void {
  const { objects, currentYear } = useGardenStore.getState();

  // Удаляем все garden-объекты (сетку/фон не трогаем)
  for (const obj of [...canvas.getObjects()]) {
    if (getGardenId(obj)) canvas.remove(obj);
  }

  const visibleIds = new Set<string>();

  for (const entry of objects) {
    let opacity = 1;
    if (entry.year > currentYear) continue; // будущие годы не показываем
    if (entry.year < currentYear) opacity = 0.35; // прошлые — полупрозрачные

    visibleIds.add(entry.id);

    const rect = createMarkerRect(entry);
    rect.set({ opacity });
    canvas.add(rect);
  }

  // Сохраняем выделение, если объект всё ещё виден
  const selectedId = useGardenStore.getState().selectedObjectId;
  if (selectedId && visibleIds.has(selectedId)) {
    const obj = findObjectByGardenId(canvas, selectedId);
    if (obj) canvas.setActiveObject(obj);
  } else if (selectedId) {
    useGardenStore.getState().selectObject(null);
  }

  canvas.renderAll();
}

// Синхронизация позиции/размера fabric-объекта в store (object:modified).
export function syncFabricObjectToStore(obj: FabricObject): void {
  const objectId = getGardenId(obj);
  if (!objectId) return;

  const width = obj.getScaledWidth();
  const height = obj.getScaledHeight();

  useGardenStore.getState().updateObject(objectId, {
    x: obj.left ?? 0,
    y: obj.top ?? 0,
    width,
    height,
    rotation: obj.angle ?? 0,
  });
}

// Привязка точки к сетке (если включена) — метры переводим в пиксели сцены.
export function getSnapPoint(x: number, y: number): { x: number; y: number } {
  const { snapToGrid, gridStep } = useCanvasStore.getState();
  if (!snapToGrid) return { x, y };

  const effectiveStep = Math.max(1, gridStep * PIXELS_PER_METER);
  return {
    x: Math.round(x / effectiveStep) * effectiveStep,
    y: Math.round(y / effectiveStep) * effectiveStep,
  };
}

// Отрисовка слоя сетки (группа линий, задний план). Шаг — в метрах.
export function drawGrid(canvas: FabricCanvas, gridStepMeters: number): void {
  const width = canvas.getWidth();
  const height = canvas.getHeight();
  const step = Math.max(1, gridStepMeters * PIXELS_PER_METER);

  const oldGrid = canvas.getObjects().find(isGridObject);
  if (oldGrid) canvas.remove(oldGrid);

  const lines: Line[] = [];
  for (let x = 0; x <= width; x += step) {
    lines.push(new Line([x, 0, x, height], { stroke: GRID_COLOR, strokeWidth: 1, selectable: false, evented: false }));
  }
  for (let y = 0; y <= height; y += step) {
    lines.push(new Line([0, y, width, y], { stroke: GRID_COLOR, strokeWidth: 1, selectable: false, evented: false }));
  }

  const gridGroup = new Group(lines, { selectable: false, evented: false, hoverCursor: 'default' });
  markAsGrid(gridGroup);
  canvas.add(gridGroup);
  canvas.sendObjectToBack(gridGroup);

  // Фон всегда остаётся под сеткой
  const bg = canvas.getObjects().find(isBackgroundObject);
  if (bg) canvas.sendObjectToBack(bg);

  canvas.renderAll();
}

// Загрузка фонового изображения (спутниковый снимок/чертёж) и размещение по центру.
export function loadBackgroundImage(canvas: FabricCanvas, url: string): Promise<void> {
  return FabricImage.fromURL(url).then((img) => {
    const oldBg = canvas.getObjects().find(isBackgroundObject);
    if (oldBg) canvas.remove(oldBg);

    const cw = canvas.getWidth();
    const ch = canvas.getHeight();
    const iw = img.width ?? cw;
    const ih = img.height ?? ch;
    const fit = Math.min(cw / iw, ch / ih, 1);
    img.set({
      left: (cw - iw * fit) / 2,
      top: (ch - ih * fit) / 2,
      scaleX: fit,
      scaleY: fit,
      selectable: true,
      evented: true,
      hasControls: true,
    });
    markAsBackground(img);
    canvas.add(img);
    canvas.sendObjectToBack(img);
    canvas.renderAll();
  });
}

// Блокировка/разблокировка редактирования фона (кнопка «Замок» на панели инструментов).
export function setBackgroundSelectable(canvas: FabricCanvas, selectable: boolean): void {
  const bg = canvas.getObjects().find(isBackgroundObject);
  if (!bg) return;
  bg.set({
    selectable,
    evented: selectable,
    hasControls: selectable,
    hoverCursor: selectable ? 'move' : 'default',
  });
  canvas.renderAll();
}

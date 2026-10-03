import { FabricImage, Group, Line, Rect, Triangle } from 'fabric';
import type { Canvas as FabricCanvas, FabricObject } from 'fabric';
import { useGardenStore, useCanvasStore } from '../../store/gardenStore';
import type { GardenObject } from '../../types/garden';
import { MARKER_SIZE, getMarkerColor } from '../../utils/markers';
import { isVisibleInYear, lifeBounds } from '../../utils/wayback';

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

// Runtime-флаг: fabric-объект создан «вручную» на canvas (грядка drag'ом,
// метка кликом). Такие объекты не пересоздаём при reconcile — иначе сбрасывается
// размер, увеличенный пользователем рамкой трансформации.
const CREATED_FLAG_KEY = '__gardenCreatedOnCanvas';

export function markAsCreatedOnCanvas(obj: FabricObject): void {
  (obj as unknown as Record<string, unknown>)[CREATED_FLAG_KEY] = true;
}

// Создание fabric-объекта для записи store.
// Размеры всегда берутся из записи (пользователь может увеличить объект
// рамкой трансформации — значения сохраняются в store при object:modified).
export function createFabricObjectFromEntry(entry: GardenObject): Rect {
  const isBed = entry.type === 'bed';
  // Для ВСЕХ типов берём сохранённые пользователем размеры из store
  // (раньше немаркированные объекты строились фиксированным MARKER_SIZE —
  //  из-за этого увеличенное дерево после перемотки даты становилось «квадратиком»).
  const width = Math.max(entry.width, 1);
  const height = Math.max(entry.height, 1);

  // Метка, посаженная кликом, имеет размер MARKER_SIZE и рисуется как точка
  // (origin center); увеличенная рамкой — уже полноценный прямоугольник.
  const isMarkerSize = !isBed && width <= MARKER_SIZE + 0.5 && height <= MARKER_SIZE + 0.5;

  const rect = new Rect({
    left: entry.x,
    top: entry.y,
    width,
    height,
    originX: isMarkerSize ? 'center' : 'left',
    originY: isMarkerSize ? 'center' : 'top',
    selectable: true,
    evented: true,
    objectCaching: false,
    ...(isBed
      ? {
          fill: 'rgba(76, 175, 80, 0.2)',
          stroke: '#4CAF50',
          strokeWidth: 2,
        }
      : {
          fill: getMarkerColor(entry.type),
          stroke: '#FFFFFF',
          strokeWidth: 1,
        }),
  });
  if (entry.rotation) rect.set({ angle: entry.rotation });
  setGardenId(rect, entry.id);
  return rect;
}

// --- Стрелки пересадок (пунктир «откуда → куда») ---

const TRANSPLANT_FLAG_KEY = '__gardenTransplantLine';

export function isTransplantLine(obj: FabricObject): boolean {
  return (obj as unknown as Record<string, unknown>)[TRANSPLANT_FLAG_KEY] === true;
}

function markAsTransplantLine(obj: FabricObject): void {
  (obj as unknown as Record<string, unknown>)[TRANSPLANT_FLAG_KEY] = true;
}

// Центр «визуального» объекта: метка-точка рисуется с origin center,
// прямоугольник (грядка/увеличенный объект) — с origin left/top.
function objectCenter(o: GardenObject): { x: number; y: number } {
  return { x: o.x + o.width / 2, y: o.y + o.height / 2 };
}

// Перерисовка пунктирных стрелок для всех пересадок, «актуальных» на
// текущий момент времени wayback-машины: старое место полупрозрачно,
// новое — ярче. Вызывается из reconcile при каждом изменении слоя объектов.
export function drawTransplantArrows(canvas: FabricCanvas): void {
  for (const obj of [...canvas.getObjects()]) {
    if (isTransplantLine(obj)) canvas.remove(obj);
  }

  const { objects, currentYear, viewDate } = useGardenStore.getState();
  const byId = new Map(objects.map((o) => [o.id, o]));

  for (const target of objects) {
    if (!target.transplantedFromId || !target.transplantedAt) continue;
    const source = byId.get(target.transplantedFromId);
    if (!source) continue;
    // стрелку показываем, когда хотя бы одно из мест видно в этот момент времени
    const targetVisible = isVisibleInYear(target, currentYear);
    const sourceVisible = isVisibleInYear(source, currentYear);
    if (!targetVisible && !sourceVisible) continue;
    if (viewDate) {
      const tb = lifeBounds(target);
      const sb = lifeBounds(source);
      const tVis = !(tb.start > viewDate || (tb.end !== null && tb.end <= viewDate));
      const sVis = !(sb.start > viewDate || (sb.end !== null && sb.end <= viewDate));
      if (!tVis && !sVis) continue;
    }

    const from = objectCenter(source);
    const to = objectCenter(target);
    const line = new Line([from.x, from.y, to.x, to.y], {
      stroke: '#6366F1',
      strokeWidth: 1.5,
      strokeDashArray: [6, 4],
      opacity: 0.7,
      selectable: false,
      evented: false,
    });
    markAsTransplantLine(line);
    canvas.add(line);

    // наконечник стрелки у нового места
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const headLen = 9;
    const head = new Triangle({
      left: to.x,
      top: to.y,
      width: headLen,
      height: headLen,
      originX: 'center',
      originY: 'center',
      angle: (angle * 180) / Math.PI + 90,
      fill: '#6366F1',
      opacity: 0.9,
      selectable: false,
      evented: false,
    });
    markAsTransplantLine(head);
    canvas.add(head);
  }
}

// Синхронизация слоя объектов со store (wayback machine).
// Вызывается при загрузке проекта, смене года/даты просмотра и изменении
// набора объектов. На схеме остаются только объекты, «жившие» в выбранный
// момент времени; чтобы не затирать уже созданные грядки-прямоугольники
// точками-метками, синхронизируем поштучно только то, что изменилось.
export function reconcileObjectsWithStore(canvas: FabricCanvas): void {
  const state = useGardenStore.getState();
  const { currentYear } = state;
  const visible = state.visibleObjects();
  const entriesById = new Map(visible.map((o) => [o.id, o]));

  // 1) Удаляем fabric-объекты, скрытые временем или удалённые из store
  for (const obj of [...canvas.getObjects()]) {
    const id = getGardenId(obj);
    if (id && !entriesById.has(id)) canvas.remove(obj);
  }

  // 2) Добавляем/обновляем видимые объекты из store
  for (const entry of visible) {
    let opacity = 1;
    const plantedYear = entry.plantedAt ? Number(entry.plantedAt.slice(0, 4)) : entry.year;
    if (plantedYear < currentYear) opacity = 0.35; // прошлое — полупрозрачно («история»)

    const existing = findObjectByGardenId(canvas, entry.id);
    if (!existing) {
      const rect = createFabricObjectFromEntry(entry);
      rect.set({ opacity });
      // объекты, восстановленные после перемотки времени, тоже не должны
      // пересоздаваться при следующем reconcile (иначе потеряется размер)
      markAsCreatedOnCanvas(rect);
      canvas.add(rect);
      continue;
    }

    existing.set({ opacity });

    // Позиция могла измениться (drag на canvas, пересадка) — подтягиваем из store.
    if (Math.abs((existing.left ?? 0) - entry.x) > 0.5 || Math.abs((existing.top ?? 0) - entry.y) > 0.5) {
      existing.set({ left: entry.x, top: entry.y });
    }

    // Размер: fabric-объекты никогда не пересоздаём — иначе сбрасывается
    // размер, увеличенный пользователем рамкой трансформации (баг: «увеличил
    // дерево → отмотал дату назад/вперёд → квадратик»). При расхождении
    // размеров (например, загрузка .garden-файла) обновляем существующий
    // объект инкрементально, сохраняя его идентичность и выделение.
    const w = Math.max(existing.getScaledWidth(), 0);
    const h = Math.max(existing.getScaledHeight(), 0);
    if (Math.abs(w - entry.width) > 0.5 || Math.abs(h - entry.height) > 0.5) {
      existing.set({
        width: Math.max(entry.width / (existing.scaleX || 1), 1),
        height: Math.max(entry.height / (existing.scaleY || 1), 1),
      });
    }
  }

  // Сохраняем выделение, если объект всё ещё виден
  const selectedId = state.selectedObjectId;
  const visibleSelected =
    selectedId && visible.find((o) => o.id === selectedId && isVisibleInYear(o, currentYear));
  if (visibleSelected) {
    const obj = findObjectByGardenId(canvas, selectedId as string);
    if (obj) canvas.setActiveObject(obj);
  } else if (selectedId) {
    useGardenStore.getState().selectObject(null);
  }

  // Пунктирные стрелки пересадок поверх слоя объектов
  drawTransplantArrows(canvas);

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

import { FabricImage, Group, Line, Rect, Text, Triangle } from 'fabric';
import type { Canvas as FabricCanvas, FabricObject } from 'fabric';
import { useGardenStore, useCanvasStore } from '../../store/gardenStore';
import type { GardenObject } from '../../types/garden';
import { getMarkerColor } from '../../utils/markers';
import { isVisibleInYear } from '../../utils/wayback';
import { getLibraryItem } from '../../constants/objectLibrary';

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

// Runtime-тип объекта схемы (GardenObjectType) — нужен для hit-теста при
// размещении растений внутрь грядок/парников (см. GardenCanvas.handleMouseDown).
const OBJECT_TYPE_KEY = '__gardenObjectType';

export function getObjectType(obj: FabricObject): string | null {
  const v = (obj as unknown as Record<string, unknown>)[OBJECT_TYPE_KEY];
  return typeof v === 'string' ? v : null;
}

export function setObjectType(obj: FabricObject, type: string): void {
  (obj as unknown as Record<string, unknown>)[OBJECT_TYPE_KEY] = type;
}

/**
 * Общие свойства ВСЕХ интерактивных объектов схемы:
 * - strokeUniform — толщина обводки не растёт при ресайзе/масштабе камеры;
 * - cornerSize 8  — компактные угловые маркеры (не перекрывают обзор);
 * origin left/top и размеры задаются в createFabricObjectFromEntry.
 */
export function applyObjectDefaults(obj: FabricObject): void {
  obj.set({
    strokeUniform: true,
    cornerSize: 8,
    cornerColor: '#ffffff',
    cornerStrokeColor: '#1e6f3c',
    transparentCorners: false,
  });
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
// Возвращаемый тип — FabricObject: растения (шаг 6.4) оборачиваются в Group
// с эмодзи-иконкой и подписью, грядки/постройки остаются Rect.
export function createFabricObjectFromEntry(entry: GardenObject): FabricObject {
  const isBed = entry.type === 'bed';
  // Для ВСЕХ типов берём сохранённые пользователем размеры из store
  // (раньше немаркированные объекты строились фиксированным MARKER_SIZE —
  //  из-за этого увеличенное дерево после перемотки даты становилось «квадратиком»).
  const width = Math.max(entry.width, 1);
  const height = Math.max(entry.height, 1);

  // Все объекты строятся с origin left/top: координаты x/y в store — это левый
  // верхний угол. Раньше метки-точки рисовались с origin center, из-за чего
  // фактический центр объекта смещался на полразмера от (x + w/2, y + h/2) —
  // рамка выделения при фокусе из Инвентаря «прыгала» мимо объекта.
  const rect = new Rect({
    left: entry.x,
    top: entry.y,
    width,
    height,
    originX: 'left',
    originY: 'top',
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
  setObjectType(rect, entry.type);
  applyObjectDefaults(rect);
  attachVarietyLabel(rect, entry);

  // Спринт 6, шаг 6.4: растения (деревья/кусты/цветы/саженцы) рисуем не
  // «квадратиками», а Group с эмодзи-иконкой и подписью имени. Грядки,
  // парники и постройки остаются прямоугольниками.
  const isPlant = entry.type === 'tree' || entry.type === 'seedling';
  const iconChar = resolveIconChar(entry);
  if (isPlant && iconChar) {
    return wrapMarkerWithIcon(rect, entry, iconChar);
  }
  return rect;
}

// --- Иконки растений на canvas (Спринт 6, шаг 6.4) ---

const ICON_KEY = '__gardenIcon';

export function isIconText(obj: FabricObject): boolean {
  return (obj as unknown as Record<string, unknown>)[ICON_KEY] === true;
}

function markAsIcon(obj: FabricObject): void {
  (obj as unknown as Record<string, unknown>)[ICON_KEY] = true;
}

// Какой символ рисовать в центре маркера: пользовательская иконка (customIcon),
// иначе эмодзи шаблона из Библиотеки (по libraryItemId).
export function resolveIconChar(entry: GardenObject): string | null {
  const custom = entry.customIcon?.trim();
  if (custom) return custom;
  if (!entry.libraryItemId) return null;
  return getLibraryItem(entry.libraryItemId)?.emoji ?? null;
}

// Размер шрифта эмодзи под габарит маркера (с запасом на рамку).
function iconFontSize(w: number, h: number): number {
  return Math.max(12, Math.min(Math.max(w, h) * 0.75, 64));
}

// Обёртка маркера-Rect в Group: фон + эмодзи + подпись имени.
// Группа двигается/ресайзится как единое целое; syncFabricObjectToStore
// читает геометрию с группы, поэтому store остаётся источником истины.
function wrapMarkerWithIcon(rect: Rect, entry: GardenObject, char: string): Group {
  const w = Math.max(rect.width ?? 1, 1);
  const h = Math.max(rect.height ?? 1, 1);

  const icon = new Text(char, {
    left: w / 2,
    top: h / 2,
    originX: 'center',
    originY: 'center',
    fontSize: iconFontSize(w, h),
    fontFamily: 'serif',
    selectable: false,
    evented: false,
  });
  markAsIcon(icon);

  const label = new Text(entry.name, {
    left: w / 2,
    top: h + 3,
    originX: 'center',
    originY: 'top',
    fontSize: 11,
    fontFamily: 'Inter, sans-serif',
    fill: '#374151',
    textAlign: 'center',
    selectable: false,
    evented: false,
  });
  markAsIcon(label);

  const group = new Group([rect, icon, label], {
    interactive: true, // hit-тест по дочерним объектам — клик работает как раньше
    subTargetCheck: false,
    originX: 'left',
    originY: 'top',
  });
  // Геометрия группы совпадает с левым верхним углом маркера (origin left/top)
  group.set({ left: entry.x, top: entry.y });
  setGardenId(group, entry.id);
  setObjectType(group, entry.type);
  applyObjectDefaults(group);
  return group;
}

// --- Подпись сортов под объектом (для деревьев с прививками) ---

const VARIETY_LABEL_KEY = '__gardenVarietyLabel';
const VARIETY_OWNER_KEY = '__gardenOwnerId';

export function isVarietyLabel(obj: FabricObject): boolean {
  return (obj as unknown as Record<string, unknown>)[VARIETY_LABEL_KEY] === true;
}

// id дерева-владельца подписи (для каскадного удаления в reconcile)
function getVarietyLabelOwnerId(obj: FabricObject): string {
  const v = (obj as unknown as Record<string, unknown>)[VARIETY_OWNER_KEY];
  return typeof v === 'string' ? v : '';
}

function markAsVarietyLabel(obj: FabricObject): void {
  (obj as unknown as Record<string, unknown>)[VARIETY_LABEL_KEY] = true;
}

// Текст со списком сортов под деревом (несколько сортов = прививки).
export function buildVarietyLabel(entry: GardenObject, ownerId?: string): Text | null {
  if (entry.type !== 'tree' || entry.varieties.length < 2) return null;
  const label = new Text(entry.varieties.map((v) => v.name).join(', '), {
    left: (entry.x ?? 0) + Math.max(entry.width, 1) / 2,
    top: (entry.y ?? 0) + Math.max(entry.height, 1) + 4,
    originX: 'center',
    originY: 'top',
    fontSize: 11,
    fontFamily: 'Inter, sans-serif',
    fill: '#374151',
    textAlign: 'center',
    selectable: false,
    evented: false,
  });
  markAsVarietyLabel(label);
  // ссылка на владельца — для удаления подписи вместе с деревом (reconcile)
  (label as unknown as Record<string, unknown>)[VARIETY_OWNER_KEY] = ownerId ?? entry.id;
  return label;
}

// Вешаем подпись на основной объект как extra: она двигается вместе с ним
// и автоматически удаляется при удалении/скрытии дерева (см. reconcile).
// ВАЖНО: extra — служебный массив fabric v6, объекты из него НЕ попадают на
// canvas сами по себе, поэтому подпись добавляем в canvas явно (иначе её не
// видно). При drag'е позицию подписи обновляет syncFabricObjectToStore.
function attachVarietyLabel(rect: Rect, entry: GardenObject): void {
  const label = buildVarietyLabel(entry, getGardenId(rect) ?? entry.id);
  if (!label) return;
  rect.set({ extra: [label] });
}

// Добавить подпись сортов существующего объекта на canvas (после canvas.add(rect)).
export function addVarietyLabelToCanvas(canvas: FabricCanvas, obj: FabricObject): void {
  const extras = (obj.get('extra') as FabricObject[] | undefined) ?? [];
  for (const l of extras.filter(isVarietyLabel)) canvas.add(l);
}

// Обновить (или убрать) подпись сортов у существующего fabric-объекта.
export function refreshVarietyLabel(canvas: FabricCanvas, entry: GardenObject): void {
  const obj = findObjectByGardenId(canvas, entry.id);
  if (!obj) return;
  removeVarietyLabels(canvas, obj);
  const label = buildVarietyLabel(entry, entry.id);
  if (label) {
    // позиция — относительно ФАКТИЧЕСКИХ размеров объекта на canvas
    // (могли измениться рамкой трансформации до правки сортов)
    label.set({
      left: (obj.left ?? 0) + Math.max(obj.getScaledWidth(), 1) / 2,
      top: (obj.top ?? 0) + Math.max(obj.getScaledHeight(), 1) + 4,
    });
    obj.set({ extra: [...((obj.get('extra') as FabricObject[] | undefined) ?? []), label] });
    canvas.add(label);
  }
  canvas.renderAll();
}

// Удалить ВСЕ подписи сортов с canvas и из extra объектов (перед полным
// пересозданием слоя при загрузке проекта).
export function clearVarietyLabels(canvas: FabricCanvas): void {
  for (const obj of [...canvas.getObjects()]) {
    if (isVarietyLabel(obj)) canvas.remove(obj);
  }
  for (const obj of canvas.getObjects()) {
    const extras = (obj.get('extra') as FabricObject[] | undefined) ?? [];
    if (extras.some(isVarietyLabel)) obj.set({ extra: extras.filter((e) => !isVarietyLabel(e)) });
  }
}

// Удалить подписи сортов, «прикреплённые» к объекту (из extra и с canvas).
function removeVarietyLabels(canvas: FabricCanvas, obj: FabricObject): void {
  const extras = (obj.get('extra') as FabricObject[] | undefined) ?? [];
  const labels = extras.filter(isVarietyLabel);
  for (const l of labels) canvas.remove(l);
  if (labels.length > 0) obj.set({ extra: extras.filter((e) => !isVarietyLabel(e)) });
}

// Инкрементальное обновление позиции/размера существующего fabric-объекта
// из записи store (используется reconcile'ом). Объект НЕ пересоздаётся —
// иначе сбрасывается размер, увеличенный пользователем рамкой трансформации.
function updateFabricObjectGeometry(existing: FabricObject, entry: GardenObject): void {
  if (Math.abs((existing.left ?? 0) - entry.x) > 0.5 || Math.abs((existing.top ?? 0) - entry.y) > 0.5) {
    existing.set({ left: entry.x, top: entry.y });
  }
  const w = Math.max(existing.getScaledWidth(), 0);
  const h = Math.max(existing.getScaledHeight(), 0);
  if (Math.abs(w - entry.width) > 0.5 || Math.abs(h - entry.height) > 0.5) {
    existing.set({
      width: Math.max(entry.width / (existing.scaleX || 1), 1),
      height: Math.max(entry.height / (existing.scaleY || 1), 1),
    });
  }
  // Подпись сортов следует за новыми координатами/размерами дерева
  const extras = (existing.get('extra') as FabricObject[] | undefined) ?? [];
  for (const l of extras.filter(isVarietyLabel)) {
    l.set({
      left: (existing.left ?? 0) + Math.max(existing.getScaledWidth(), 1) / 2,
      top: (existing.top ?? 0) + Math.max(existing.getScaledHeight(), 1) + 4,
    });
  }
  existing.setCoords();
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

// Подсказки пересадки: рисуем ТОЛЬКО когда пользователь кликнул (выбрал)
// пересаженный объект. Набор: тонкая пунктирная стрелка «откуда → куда» +
// бледный пунктирный «призрак» прежнего места (сохранённые размеры). При
// drag'е объекта reconcile перерисовывает подсказки, поэтому стрелка
// следует за объектом.
export function drawTransplantHints(canvas: FabricCanvas): void {
  for (const obj of [...canvas.getObjects()]) {
    if (isTransplantLine(obj)) canvas.remove(obj);
  }

  const { objects, selectedObjectId } = useGardenStore.getState();
  if (!selectedObjectId) return;
  const byId = new Map(objects.map((o) => [o.id, o]));

  // Цепочка пересадок от выбранного объекта назад (в т.ч. если выбран
  // «призрак» промежуточного места — идём от него тоже).
  const targets = new Set<string>();
  let cur = byId.get(selectedObjectId);
  while (cur) {
    if (cur.transplantedFromId && cur.transplantedAt) {
      targets.add(cur.id);
      cur = byId.get(cur.transplantedFromId);
    } else {
      break;
    }
  }

  for (const targetId of targets) {
    const target = byId.get(targetId);
    if (!target?.transplantedFromId || !target.transplantedAt) continue;
    const source = byId.get(target.transplantedFromId);
    if (!source) continue;

    const from = objectCenter(source);
    const to = objectCenter(target);

    // «Призрак» прежнего места: бледный, пунктирный контур тех же размеров.
    const ghostW = Math.max(source.width, 1);
    const ghostH = Math.max(source.height, 1);
    const ghost = new Rect({
      left: source.x,
      top: source.y,
      width: ghostW,
      height: ghostH,
      originX: 'left',
      originY: 'top',
      fill: 'rgba(99, 102, 241, 0.08)',
      stroke: '#6366F1',
      strokeWidth: 1,
      strokeDashArray: [5, 4],
      opacity: 0.45,
      selectable: false,
      evented: false,
    });
    if (source.rotation) ghost.set({ angle: source.rotation });
    markAsTransplantLine(ghost);
    canvas.add(ghost);

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

  // 1) Удаляем fabric-объекты, скрытые временем или удалённые из store.
  // Подписи сортов (isVarietyLabel) не имеют gardenId — удаляем их вместе с
  // родительским деревом по флагу __gardenOwnerId (см. buildVarietyLabel).
  const removedIds = new Set<string>();
  for (const obj of [...canvas.getObjects()]) {
    const id = getGardenId(obj);
    if (id && !entriesById.has(id)) {
      canvas.remove(obj);
      removedIds.add(id);
    }
  }
  for (const obj of [...canvas.getObjects()]) {
    if (isVarietyLabel(obj) && removedIds.has(getVarietyLabelOwnerId(obj))) canvas.remove(obj);
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
      addVarietyLabelToCanvas(canvas, rect); // подпись сортов видима только на canvas
      continue;
    }

    existing.set({ opacity });

    // Позиция/размер могли измениться (drag, resize, пересадка, загрузка
    // файла) — подтягиваем из store инкрементально, сохраняя идентичность
    // объекта и его выделение.
    updateFabricObjectGeometry(existing, entry);
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

  // Пунктирные подсказки пересадки (стрелка + «призрак» прежнего места) —
  // только для выбранного объекта; перерисовываются при каждом reconcile,
  // поэтому стрелка следует за объектом во время drag'а.
  drawTransplantHints(canvas);

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

// Эффективный шаг сетки в пикселях сцены (0 — если snap выключен).
export function getEffectiveGridStep(): number {
  const { snapToGrid, gridStep } = useCanvasStore.getState();
  if (!snapToGrid) return 0;
  return Math.max(1, gridStep * PIXELS_PER_METER);
}

// Округление значения до ближайшего кратного шагу сетки.
export function snapValue(value: number): number {
  const step = getEffectiveGridStep();
  if (!step) return value;
  return Math.round(value / step) * step;
}

// Привязка точки к сетке (если включена) — метры переводим в пиксели сцены.
export function getSnapPoint(x: number, y: number): { x: number; y: number } {
  const step = getEffectiveGridStep();
  if (!step) return { x, y };

  return {
    x: Math.round(x / step) * step,
    y: Math.round(y / step) * step,
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

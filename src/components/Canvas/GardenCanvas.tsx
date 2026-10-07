import { Canvas, Point, Rect } from 'fabric';
import type { TPointerEvent, TPointerEventInfo, FabricObject, BasicTransformEvent } from 'fabric';
import { useEffect, useRef } from 'react';
import { useGardenStore, useCanvasStore } from '../../store/gardenStore';
import { isVisibleAt } from '../../utils/wayback';
import type { ToolId } from '../../store/gardenStore';
import type { GardenObject, GardenObjectType, IsoDate } from '../../types/garden';
import { MARKER_SIZE, todayIso } from '../../utils/markers';
import { makeEvent } from '../../utils/wayback';
import { getLibraryItem, LIBRARY_ITEMS_FLAT, isPlantTool } from '../../constants/objectLibrary';
import { PIXELS_PER_METER } from './fabricSync';
import {
  createFabricObjectFromEntry,
  drawGrid,
  drawTransplantHints,
  findObjectByGardenId,
  getEffectiveGridStep,
  getObjectType,
  isTransplantLine,
  markAsCreatedOnCanvas,
  reconcileObjectsWithStore,
  getGardenId,
  getSnapPoint,
  snapObjectToGrid,
  snapValue,
  isBackgroundObject,
  loadBackgroundImage,
  setBackgroundSelectable,
  syncFabricObjectToStore,
} from './fabricSync';

// Эмодзи-маркеры плодовых/декоративных деревьев (для типов 'tree').
const EMOJI_BY_LIBRARY_ID: Record<string, string> = {};
for (const it of LIBRARY_ITEMS_FLAT) {
  if (it.category === 'fruit_tree') EMOJI_BY_LIBRARY_ID[it.id] = '🍎';
  else if (it.category === 'bush') EMOJI_BY_LIBRARY_ID[it.id] = '🌿';
  else if (it.category === 'flower') EMOJI_BY_LIBRARY_ID[it.id] = '🌸';
  else if (it.category === 'shrub') EMOJI_BY_LIBRARY_ID[it.id] = '🌳';
}

const ZOOM_FACTOR = 1.1;
const MIN_SCALE = 10;
const MAX_SCALE = 500;


function createGardenObjectEntry(
  type: GardenObjectType,
  name: string,
  year: number,
  x: number,
  y: number,
  width = MARKER_SIZE,
  height = MARKER_SIZE,
  customIcon?: string | null,
  plantedAt?: IsoDate,
  libraryItemId?: string,
): GardenObject {
  const now = new Date().toISOString();
  // Дефолты из Библиотеки объектов: многолетник/однолетник и размер кроны.
  const tpl = libraryItemId ? getLibraryItem(libraryItemId) : undefined;
  return {
    id: crypto.randomUUID(),
    type,
    name,
    year,
    x,
    y,
    width,
    height,
    parentId: null,
    varieties: [],
    history: { [year]: { harvest: 0 } },
    customIcon: customIcon ?? null,
    libraryItemId: libraryItemId ?? null,
    lifecycle: tpl?.defaultProperties.lifecycle === 'annual' ? 'annual' : 'perennial',
    crownDiameter: typeof tpl?.defaultProperties.crownDiameter === 'number' ? tpl.defaultProperties.crownDiameter : undefined,
    plantedAt: plantedAt ?? todayIso(),
    createdAt: now,
    updatedAt: now,
  };
}

function applyZoom(canvas: Canvas, newScalePercent: number, centerPoint?: Point): void {
  const clamped = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScalePercent));
  const point = centerPoint ?? new Point(canvas.getWidth() / 2, canvas.getHeight() / 2);
  canvas.zoomToPoint(point, clamped / 100);
  canvas.renderAll();
}

function cursorsForTool(canvas: Canvas, tool: ToolId, spacePressed: boolean): void {
  if (spacePressed || tool === 'pan') {
    canvas.defaultCursor = 'grab';
    canvas.hoverCursor = 'grab';
    canvas.moveCursor = 'grab';
    return;
  }
  if (tool === 'bed' || tool === 'tree' || tool.startsWith('place:')) {
    canvas.defaultCursor = 'crosshair';
    canvas.hoverCursor = 'crosshair';
    canvas.moveCursor = 'crosshair';
    return;
  }
  canvas.defaultCursor = 'default';
  canvas.hoverCursor = 'move';
  canvas.moveCursor = 'move';
}

export default function GardenCanvas() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const activeToolRef = useRef<ToolId>('select');
  const bedDraftRef = useRef<{ start: Point; preview: Rect | null } | null>(null);
  const isSpacePressedRef = useRef<boolean>(false);
  const isPanningRef = useRef<boolean>(false);
  const lastScreenPosRef = useRef<{ x: number; y: number } | null>(null);

  const setCanvas = useGardenStore((s) => s.setCanvas);
  const scale = useCanvasStore((s) => s.scale);
  const gridStep = useCanvasStore((s) => s.gridStep);
  const activeTool = useCanvasStore((s) => s.activeTool);
  const backgroundImage = useCanvasStore((s) => s.backgroundImage);
  const backgroundLocked = useCanvasStore((s) => s.backgroundLocked);

  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);

  // Пробел — временный режим панорамирования
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement | null;
      const isEditable =
        !!target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || Boolean(target.isContentEditable));
      if (e.code !== 'Space' || e.repeat || isEditable) return;
      e.preventDefault();
      if (isSpacePressedRef.current) return;
      isSpacePressedRef.current = true;
      const c = fabricRef.current;
      if (c && !isPanningRef.current) cursorsForTool(c, 'pan', true);
    };

    const onKeyUp = (e: KeyboardEvent): void => {
      if (e.code !== 'Space') return;
      e.preventDefault();
      isSpacePressedRef.current = false;
      const c = fabricRef.current;
      if (c && !isPanningRef.current) {
        cursorsForTool(c, useCanvasStore.getState().activeTool, false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // Инициализация canvas и обработчиков событий мыши
  useEffect(() => {
    const el = canvasElRef.current;
    const container = containerRef.current;
    if (!el || !container) return;

    const canvas = new Canvas(el, {
      width: container.clientWidth,
      height: container.clientHeight,
      backgroundColor: '#F5F7FA',
      selection: true,
      preserveObjectStacking: true,
      fireRightClick: true,
      stopContextMenu: true,
    });

    fabricRef.current = canvas;
    setCanvas(canvas);
    drawGrid(canvas, useCanvasStore.getState().gridStep);
    reconcileObjectsWithStore(canvas);

    const selectByObject = (obj: FabricObject | null | undefined): void => {
      const id = obj ? getGardenId(obj) : null;
      useGardenStore.getState().selectObject(id);
      // Подсказки пересадки (стрелка + «призрак» прежнего места) зависят от
      // выбора — обновляем сразу при клике/снятии выделения.
      if (id) drawTransplantHints(canvas);
      else {
        for (const o of [...canvas.getObjects()]) {
          if (isTransplantLine(o)) canvas.remove(o);
        }
        canvas.renderAll();
      }
    };

    const onWheel = (opt: TPointerEventInfo<TPointerEvent>): void => {
      const evt = opt.e;
      const isWheel = typeof (evt as unknown as WheelEvent).deltaY === 'number';
      if (!isWheel || (!evt.ctrlKey && !evt.metaKey)) return;
      evt.preventDefault();
      evt.stopPropagation();

      const wheel = evt as unknown as WheelEvent;
      const currentScale = useCanvasStore.getState().scale;
      const factor = wheel.deltaY < 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR;
      const next = Math.round(currentScale * factor);
      const rect = canvas.upperCanvasEl.getBoundingClientRect();
      const pointer = new Point(wheel.clientX - rect.left, wheel.clientY - rect.top);
      applyZoom(canvas, next, pointer);
      useCanvasStore.getState().setScale(Math.max(MIN_SCALE, Math.min(MAX_SCALE, next)));
    };

    const onSelectionChanged = (): void => {
      const activeObj = canvas.getActiveObject();
      if (!activeObj) {
        selectByObject(null);
        return;
      }
      if (activeObj.type === 'activeSelection') {
        // при мультивыделении берём первый объект панели свойств
        const first = (activeObj as unknown as { getObjects: () => FabricObject[] }).getObjects()[0];
        selectByObject(first);
        return;
      }
      selectByObject(activeObj);
    };

    // Синхронизация позиции одного fabric-объекта в store (после snap-коррекции).
    const syncOneToStore = (obj: FabricObject): void => {
      const objectId = getGardenId(obj);
      if (!objectId) return;
      useGardenStore.getState().updateObject(objectId, {
        x: obj.left ?? 0,
        y: obj.top ?? 0,
        width: obj.getScaledWidth(),
        height: obj.getScaledHeight(),
        rotation: obj.angle ?? 0,
      });
    };

    const onObjectModified = (): void => {
      const activeObj = canvas.getActiveObject();
      if (!activeObj) return;

      // Мультивыделение: финальный snap всей группы по центру + сохранение
      // позиций КАЖДОГО объекта в store. Иначе после reconcile объекты
      // «возвращались» на старые координаты (store не знал о перемещении).
      if (activeObj.type === 'activeSelection') {
        if (!isBackgroundObject(activeObj) && !isTransplantLine(activeObj)) {
          const step = getEffectiveGridStep();
          if (step > 0) {
            const pos = snapObjectToGrid(activeObj);
            if (pos) activeObj.set(pos);
            activeObj.setCoords();
          }
        }
        const members = (activeObj as unknown as { getObjects: () => FabricObject[] })
          .getObjects()
          .filter((o) => !isBackgroundObject(o) && !isTransplantLine(o));
        for (const m of members) syncOneToStore(m);
        canvas.requestRenderAll();
        return;
      }

      const id = getGardenId(activeObj);
      // Snap to grid (если включён): финальная привязка позиции, размеров и угла.
      // Существующие объекты НЕ перестраиваются — только результат текущего действия.
      // ВАЖНО: учёт угла поворота — при угле, кратном 90°, собственные размеры
      // объекта меняются местами в мировых осях (w↔h), поэтому left/top раньше
      // корректировались на «не те» половины и объект уезжал от сетки на
      // (h−w)/2. Привязка идёт по ЦЕНТРУ bounding box через snapObjectToGrid,
      // а размеры округляются в локальных осях объекта.
      const step = getEffectiveGridStep();
      if (step > 0 && !isBackgroundObject(activeObj) && !isTransplantLine(activeObj)) {
        const w = activeObj.width ?? 0;
        const h = activeObj.height ?? 0;
        const angle = activeObj.angle ?? 0;
        // Угол: если он кратен 90° с небольшим дрейфом (float-погрешность drag'а) —
        // щёлкаем строго к кратному 90°, чтобы прямоугольник ровно ложился в сетку.
        const nearest90 = Math.round(angle / 90) * 90;
        if (Math.abs(angle - nearest90) <= 1) {
          activeObj.set({ angle: ((nearest90 % 360) + 360) % 360 });
        }
        const norm = ((Math.round(activeObj.angle ?? 0) % 360) + 360) % 360;
        const swapped = norm === 90 || norm === 270;

        // Габариты объекта в его ЛОКАЛЬНЫХ осях (до учёта поворота): при 90/270
        // мировые ширина/высота меняются местами, поэтому берём scaledHeight как
        // локальную ширину и наоборот — иначе размеры округлялись «не в ту ось».
        const localW = swapped ? activeObj.getScaledHeight() : activeObj.getScaledWidth();
        const localH = swapped ? activeObj.getScaledWidth() : activeObj.getScaledHeight();
        const snappedLocalW = Math.max(step, snapValue(localW));
        const snappedLocalH = Math.max(step, snapValue(localH));

        activeObj.set({ scaleX: snappedLocalW / (w || 1), scaleY: snappedLocalH / (h || 1) });
        activeObj.setCoords();
        const pos = snapObjectToGrid(activeObj);
        if (pos) activeObj.set(pos);
        activeObj.setCoords();
        canvas.requestRenderAll();
      }
      const before = id ? useGardenStore.getState().objects.find((o) => o.id === id) : undefined;
      syncFabricObjectToStore(activeObj);
      if (!before) return;
      // События в журнал (wayback machine): отдельно перемещение и отдельно resize.
      const movedFlag =
        Math.abs(before.x - (activeObj.left ?? 0)) > 1 || Math.abs(before.y - (activeObj.top ?? 0)) > 1;
      const w = Math.round(activeObj.getScaledWidth());
      const h = Math.round(activeObj.getScaledHeight());
      const resizedFlag = Math.abs((before.width ?? 0) - w) > 1 || Math.abs((before.height ?? 0) - h) > 1;
      if (movedFlag) {
        useGardenStore.getState().addEvent(
          makeEvent('moved', before, `Перемещено: ${before.name} → (${Math.round(activeObj.left ?? 0)}; ${Math.round(activeObj.top ?? 0)})`),
        );
      }
      if (resizedFlag) {
        useGardenStore.getState().addEvent(
          makeEvent('resized', before, `Изменён размер: ${before.name} → ${w}×${h}`),
        );
      }
    };

    const finalizeBedDraft = (point: Point): void => {
      const draft = bedDraftRef.current;
      if (!draft) return;
      if (draft.preview) canvas.remove(draft.preview);

      const left = Math.min(draft.start.x, point.x);
      const top = Math.min(draft.start.y, point.y);
      const width = Math.max(Math.abs(point.x - draft.start.x), 1);
      const height = Math.max(Math.abs(point.y - draft.start.y), 1);

      const gs = useGardenStore.getState();
      const bedsCount = gs.objects.filter((o) => o.type === 'bed').length + 1;
      // Snap to grid — опциональная фича (кнопка в Toolbar): при включённой
      // привязке координаты и размеры новой грядки округляются до шага сетки;
      // при выключенной — грядка остаётся в произвольном месте.
      const snapOn = useCanvasStore.getState().snapToGrid;
      const entry = createGardenObjectEntry(
        'bed',
        `Грядка ${bedsCount}`,
        gs.currentYear,
        snapOn ? snapValue(left) : left,
        snapOn ? snapValue(top) : top,
        snapOn ? Math.max(getEffectiveGridStep(), snapValue(width)) : Math.max(1, width),
        snapOn ? Math.max(getEffectiveGridStep(), snapValue(height)) : Math.max(1, height),
        undefined,
        gs.viewDate ?? undefined, // wayback: посадка «в этот день», если выбрана дата просмотра
      );

      // fabric-объект строится из записи store — тот же путь, что и при загрузке проекта
      const rect = createFabricObjectFromEntry(entry);
      markAsCreatedOnCanvas(rect);

      gs.addObject(entry);
      canvas.add(rect);
      canvas.setActiveObject(rect);
      selectByObject(rect);
      canvas.renderAll();

      // Инструмент остаётся активным — можно ставить несколько грядок подряд.
      // Выход: Escape или повторный клик по кнопке «Грядка» в тулбаре.
      bedDraftRef.current = null;
    };

    const placeTreeMarker = (pointer: Point, plantDate?: string | null, parentId?: string | null): void => {
      placeMarkerEntry('tree', 'Яблоня', MARKER_SIZE, pointer, plantDate ?? undefined, undefined, undefined, undefined, parentId);
    };

    // Размещение произвольного шаблона из Библиотеки объектов ('place:<itemId>').
    const placeLibraryItem = (pointer: Point, itemId: string, parentId?: string | null): void => {
      const tpl = getLibraryItem(itemId);
      if (!tpl) return;
      const dp = tpl.defaultProperties;
      const defW = typeof dp.width === 'number' ? dp.width : undefined;
      const defH = typeof dp.height === 'number' ? dp.height : undefined;
      const crown = typeof dp.crownDiameter === 'number' ? dp.crownDiameter : undefined;
      const widthPx = defW !== undefined ? defW * PIXELS_PER_METER : crown !== undefined ? crown * PIXELS_PER_METER : MARKER_SIZE;
      const heightPx = defH !== undefined ? defH * PIXELS_PER_METER : crown !== undefined ? crown * PIXELS_PER_METER : MARKER_SIZE;
      const emoji = tpl.objectType === 'tree' ? EMOJI_BY_LIBRARY_ID[itemId] ?? '🌳' : null;
      placeMarkerEntry(tpl.objectType, tpl.name, widthPx, pointer, undefined, heightPx, emoji, itemId, parentId);
    };

    // Общий путь создания записи + fabric-объекта (дерево/метка/шаблон библиотеки).
    const placeMarkerEntry = (
      type: GardenObjectType,
      name: string,
      width: number,
      pointer: Point,
      plantDate?: string,
      height?: number,
      customIcon?: string | null,
      libraryItemId?: string,
      parentId?: string | null,
    ): void => {
      const snapped = getSnapPoint(pointer.x, pointer.y);
      const gs = useGardenStore.getState();
      const entry = createGardenObjectEntry(
        type,
        name,
        gs.currentYear,
        snapped.x,
        snapped.y,
        width,
        height ?? width,
        customIcon,
        plantDate,
        libraryItemId,
      );
      // Растение, посаженное кликом внутри грядки/парника, привязывается к нему.
      if (parentId) entry.parentId = parentId;
      gs.addObject(entry);

      const marker = createFabricObjectFromEntry(entry);
      markAsCreatedOnCanvas(marker);
      canvas.add(marker);
      canvas.setActiveObject(marker);
      selectByObject(marker);
      canvas.renderAll();
      // Инструмент остаётся активным — можно ставить несколько объектов подряд.
    };

    const handleMouseDown = (event: TPointerEventInfo<TPointerEvent>): void => {
      const tool = activeToolRef.current;
      const raw = event.e as PointerEvent;
      const mouseButton = typeof raw.button === 'number' ? raw.button : 0;
      const isMiddle = mouseButton === 1;
      const isSpaceAndLeft = mouseButton === 0 && isSpacePressedRef.current;
      const isPanToolAndLeft = mouseButton === 0 && tool === 'pan';

      if (isMiddle || isSpaceAndLeft || isPanToolAndLeft) {
        if (isMiddle) raw.preventDefault();
        const rect = canvas.upperCanvasEl.getBoundingClientRect();
        const sx = raw.clientX - rect.left;
        const sy = raw.clientY - rect.top;
        isPanningRef.current = true;
        lastScreenPosRef.current = { x: sx, y: sy };
        canvas.defaultCursor = 'grabbing';
        canvas.hoverCursor = 'grabbing';
        canvas.moveCursor = 'grabbing';
        return;
      }

      if (tool === 'select') {
        const target = canvas.findTarget(event.e) as unknown as FabricObject | null;
        if (!target) {
          canvas.discardActiveObject();
          canvas.renderAll();
          selectByObject(null);
        }
        return;
      }

      // Инструменты размещения: клик по существующему объекту или его
      // контролам НЕ должен создавать новый объект — перемещение/ресайз
      // обрабатывает сам Fabric.js (нативное поведение).
      // ВАЖНО: event.target в Fabric v6 может быть не самим объектом, а его
      // дочерним элементом (например, Text внутри Group) или ActiveSelection.
      // Поэтому идём вверх по иерархии через parent, пока не найдём корневой
      // интерактивный объект с gardenId.
      const findRootInteractive = (t: unknown): FabricObject | null => {
        let cur = t as FabricObject | null;
        while (cur) {
          if (getGardenId(cur)) return cur;
          const p = (cur as unknown as { parent?: FabricObject }).parent;
          if (!p || p.type === 'canvas') break;
          cur = p;
        }
        return null;
      };

      const downTarget = findRootInteractive(event.target);
      let placementParentId: string | null = null;
      if (downTarget) {
        const targetType = getObjectType(downTarget);
        const isContainer = targetType === 'bed' || targetType === 'greenhouse';
        const plantTool = tool === 'bed' ? false : isPlantTool(tool);
        // Размещение растения ВНУТРИ контейнера разрешено всегда (по согласованной логике),
        // остальные клики по объектам игнорируем — пусть Fabric двигает/ресайзит.
        if (!(isContainer && plantTool)) return;
        placementParentId = getGardenId(downTarget);
      }

      // Shift + перетаскивание при активном инструменте рисования — переместить объект,
      // не выходя из режима добавления.
      const rawDown = event.e as PointerEvent;
      if (rawDown.button === 0 && rawDown.shiftKey) {
        const shiftTarget = canvas.findTarget(event.e) as unknown as FabricObject | null;
        if (shiftTarget && getGardenId(shiftTarget)) {
          shiftTarget.selectable = true;
          canvas.setActiveObject(shiftTarget);
          canvas.requestRenderAll();
          return;
        }
      }

      if (tool === 'bed') {
        const pointer = canvas.getScenePoint(event.e);
        const snapped = getSnapPoint(pointer.x, pointer.y);
        const point = new Point(snapped.x, snapped.y);

        if (!bedDraftRef.current) {
          const preview = new Rect({
            left: point.x,
            top: point.y,
            width: 1,
            height: 1,
            fill: 'rgba(76, 175, 80, 0.2)',
            stroke: '#4CAF50',
            strokeWidth: 2,
            selectable: false,
            evented: false,
            originX: 'left',
            originY: 'top',
          });
          bedDraftRef.current = { start: point, preview };
          canvas.add(preview);
          canvas.renderAll();
          return;
        }
        finalizeBedDraft(point);
        return;
      }

      if (tool === 'tree') {
        placeTreeMarker(canvas.getScenePoint(event.e), useGardenStore.getState().viewDate, placementParentId);
        return;
      }

      // Инструменты размещения из Библиотеки объектов: 'place:<itemId>'.
      if (tool.startsWith('place:')) {
        placeLibraryItem(canvas.getScenePoint(event.e), tool.slice('place:'.length), placementParentId);
      }
    };

    const handleMouseMove = (event: TPointerEventInfo<TPointerEvent>): void => {
      if (isPanningRef.current) {
        const raw = event.e as PointerEvent;
        const rect = canvas.upperCanvasEl.getBoundingClientRect();
        const sx = raw.clientX - rect.left;
        const sy = raw.clientY - rect.top;
        const last = lastScreenPosRef.current ?? { x: sx, y: sy };
        canvas.relativePan(new Point(sx - last.x, sy - last.y));
        lastScreenPosRef.current = { x: sx, y: sy };
        canvas.renderAll();
        return;
      }

      if (activeToolRef.current !== 'bed' || !bedDraftRef.current) return;

      const pointer = canvas.getScenePoint(event.e);
      const snapped = getSnapPoint(pointer.x, pointer.y);
      const draft = bedDraftRef.current;
      const left = Math.min(draft.start.x, snapped.x);
      const top = Math.min(draft.start.y, snapped.y);
      draft.preview?.set({
        left,
        top,
        width: Math.max(Math.abs(snapped.x - draft.start.x), 1),
        height: Math.max(Math.abs(snapped.y - draft.start.y), 1),
      });
      canvas.renderAll();
    };

    const handleMouseUp = (): void => {
      isPanningRef.current = false;
      lastScreenPosRef.current = null;
      cursorsForTool(canvas, useCanvasStore.getState().activeTool, isSpacePressedRef.current);
    };

    const handleDoubleClick = (): void => {
      if (activeToolRef.current === 'bed' && bedDraftRef.current) {
        if (bedDraftRef.current.preview) canvas.remove(bedDraftRef.current.preview);
        bedDraftRef.current = null;
        canvas.renderAll();
      }
    };

    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      // Сначала отменяем незавершённое превью грядки, затем выходим из режима рисования.
      if (bedDraftRef.current) {
        if (bedDraftRef.current.preview) canvas.remove(bedDraftRef.current.preview);
        bedDraftRef.current = null;
        canvas.renderAll();
      }
      const t = activeToolRef.current;
      if (t === 'bed' || t === 'tree' || t.startsWith('place:')) {
        useCanvasStore.getState().setActiveTool('select');
      }
    };

    const deleteSelected = (): void => {
      // Поддержка мультивыделения: при рамочном/Shift-выделении Fabric создаёт
      // ActiveObject (type 'activeSelection'), внутри которого лежат все выбранные
      // объекты. Удаляем каждый из них полностью (destroyObject), иначе удалялся бы
      // только один объект, а группа молча исчезала с canvas без изменений в store.
      const isRemovable = (obj: FabricObject): boolean =>
        !isBackgroundObject(obj) && !isTransplantLine(obj) && !!getGardenId(obj);

      const activeObj = canvas.getActiveObject();
      if (!activeObj) return;

      const targets: FabricObject[] =
        activeObj.type === 'activeSelection'
          ? (activeObj as unknown as { getObjects: () => FabricObject[] })
              .getObjects()
              .filter(isRemovable)
          : isRemovable(activeObj)
            ? [activeObj]
            : [];

      if (targets.length === 0) return;

      // ВАЖНО (баг «нажал DEL — объекты не исчезли, при перемотке даты
      // сместились вправо-вниз, выделение осталось, дальше ничего не
      // выделяется»). Причина №1 — ПОРЯДОК ОПЕРАЦИЙ:
      //
      // В fabric v7 discardActiveObject() вызывает ActiveSelection.onDeselect()
      // -> removeAll(): все дети группы возвращаются в canvas._objects на свои
      // реальные координаты. Если удалить их из canvas ДО этого момента, то
      // indexOf в canvas._objects их не найдёт (дети ещё внутри группы) — remove
      // станет молчаливым no-op, а последующий removeAll() вернёт их обратно как
      // «фантомов»: рамки останутся, объекты оживут при перемотке дня
      // (пересоздание из store по старым x/y), hit-test рассинхронизируется.
      //
      // Поэтому порядок строго такой:
      //   1) snapshot целей;
      //   2) discardActiveObject() — дети уже в _objects;
      //   3) canvas.remove(...targets) — теперь indexOf их реально вырезает;
      //   4) чистим store ПОСЛЕ canvas, чтобы ни одна подписка на visibleIds
      //      не увидела фантомные объекты.
      //
      // Причина №2 — СЕМАНТИКА УДАЛЕНИЯ. removeObject — это «выкопка»
      // (soft-delete): removedAt = текущая дата просмотра, а по правилу wayback
      // в сам день выкопки объект ещё виден (removedAt < now — строго меньше).
      // Поэтому после DEL объекты оставались и на схеме, и в инвентаре вплоть
      // до следующего дня («ничего не меняется»). Клавиша Delete убирает
      // объект немедленно везде — destroyObject (полное удаление во всех
      // временных срезах); «выкопка с сохранением в истории» доступна
      // отдельным действием в панели свойств.
      const toRemove = [...targets];

      // 1) Сбрасываем выделение: onDeselect возвращает детей в
      //    canvas._objects на их реальных координатах.
      canvas.discardActiveObject();
      // 2) Вырезаем цели из canvas — теперь они топ-левел элементы
      //    _objects и indexOf их находит (пока дети в группе — no-op).
      canvas.remove(...toRemove);
      // 3) Чистим store ПОСЛЕ canvas: ни одна подписка на visibleIds не
      //    должна увидеть фантомные объекты.
      selectByObject(null);
      const destroyObject = useGardenStore.getState().destroyObject;
      for (const obj of toRemove) {
        const id = getGardenId(obj);
        if (!id) continue;
        // Клавиша Delete — полное удаление объекта (со схемы И из
        // инвентаря, во всех временных срезах). Для «выкопки с историей»
        // используется отдельное действие в панели свойств.
        destroyObject(id);
      }
      // 4) Принудительная перерисовка: удалённые объекты гарантированно
      //    исчезают со схемы сразу, без ожидания reconcile от стора.
      canvas.renderAll();
    };

    // Пересадка из панели свойств: старая запись выкапывается, новая садится
    // рядом с сохранением всех свойств. Добавляем fabric-объект вручную,
    // помечая его как созданный на canvas (не пересоздавать при reconcile).
    const onTransplantCommitted = (entry: GardenObject | null): void => {
      if (!entry) return;
      const marker = createFabricObjectFromEntry(entry);
      markAsCreatedOnCanvas(marker);
      canvas.add(marker);
      canvas.setActiveObject(marker);
      selectByObject(marker);
      canvas.renderAll();
    };
    const transplantHandler = (event: Event): void => {
      onTransplantCommitted((event as CustomEvent<GardenObject | null>).detail);
    };
    window.addEventListener('garden:transplanted', transplantHandler);

    const onKeyDownDelete = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      const isEditable =
        !!target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || Boolean(target.isContentEditable));
      if (isEditable) return;
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        deleteSelected();
      }
    };

    canvas.on('mouse:wheel', onWheel);
    canvas.on('mouse:down', handleMouseDown);
    canvas.on('mouse:move', handleMouseMove);
    canvas.on('mouse:up', handleMouseUp);
    canvas.on('mouse:dblclick', handleDoubleClick);
    canvas.on('selection:created', onSelectionChanged);
    canvas.on('selection:updated', onSelectionChanged);
    canvas.on('selection:cleared', () => selectByObject(null));
    // Snap to grid при перемещении: «прилипает» к сетке в реальном времени.
    // Центр объекта привязывается к ближайшей точке сетки; модификатор Alt —
    // временное отключение привязки внутри текущего действия.
    // ВАЖНО: при угле, кратном 90°, left/top корректируются на половины
    // bounding box (w↔h меняются местами) — иначе повёрнутый прямоугольник
    // при перемещении уезжал от сетки на половину разницы размеров.
    const onObjectMoving = (e: { target?: FabricObject | null; e?: unknown }): void => {
      const obj = e.target;
      if (!obj) return;
      if (isBackgroundObject(obj) || isTransplantLine(obj)) return;
      const rawEvt = e.e as PointerEvent | KeyboardEvent | undefined;
      if (rawEvt && 'altKey' in rawEvt && rawEvt.altKey) return;
      // Мультивыделение (ActiveSelection): привязка к сетке всей группы по её
      // общему центру — иначе группа игнорировала snap entirely.
      if (obj.type === 'activeSelection') {
        const pos = snapObjectToGrid(obj);
        if (pos) obj.set(pos);
        return;
      }
      const pos = snapObjectToGrid(obj);
      if (!pos) return;
      obj.set(pos);
    };
    canvas.on('object:moving', onObjectMoving);
    // Snap при изменении размера: габариты округляются до кратных шагу сетки
    // в реальном времени. Неподвижный противоположный угол (origin трансформации)
    // остаётся на месте — объект растёт «от» него, как при обычном drag'е.
    const onObjectScaling = (opt: BasicTransformEvent<TPointerEvent>): void => {
      // В рантайме Fabric заполняет transform числами (координаты точки фиксации),
      // хотя в типах originX/originY — строковые 'left'|'center'|… .
      const tr = opt.transform as unknown as {
        target?: FabricObject;
        corner?: string;
        originX?: number;
        originY?: number;
        original?: { width: number; height: number };
      } | undefined;
      const obj = tr?.target;
      if (!obj || !tr || !tr.corner || !tr.original) return;
      if (isBackgroundObject(obj) || isTransplantLine(obj)) return;
      const rawEvt = opt.e as PointerEvent | undefined;
      if (rawEvt?.altKey) return;
      const step = getEffectiveGridStep();
      if (!step) return;

      const pointer = canvas.getScenePoint(opt.e);
      // Вектор от неподвижного угла к курсору — в локальных осях объекта
      // (с учётом угла поворота), как это делает сам Fabric.js.
      let dx = pointer.x - (tr.originX ?? 0);
      let dy = pointer.y - (tr.originY ?? 0);
      const ang = obj.angle ?? 0;
      if (ang) {
        const rad = (-ang * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const px = dx;
        const py = dy;
        dx = px * cos - py * sin;
        dy = px * sin + py * cos;
      }
      const wSign = tr.corner.includes('l') ? -1 : tr.corner.includes('r') ? 1 : 0;
      const hSign = tr.corner.includes('t') ? -1 : tr.corner.includes('b') ? 1 : 0;
      const baseW = tr.original.width;
      const baseH = tr.original.height;
      const newW = wSign !== 0 ? Math.max(step, snapValue(Math.abs(dx)) || step) : (obj.scaleX ?? 1) * baseW;
      const newH = hSign !== 0 ? Math.max(step, snapValue(Math.abs(dy)) || step) : (obj.scaleY ?? 1) * baseH;
      obj.set({ scaleX: newW / baseW, scaleY: newH / baseH });

      // Позиционируем объект так, чтобы его локальный угол (wSign,hSign)
      // совпал с неподвижной точкой origin.
      const halfW = newW / 2;
      const halfH = newH / 2;
      let cx = (tr.originX ?? 0) + (wSign * halfW);
      let cy = (tr.originY ?? 0) + (hSign * halfH);
      if (ang) {
        // смещение от центра к углу в мировых координатах (противоположный поворот)
        const rad = (ang * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const ux = wSign * halfW;
        const uy = hSign * halfH;
        cx = (tr.originX ?? 0) + (ux * cos - uy * sin);
        cy = (tr.originY ?? 0) + (ux * sin + uy * cos);
      }
      obj.set({ left: cx, top: cy });
      obj.setCoords();
      canvas.requestRenderAll();
    };
    canvas.on('object:scaling', onObjectScaling);
    canvas.on('object:modified', onObjectModified);

    window.addEventListener('keydown', handleEscape);
    window.addEventListener('keydown', onKeyDownDelete);

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      canvas.setDimensions({ width, height });
      drawGrid(canvas, useCanvasStore.getState().gridStep);
    });
    resizeObserver.observe(container);

    return () => {
      canvas.off('mouse:wheel', onWheel);
      canvas.off('mouse:down', handleMouseDown);
      canvas.off('mouse:move', handleMouseMove);
      canvas.off('mouse:up', handleMouseUp);
      canvas.off('mouse:dblclick', handleDoubleClick);
      canvas.off('selection:created', onSelectionChanged);
      canvas.off('selection:updated', onSelectionChanged);
      canvas.off('selection:cleared');
      canvas.off('object:moving', onObjectMoving);
      canvas.off('object:modified', onObjectModified);
      window.removeEventListener('keydown', handleEscape);
      window.removeEventListener('keydown', onKeyDownDelete);
      resizeObserver.disconnect();
      window.removeEventListener('garden:transplanted', transplantHandler);
      canvas.dispose();
      if (fabricRef.current === canvas) fabricRef.current = null;
      setCanvas(null);
    };
  }, [setCanvas]);

  // Зум/сетка/инструменты/фон — реакции на изменения canvas-домена
  useEffect(() => {
    if (fabricRef.current) applyZoom(fabricRef.current, scale);
  }, [scale]);

  useEffect(() => {
    if (fabricRef.current) drawGrid(fabricRef.current, gridStep);
  }, [gridStep]);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    canvas.selection = activeTool === 'select';
    cursorsForTool(canvas, activeTool, isSpacePressedRef.current);

    if (activeTool === 'bed' || activeTool === 'tree' || activeTool === 'pan' || activeTool.startsWith('place:')) {
      if (bedDraftRef.current?.preview) {
        canvas.remove(bedDraftRef.current.preview);
        bedDraftRef.current = null;
      }
      canvas.discardActiveObject();
      useGardenStore.getState().selectObject(null);
    } else {
      const selectedId = useGardenStore.getState().selectedObjectId;
      if (selectedId) {
        const obj = findObjectByGardenId(canvas, selectedId);
        if (obj) canvas.setActiveObject(obj);
      }
    }
    canvas.renderAll();
  }, [activeTool]);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    if (!backgroundImage) {
      const bg = canvas.getObjects().find(isBackgroundObject);
      if (bg) {
        canvas.remove(bg);
        canvas.renderAll();
      }
      return;
    }
    void loadBackgroundImage(canvas, backgroundImage).then(() => {
      if (!fabricRef.current) return;
      setBackgroundSelectable(fabricRef.current, !useCanvasStore.getState().backgroundLocked);
    });
  }, [backgroundImage]);

  useEffect(() => {
    if (fabricRef.current) setBackgroundSelectable(fabricRef.current, !backgroundLocked);
  }, [backgroundLocked]);

  // Синхронизация слоя объектов при смене года/даты просмотра (wayback machine)
  // или изменении набора видимых объектов (загрузка проекта, добавление/удаление).
  const currentYear = useGardenStore((s) => s.currentYear);
  const viewDate = useGardenStore((s) => s.viewDate);
  // В подписке считаем «актуальное место» для цепочек пересадок: промежуточные
  // места скрыты, пока следующая запись цепочки жива (см. visibleObjects).
  const visibleIds = useGardenStore((s) => {
    const byId = new Map(s.objects.map((o) => [o.id, o]));
    return s.objects
      .filter((o) => {
        if (!isVisibleAt(o, s.currentYear, s.viewDate)) return false;
        if (o.transplantedToId) {
          const next = byId.get(o.transplantedToId);
          // следующее место цепочки живо — старое не показываем
          if (next && isVisibleAt(next, s.currentYear, s.viewDate)) return false;
        }
        return true;
      })
      .map((o) => o.id)
      .join(',');
  });
  useEffect(() => {
    if (fabricRef.current) reconcileObjectsWithStore(fabricRef.current);
  }, [visibleIds, currentYear, viewDate]);

  // Подсказки пересадки зависят от выбора объекта (клик по пересаженному —
  // показать стрелку и «призрак» прежнего места; снятие выделения — убрать).
  const selectedObjectId = useGardenStore((s) => s.selectedObjectId);
  useEffect(() => {
    if (fabricRef.current) drawTransplantHints(fabricRef.current);
  }, [selectedObjectId]);

  return (
    <div ref={containerRef} className="relative w-full h-full bg-background">
      <canvas ref={canvasElRef} />
    </div>
  );
}

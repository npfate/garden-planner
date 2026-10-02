import { useEffect, useRef } from 'react';
import { Canvas, FabricImage, Group, Line, Point, Rect } from 'fabric';
import type { TPointerEvent, TPointerEventInfo, FabricObject } from 'fabric';
import { useGardenStore, type ToolId } from '../../store/gardenStore';
import type { GardenObject, GardenObjectType } from '../../types/garden';

const PIXELS_PER_METER = 50;
const GRID_COLOR = '#E5E7EB';
const ZOOM_FACTOR = 1.1;
const MIN_SCALE = 10;
const MAX_SCALE = 500;
const MARKER_SIZE = 10;

type CanvasAny = Record<string, unknown>;

function sendObjectToBottom(canvas: Canvas, obj: Line | Group | FabricImage): void {
  canvas.sendObjectToBack(obj);
  canvas.renderAll();
}

function findBackground(canvas: Canvas): FabricImage | undefined {
  return canvas.getObjects().find((o) => {
    if (!(o instanceof FabricImage)) return false;
    // @ts-expect-error custom runtime property
    return o.__gardenBackground === true;
  }) as FabricImage | undefined;
}

function removeBackground(canvas: Canvas): void {
  const bg = findBackground(canvas);
  if (bg) canvas.remove(bg);
}

function getSnapPoint(x: number, y: number): { x: number; y: number } {
  const grid = useGardenStore.getState().gridStep;
  const scale = useGardenStore.getState().scale;
  if (!useGardenStore.getState().snapToGrid) return { x, y };

  const effectiveStep = Math.max(1, grid * PIXELS_PER_METER * (scale / 100));
  return {
    x: Math.round(x / effectiveStep) * effectiveStep,
    y: Math.round(y / effectiveStep) * effectiveStep,
  };
}

function createGardenObjectEntry(
  type: GardenObjectType,
  name: string,
  year: number,
  x: number,
  y: number,
  width = MARKER_SIZE,
  height = MARKER_SIZE,
  customIcon?: string | null,
): GardenObject {
  const now = new Date().toISOString();
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
    history: {
      [year]: {
        harvest: 0,
      },
    },
    customIcon: customIcon ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

export async function loadBackgroundImage(canvas: Canvas, url: string): Promise<void> {
  const img = await FabricImage.fromURL(url, {
    crossOrigin: 'anonymous',
  });
  removeBackground(canvas);
  const cw = canvas.getWidth();
  const ch = canvas.getHeight();
  const iw = img.width ?? cw;
  const ih = img.height ?? ch;
  const scale = Math.min(cw / iw, ch / ih, 1);
  img.set({
    left: (cw - iw * scale) / 2,
    top: (ch - ih * scale) / 2,
    scaleX: scale,
    scaleY: scale,
    selectable: true,
    evented: true,
    hasControls: true,
  });
  // @ts-expect-error custom runtime flag
  img.__gardenBackground = true;
  canvas.add(img);
  canvas.sendObjectToBack(img);
  canvas.renderAll();
}

export function setBackgroundSelectable(canvas: Canvas, selectable: boolean): void {
  const bg = findBackground(canvas);
  if (!bg) return;
  bg.set({
    selectable,
    evented: selectable,
    hasControls: selectable,
    hoverCursor: selectable ? 'move' : 'default',
  });
  canvas.renderAll();
}

function drawGrid(canvas: Canvas, gridStepMeters: number): void {
  const width = canvas.getWidth();
  const height = canvas.getHeight();
  const step = Math.max(1, gridStepMeters * PIXELS_PER_METER);

  const oldGrid = canvas.getObjects().find((o) => {
    // @ts-expect-error custom runtime property
    return o.__gardenGrid === true;
  }) as Group | undefined;
  if (oldGrid) {
    canvas.remove(oldGrid);
  }

  const lines: Line[] = [];

  for (let x = 0; x <= width; x += step) {
    lines.push(
      new Line([x, 0, x, height], {
        stroke: GRID_COLOR,
        strokeWidth: 1,
        selectable: false,
        evented: false,
        excludeFromExport: false,
      }),
    );
  }

  for (let y = 0; y <= height; y += step) {
    lines.push(
      new Line([0, y, width, y], {
        stroke: GRID_COLOR,
        strokeWidth: 1,
        selectable: false,
        evented: false,
        excludeFromExport: false,
      }),
    );
  }

  const gridGroup = new Group(lines, {
    selectable: false,
    evented: false,
    hoverCursor: 'default',
  });
  // @ts-expect-error custom runtime flag
  gridGroup.__gardenGrid = true;

  canvas.add(gridGroup);
  sendObjectToBottom(canvas, gridGroup);

  const bg = findBackground(canvas);
  if (bg) {
    sendObjectToBottom(canvas, bg);
  }
}

function applyZoom(canvas: Canvas, newScalePercent: number, centerPoint?: Point): void {
  const clamped = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScalePercent));
  const zoom = clamped / 100;
  const point = centerPoint ?? new Point(canvas.getWidth() / 2, canvas.getHeight() / 2);
  canvas.zoomToPoint(point, zoom);
  canvas.renderAll();
}

function syncFabricObjectToStore(canvas: Canvas): void {
  const activeObject = canvas.getActiveObject();
  if (!activeObject) return;

  const objectId = activeObject.get('gardenObjectId') ?? activeObject.get('objectId');
  if (!objectId || typeof objectId !== 'string') return;

  const width = activeObject.getScaledWidth
    ? activeObject.getScaledWidth()
    : activeObject.width ?? 0;
  const height = activeObject.getScaledHeight
    ? activeObject.getScaledHeight()
    : activeObject.height ?? 0;

  useGardenStore.getState().updateObject(objectId, {
    x: activeObject.left ?? 0,
    y: activeObject.top ?? 0,
    width,
    height,
    rotation: activeObject.angle ?? 0,
    updatedAt: new Date().toISOString(),
  });
}

function createBedPreview(start: Point, end: Point): Rect {
  const left = Math.min(start.x, end.x);
  const top = Math.min(start.y, end.y);
  const width = Math.max(Math.abs(end.x - start.x), 1);
  const height = Math.max(Math.abs(end.y - start.y), 1);

  return new Rect({
    left,
    top,
    width,
    height,
    fill: 'rgba(76, 175, 80, 0.2)',
    stroke: '#4CAF50',
    strokeWidth: 2,
    selectable: false,
    evented: false,
    hasControls: false,
    hasBorders: false,
    objectCaching: false,
    originX: 'left',
    originY: 'top',
  });
}

export default function GardenCanvas() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const activeToolRef = useRef<ToolId>('select');
  const bedDraftRef = useRef<{ start: Point; preview: Rect | null } | null>(null);
  const isSpacePressedRef = useRef<boolean>(false);

  const setCanvas = useGardenStore((s) => s.setCanvas);
  const setScale = useGardenStore((s) => s.setScale);
  const gridStep = useGardenStore((s) => s.gridStep);
  const scale = useGardenStore((s) => s.scale);
  const activeTool = useGardenStore((s) => s.activeTool);
  const backgroundImage = useGardenStore((s) => s.backgroundImage);
  const backgroundLocked = useGardenStore((s) => s.backgroundLocked);
  const selectObject = useGardenStore((s) => s.selectObject);

  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);

  // ----- Глобальные обработчики Пробела -----
  useEffect(() => {
    const setCursorIdle = () => {
      const c = fabricRef.current;
      if (!c) return;
      const tool = useGardenStore.getState().activeTool;
      if (tool === 'bed') {
        c.defaultCursor = 'crosshair';
        c.hoverCursor = 'crosshair';
        return;
      }
      if (tool === 'pan') {
        c.defaultCursor = 'grab';
        c.hoverCursor = 'grab';
        c.moveCursor = 'grab';
        return;
      }
      // select
      c.defaultCursor = 'default';
      c.hoverCursor = 'move';
      c.moveCursor = 'move';
    };

    const onKeyDown = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement | null;
      const isEditable =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          Boolean(target.isContentEditable));
      if (e.code !== 'Space' || e.repeat || isEditable) return;
      e.preventDefault();
      if (isSpacePressedRef.current) return;
      isSpacePressedRef.current = true;
      const c = fabricRef.current as CanvasAny | null;
      if (c && c.isDragging !== true) {
        setCursorIdle();
        const fc = fabricRef.current;
        if (fc) {
          fc.defaultCursor = 'grab';
          fc.hoverCursor = 'grab';
          fc.moveCursor = 'grab';
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent): void => {
      if (e.code !== 'Space') return;
      e.preventDefault();
      isSpacePressedRef.current = false;
      const c = fabricRef.current as CanvasAny | null;
      if (!c || c.isDragging !== true) {
        setCursorIdle();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const { clientWidth, clientHeight } = containerRef.current;

    const canvas = new Canvas(canvasRef.current, {
      width: clientWidth,
      height: clientHeight,
      backgroundColor: '#F5F7FA',
      selection: true,
      preserveObjectStacking: true,
      allowTouchScrolling: true,
      fireRightClick: true,
      stopContextMenu: true,
    });

    fabricRef.current = canvas;
    setCanvas(canvas);
    drawGrid(canvas, useGardenStore.getState().gridStep);

    const onWheel = (opt: TPointerEventInfo<TPointerEvent>): void => {
      const evt = opt.e;
      const isWheel = typeof (evt as unknown as WheelEvent).deltaY === 'number';
      if (!isWheel || (!evt.ctrlKey && !evt.metaKey)) return;
      evt.preventDefault();
      evt.stopPropagation();

      const wheel = evt as unknown as WheelEvent;
      const currentScale = useGardenStore.getState().scale;
      const factor = wheel.deltaY < 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR;
      const next = Math.round(currentScale * factor);
      const clamped = Math.max(MIN_SCALE, Math.min(MAX_SCALE, next));
      const target = (wheel.currentTarget ?? canvas.lowerCanvasEl) as HTMLElement | null;
      const rect = target?.getBoundingClientRect();
      const pointer = new Point(
        rect ? wheel.clientX - rect.left : wheel.offsetX ?? 0,
        rect ? wheel.clientY - rect.top : wheel.offsetY ?? 0,
      );
      applyZoom(canvas, clamped, pointer);
      setScale(clamped);
    };

    const onSelectionChanged = (): void => {
      const activeObj = canvas.getActiveObject();
      if (!activeObj) {
        selectObject(null);
        return;
      }
      // Если выделена группа, берем первый объект для простоты
      const targetObj =
        activeObj.type === 'activeSelection'
          ? // @ts-expect-error ActiveSelection has getObjects
            (activeObj.getObjects() as FabricObject[])[0]
          : activeObj;

      const objectId =
        targetObj &&
        ((targetObj.get('gardenObjectId') as unknown) ??
          (targetObj.get('objectId') as unknown));
      selectObject(typeof objectId === 'string' ? objectId : null);
    };

    const onSelectionCleared = (): void => {
      selectObject(null);
    };

    const onObjectModified = (): void => {
      syncFabricObjectToStore(canvas);
      onSelectionChanged(); // Обновляем store при перемещении/масштабировании
    };

    const finalizeBedDraft = (point: Point): void => {
      const draft = bedDraftRef.current;
      if (!draft) return;

      if (draft.preview) {
        canvas.remove(draft.preview);
      }

      const start = draft.start;
      const left = Math.min(start.x, point.x);
      const top = Math.min(start.y, point.y);
      const width = Math.max(Math.abs(point.x - start.x), 1);
      const height = Math.max(Math.abs(point.y - start.y), 1);

      const rect = new Rect({
        left,
        top,
        width,
        height,
        fill: 'rgba(76, 175, 80, 0.2)',
        stroke: '#4CAF50',
        strokeWidth: 2,
        selectable: true,
        evented: true,
        hasControls: true,
        hasBorders: true,
        objectCaching: false,
      });

      const id = crypto.randomUUID();
      const currentYear = useGardenStore.getState().currentYear;
      const existingBeds =
        useGardenStore
          .getState()
          .objects.filter((item) => item.type === 'bed')
          .length + 1;
      const name = `Грядка ${existingBeds}`;

      const entry = createGardenObjectEntry('bed', name, currentYear, left, top, width, height);
      entry.id = id;

      rect.set('gardenObjectId', id);
      rect.set('objectType', 'bed');
      rect.set('name', name);
      rect.set('year', currentYear);

      canvas.add(rect);

      // 1. Добавляем в store
      useGardenStore.getState().addObject(entry);

      // 2. Делаем активным в canvas
      canvas.setActiveObject(rect);

      // 3. Синхронизируем выделение в store
      onSelectionChanged();

      canvas.renderAll();

      // 4. Переключаем инструмент (это запустит useEffect, который восстановит выделение)
      useGardenStore.getState().setActiveTool('select');
      activeToolRef.current = 'select';
      bedDraftRef.current = null;
    };

    const handleMouseDown = (event: TPointerEventInfo<TPointerEvent>): void => {
      const currentTool = activeToolRef.current;
      const canvasAny = canvas as unknown as CanvasAny;

      const raw = event.e as PointerEvent;
      const mouseButton = typeof raw.button === 'number' ? raw.button : 0;
      // 0 - ЛКМ, 1 - средняя (колесо), 2 - правая
      const isMiddle = mouseButton === 1;
      const isSpaceAndLeft = mouseButton === 0 && isSpacePressedRef.current;
      const isPanToolAndLeft = mouseButton === 0 && currentTool === 'pan';

      // --- Pan начало: ХОТЯ БЫ ОДНО из условий ---
      if (isMiddle || isSpaceAndLeft || isPanToolAndLeft) {
        if (isMiddle) raw.preventDefault();
        canvasAny.isDragging = true;
        const infoAny = event as unknown as { absolutePointer?: { x: number; y: number }; pointer?: { x: number; y: number } };
        const ptrRaw = infoAny.absolutePointer ?? infoAny.pointer ?? { x: 0, y: 0 };
        const ptr = new Point(ptrRaw.x, ptrRaw.y);
        canvasAny.lastPosX = ptr.x;
        canvasAny.lastPosY = ptr.y;
        // НЕ сбрасываем выделение, чтобы не сбросить случайно
        canvas.defaultCursor = 'grabbing';
        canvas.hoverCursor = 'grabbing';
        canvas.moveCursor = 'grabbing';
        return; // ← Pan приоритет: не запускаем select/bed логику
      }

      if (currentTool === 'select') {
        // Если кликнули по пустому месту - снимаем выделение
        const target = canvas.findTarget(event.e) as unknown as FabricObject | null;
        if (!target) {
          canvas.discardActiveObject();
          canvas.renderAll();
          selectObject(null);
        }
        // Если кликнули по объекту, Fabric.js сам обработает выделение,
        // а onSelectionChanged обновит store.
        return;
      }

      if (currentTool === 'bed') {
        const pointer = canvas.getScenePoint(event.e);
        const snapped = getSnapPoint(pointer.x, pointer.y);
        const point = new Point(snapped.x, snapped.y);

        if (!bedDraftRef.current) {
          const preview = createBedPreview(point, point);
          bedDraftRef.current = { start: point, preview };
          canvas.add(preview);
          canvas.renderAll();
          return;
        }

        finalizeBedDraft(point);
      }
    };

    const handleMouseMove = (event: TPointerEventInfo<TPointerEvent>): void => {
      const canvasAny = canvas as unknown as CanvasAny;

      // --- Pan: двигаем схему ---
      if (canvasAny.isDragging === true) {
        const infoAny = event as unknown as { absolutePointer?: { x: number; y: number }; pointer?: { x: number; y: number } };
        const ptrRaw = infoAny.absolutePointer ?? infoAny.pointer ?? { x: 0, y: 0 };
        const ptr = new Point(ptrRaw.x, ptrRaw.y);
        const lastX = (canvasAny.lastPosX as number) ?? ptr.x;
        const lastY = (canvasAny.lastPosY as number) ?? ptr.y;
        const deltaX = ptr.x - lastX;
        const deltaY = ptr.y - lastY;
        canvas.relativePan(new Point(deltaX, deltaY));
        canvasAny.lastPosX = ptr.x;
        canvasAny.lastPosY = ptr.y;
        canvas.renderAll();
        return; // ← не рисуем превью грядки и т.д.
      }

      if (activeToolRef.current !== 'bed' || !bedDraftRef.current) return;

      const pointer = canvas.getScenePoint(event.e);
      const snapped = getSnapPoint(pointer.x, pointer.y);
      const nextPoint = new Point(snapped.x, snapped.y);
      const draft = bedDraftRef.current;
      const nextPreview = createBedPreview(draft.start, nextPoint);

      if (draft.preview) {
        canvas.remove(draft.preview);
      }

      draft.preview = nextPreview;
      canvas.add(nextPreview);
      canvas.renderAll();
    };

    const handleDoubleClick = (): void => {
      if (activeToolRef.current === 'bed' && bedDraftRef.current) {
        finalizeBedDraft(bedDraftRef.current.start);
      }
    };

    const handleMouseUp = (): void => {
      const canvasAny = canvas as unknown as CanvasAny;
      canvasAny.isDragging = false;

      // восстанавливаем курсор в зависимости от пробела и активного инструмента
      const tool = useGardenStore.getState().activeTool;
      if (isSpacePressedRef.current) {
        canvas.defaultCursor = 'grab';
        canvas.hoverCursor = 'grab';
        canvas.moveCursor = 'grab';
        return;
      }
      if (tool === 'bed') {
        canvas.defaultCursor = 'crosshair';
        canvas.hoverCursor = 'crosshair';
        return;
      }
      if (tool === 'pan') {
        canvas.defaultCursor = 'grab';
        canvas.hoverCursor = 'grab';
        canvas.moveCursor = 'grab';
        return;
      }
      // select
      canvas.defaultCursor = 'default';
      canvas.hoverCursor = 'move';
      canvas.moveCursor = 'move';
    };

    // --- Привязка событий ---
    canvas.on('mouse:wheel', onWheel);
    canvas.on('mouse:down', handleMouseDown);
    canvas.on('mouse:move', handleMouseMove);
    canvas.on('mouse:up', handleMouseUp);
    canvas.on('mouse:dblclick', handleDoubleClick);
    canvas.on('selection:created', onSelectionChanged);
    canvas.on('selection:updated', onSelectionChanged);
    canvas.on('selection:cleared', onSelectionCleared);
    canvas.on('object:modified', onObjectModified);
    canvas.on('object:moving', onObjectModified);
    canvas.on('object:scaling', onObjectModified);
    canvas.on('object:rotating', onObjectModified);

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry || !fabricRef.current) return;
      const { width, height } = entry.contentRect;
      fabricRef.current.setDimensions({ width, height });
      drawGrid(fabricRef.current, useGardenStore.getState().gridStep);
    });

    resizeObserver.observe(containerRef.current);

    // --- Очистка ---
    return () => {
      canvas.off('mouse:wheel', onWheel);
      canvas.off('mouse:down', handleMouseDown);
      canvas.off('mouse:move', handleMouseMove);
      canvas.off('mouse:up', handleMouseUp);
      canvas.off('mouse:dblclick', handleDoubleClick);
      canvas.off('selection:created', onSelectionChanged);
      canvas.off('selection:updated', onSelectionChanged);
      canvas.off('selection:cleared', onSelectionCleared);
      canvas.off('object:modified', onObjectModified);
      canvas.off('object:moving', onObjectModified);
      canvas.off('object:scaling', onObjectModified);
      canvas.off('object:rotating', onObjectModified);

      resizeObserver.disconnect();
      if (fabricRef.current) {
        fabricRef.current.dispose();
        fabricRef.current = null;
      }
      setCanvas(null);
    };
  }, [setCanvas, setScale, selectObject]);

  useEffect(() => {
    if (!fabricRef.current) return;
    applyZoom(fabricRef.current, scale);
  }, [scale]);

  useEffect(() => {
    if (!fabricRef.current) return;
    drawGrid(fabricRef.current, gridStep);
  }, [gridStep]);

  // --- Переключение инструментов: курсоры, выделяемость объектов ---
  useEffect(() => {
    if (!fabricRef.current) return;

    const canvas = fabricRef.current;

    // 1. Общие настройки по инструментам
    if (activeTool === 'bed') {
      canvas.selection = false;
      canvas.defaultCursor = 'crosshair';
      canvas.hoverCursor = 'crosshair';
      canvas.moveCursor = 'crosshair';
    } else if (activeTool === 'pan') {
      canvas.selection = false;
      canvas.defaultCursor = 'grab';
      canvas.hoverCursor = 'grab';
      canvas.moveCursor = 'grab';
    } else {
      // select
      canvas.selection = true;
      if (isSpacePressedRef.current) {
        canvas.defaultCursor = 'grab';
        canvas.hoverCursor = 'grab';
        canvas.moveCursor = 'grab';
      } else {
        canvas.defaultCursor = 'default';
        canvas.hoverCursor = 'move';
        canvas.moveCursor = 'move';
      }
    }

    // 2. Настройка selectable/evented на объектах (сетка/фон пропускаем)
    canvas.forEachObject((obj) => {
      // @ts-expect-error custom runtime property
      if (obj.__gardenGrid || obj.__gardenBackground) return;

      let isSelectable: boolean;
      if (activeTool === 'bed' || activeTool === 'pan') {
        isSelectable = false;
      } else {
        isSelectable = true;
      }
      obj.set({
        selectable: isSelectable,
        evented: isSelectable,
        hasControls: isSelectable,
        hasBorders: isSelectable,
      });
    });

    // 3. При pan/bed: сбрасываем active object, если есть
    if (activeTool === 'bed' || activeTool === 'pan') {
      canvas.discardActiveObject();
      useGardenStore.getState().selectObject(null);
    } else {
      // select: восстанавливаем выделение
      const selectedId = useGardenStore.getState().selectedObjectId;
      if (selectedId) {
        const obj = canvas
          .getObjects()
          .find(
            (o) =>
              (o.get('gardenObjectId') ?? o.get('objectId')) === selectedId,
          );
        if (obj) {
          canvas.setActiveObject(obj);
        }
      }
    }

    canvas.renderAll();
  }, [activeTool]);

  useEffect(() => {
    if (!fabricRef.current) return;

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (
        event.key !== 'Escape' ||
        activeToolRef.current !== 'bed' ||
        !bedDraftRef.current
      ) {
        return;
      }

      const preview = bedDraftRef.current.preview;
      if (preview) {
        fabricRef.current?.remove(preview);
      }
      bedDraftRef.current = null;
      fabricRef.current?.renderAll();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTool]);

  useEffect(() => {
    if (!fabricRef.current) return;
    if (!backgroundImage) {
      removeBackground(fabricRef.current);
      fabricRef.current.renderAll();
      return;
    }
    void loadBackgroundImage(fabricRef.current, backgroundImage).then(() => {
      if (!fabricRef.current) return;
      const locked = useGardenStore.getState().backgroundLocked;
      setBackgroundSelectable(fabricRef.current, !locked);
    });
  }, [backgroundImage]);

  useEffect(() => {
    if (!fabricRef.current) return;
    setBackgroundSelectable(fabricRef.current, !backgroundLocked);
  }, [backgroundLocked]);

  return (
    <div ref={containerRef} className="relative w-full h-full bg-background">
      <canvas ref={canvasRef} />
    </div>
  );
}

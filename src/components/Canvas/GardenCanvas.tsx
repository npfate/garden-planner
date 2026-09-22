import { useEffect, useRef } from 'react';
import { ActiveSelection, Canvas, FabricImage, Group, Line, Point, Polygon, type FabricObject } from 'fabric';
import type { TPointerEvent, TPointerEventInfo } from 'fabric';
import { useGardenStore, type ToolId } from '../../store/gardenStore';
import type { GardenObject, GardenObjectType } from '../../types/garden';

const PIXELS_PER_METER = 50;
const GRID_COLOR = '#E5E7EB';
const ZOOM_FACTOR = 1.1;
const MIN_SCALE = 10;
const MAX_SCALE = 500;
const MARKER_SIZE = 10;

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

  const objectId = activeObject.get('objectId');
  if (!objectId || typeof objectId !== 'string') return;

  const width = activeObject.getScaledWidth ? activeObject.getScaledWidth() : activeObject.width ?? 0;
  const height = activeObject.getScaledHeight ? activeObject.getScaledHeight() : activeObject.height ?? 0;

  useGardenStore.getState().updateObject(objectId, {
    x: activeObject.left ?? 0,
    y: activeObject.top ?? 0,
    width,
    height,
    rotation: activeObject.angle ?? 0,
    updatedAt: new Date().toISOString(),
  });
}

export default function GardenCanvas() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const activeToolRef = useRef<ToolId>('select');
  const bedPointsRef = useRef<Point[]>([]);

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
      const isWheel =
        typeof (evt as unknown as WheelEvent).deltaY === 'number' &&
        ((evt as unknown as WheelEvent).type === 'wheel' ||
          (evt as unknown as WheelEvent).type === 'mousewheel');
      if (!isWheel) return;
      if (!evt.ctrlKey && !evt.metaKey) return;
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

    const finalizeBedDraft = (): void => {
      if (bedPointsRef.current.length < 2) {
        bedPointsRef.current = [];
        return;
      }

      const points = bedPointsRef.current.map((point) => ({ ...point }));
      const minX = Math.min(...points.map((point) => point.x));
      const minY = Math.min(...points.map((point) => point.y));
      const maxX = Math.max(...points.map((point) => point.x));
      const maxY = Math.max(...points.map((point) => point.y));
      const bedPoints = [
        new Point(minX, minY),
        new Point(maxX, minY),
        new Point(maxX, maxY),
        new Point(minX, maxY),
      ];

      const polygon = new Polygon(bedPoints, {
        fill: '#facc15',
        stroke: '#1f2937',
        strokeWidth: 1,
        selectable: true,
        evented: true,
        hasControls: true,
        hasBorders: true,
        objectCaching: false,
      });
      const id = crypto.randomUUID();
      const bounds = polygon.getBoundingRect();
      const entry = createGardenObjectEntry(
        'bed',
        'Грядка',
        useGardenStore.getState().currentYear,
        bounds.left,
        bounds.top,
        bounds.width,
        bounds.height,
      );
      entry.id = id;
      polygon.set('objectId', id);
      polygon.set('objectType', 'bed');
      polygon.set('name', 'Грядка');
      polygon.set('year', useGardenStore.getState().currentYear);
      polygon.set('selectable', true);
      polygon.set('evented', true);
      canvas.add(polygon);
      canvas.setActiveObject(polygon);
      canvas.renderAll();
      useGardenStore.getState().addObject(entry);
      bedPointsRef.current = [];
    };

    const syncSelectionToStore = (selection: ActiveSelection | FabricObject | null): void => {
      if (!selection) {
        selectObject(null);
        return;
      }

      const object = selection instanceof ActiveSelection ? selection.getObjects()[0] : selection;
      const objectId = object?.get('gardenObjectId') ?? object?.get('objectId');
      if (typeof objectId === 'string') {
        selectObject(objectId);
      } else {
        selectObject(null);
      }
    };

    const handleCanvasClick = (event: TPointerEventInfo<TPointerEvent>): void => {
      const currentTool = activeToolRef.current;
      const target = canvas.findTarget(event.e) as { type?: string } | null;

      if (currentTool === 'select') {
        if (target && target.type && target.type !== 'group') {
          canvas.setActiveObject(target as never);
          canvas.renderAll();
          syncSelectionToStore(target as FabricObject);
          return;
        }

        canvas.discardActiveObject();
        canvas.renderAll();
        selectObject(null);
        return;
      }

      if (currentTool === 'bed') {
        const pointer = canvas.getScenePoint(event.e);
        const snapped = getSnapPoint(pointer.x, pointer.y);
        const point = new Point(snapped.x, snapped.y);
        bedPointsRef.current = [...bedPointsRef.current, point];

        const points = bedPointsRef.current;
        if (points.length >= 2) {
          const minX = Math.min(...points.map((p) => p.x));
          const minY = Math.min(...points.map((p) => p.y));
          const maxX = Math.max(...points.map((p) => p.x));
          const maxY = Math.max(...points.map((p) => p.y));
          const previewPoints = [
            new Point(minX, minY),
            new Point(maxX, minY),
            new Point(maxX, maxY),
            new Point(minX, maxY),
          ];

          const previous = canvas.getObjects().find((o) => o.get('objectType') === 'bed' && o.get('name') === 'Грядка-черновик');
          if (previous) canvas.remove(previous);

          const preview = new Polygon(previewPoints, {
            fill: '#facc15',
            stroke: '#1f2937',
            strokeWidth: 1,
            selectable: false,
            evented: false,
            objectCaching: false,
          });
          preview.set('name', 'Грядка-черновик');
          preview.set('objectType', 'bed');
          canvas.add(preview);
          canvas.renderAll();
        }
        return;
      }

    };

    const handleDoubleClick = (): void => {
      if (activeToolRef.current === 'bed') {
        finalizeBedDraft();
      }
    };

    const syncActiveObject = (): void => {
      syncFabricObjectToStore(canvas);
    };

    const syncSelectionChanged = (event: { selected?: FabricObject[] | FabricObject | null }): void => {
      const selected = event.selected ?? null;
      if (!selected) {
        selectObject(null);
        return;
      }

      const objects = Array.isArray(selected) ? selected : [selected];
      const first = objects[0];
      const objectId = first?.get('gardenObjectId') ?? first?.get('objectId');
      selectObject(typeof objectId === 'string' ? objectId : null);
    };

    canvas.on('mouse:wheel', onWheel);
    canvas.on('mouse:down', handleCanvasClick);
    canvas.on('mouse:dblclick', handleDoubleClick);
    canvas.on('selection:created', (event) => syncSelectionChanged(event));
    canvas.on('selection:updated', (event) => syncSelectionChanged(event));
    canvas.on('selection:cleared', () => selectObject(null));
    canvas.on('object:modified', () => {
      syncActiveObject();
      const activeObject = canvas.getActiveObject();
      const objectId = activeObject?.get('gardenObjectId') ?? activeObject?.get('objectId');
      if (typeof objectId === 'string') {
        selectObject(objectId);
      }
    });
    canvas.on('object:moving', syncActiveObject);
    canvas.on('object:scaling', syncActiveObject);
    canvas.on('object:rotating', syncActiveObject);

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry || !fabricRef.current) return;
      const { width, height } = entry.contentRect;
      fabricRef.current.setDimensions({ width, height });
      drawGrid(fabricRef.current, useGardenStore.getState().gridStep);
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      canvas.off('mouse:wheel', onWheel);
      canvas.off('mouse:down', handleCanvasClick);
      canvas.off('mouse:dblclick', handleDoubleClick);
      canvas.off('selection:created', (event) => syncSelectionChanged(event));
      canvas.off('selection:updated', (event) => syncSelectionChanged(event));
      canvas.off('selection:cleared', () => selectObject(null));
      canvas.off('object:modified', () => {
        syncActiveObject();
        const activeObject = canvas.getActiveObject();
        const objectId = activeObject?.get('gardenObjectId') ?? activeObject?.get('objectId');
        if (typeof objectId === 'string') {
          selectObject(objectId);
        }
      });
      canvas.off('object:moving', syncActiveObject);
      canvas.off('object:scaling', syncActiveObject);
      canvas.off('object:rotating', syncActiveObject);
      resizeObserver.disconnect();
      if (fabricRef.current) {
        fabricRef.current.dispose();
        fabricRef.current = null;
      }
      setCanvas(null);
    };
  }, [setCanvas, setScale]);

  useEffect(() => {
    if (!fabricRef.current) return;
    applyZoom(fabricRef.current, scale);
  }, [scale]);

  useEffect(() => {
    if (!fabricRef.current) return;
    drawGrid(fabricRef.current, gridStep);
  }, [gridStep]);

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

  return <div ref={containerRef} className="relative w-full h-full bg-background"><canvas ref={canvasRef} /></div>;
}

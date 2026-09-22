import { useEffect, useRef, useState } from 'react';
import { Canvas, FabricImage, Group, IText, Line, Point, Polygon, Text } from 'fabric';
import type { TPointerEvent, TPointerEventInfo } from 'fabric';
import { useGardenStore, type ToolId } from '../../store/gardenStore';
import type { GardenObject, GardenObjectType } from '../../types/garden';

const PIXELS_PER_METER = 50;
const GRID_COLOR = '#E5E7EB';
const ZOOM_FACTOR = 1.1;
const MIN_SCALE = 10;
const MAX_SCALE = 500;

type TreeDialogState = {
  visible: boolean;
  x: number;
  y: number;
  name: string;
  variety: string;
  year: number;
  harvest: number;
};

const QUICK_OBJECTS: Record<Exclude<ToolId, 'pointer' | 'polygon' | 'tree' | 'text' | 'eraser'>, { label: string; icon: string; type: GardenObjectType }> = {
  barrel: { label: 'Бочка', icon: '🛢️', type: 'custom' },
  well: { label: 'Колодец', icon: '⛲', type: 'custom' },
  greenhouse: { label: 'Теплица', icon: '🪴', type: 'custom' },
  shed: { label: 'Сарай', icon: '🧰', type: 'custom' },
};

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

  const effectiveStep = Math.max(1, (grid * PIXELS_PER_METER * (scale / 100)) / 1);
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
  width: number,
  height: number,
  customIcon?: string | null,
  attachedTo?: string | null,
): GardenObject {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  return {
    id,
    type,
    name,
    year,
    x,
    y,
    width,
    height,
    parentId: attachedTo ?? null,
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

function attachTextToObject(canvas: Canvas, text: IText, objectId: string): void {
  text.set('attachedTo', objectId);
  text.set('attachOffset', { x: 0, y: -40 });
  canvas.on('object:moving', (event) => {
    const target = event.target;
    if (!target || !('objectId' in target)) return;

    const targetObjectId = target.get('objectId') as string | undefined;
    if (!targetObjectId) return;

    const textObjects = canvas.getObjects().filter((obj) => obj.get('attachedTo') === targetObjectId);
    textObjects.forEach((obj) => {
      const offset = (obj.get('attachOffset') as { x: number; y: number }) ?? { x: 0, y: -40 };
      obj.set({
        left: (target.left ?? 0) + offset.x,
        top: (target.top ?? 0) + offset.y,
      });
    });
  });
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

  const objects = canvas.getObjects();
  const oldGrid = objects.find((o) => {
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

export default function GardenCanvas() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const draftPolygonRef = useRef<Polygon | null>(null);
  const draftPolygonPointsRef = useRef<Point[]>([]);
  const [treeDialog, setTreeDialog] = useState<TreeDialogState | null>(null);

  const setCanvas = useGardenStore((s) => s.setCanvas);
  const setScale = useGardenStore((s) => s.setScale);
  const gridStep = useGardenStore((s) => s.gridStep);
  const scale = useGardenStore((s) => s.scale);
  const activeTool = useGardenStore((s) => s.activeTool);
  const backgroundImage = useGardenStore((s) => s.backgroundImage);
  const backgroundLocked = useGardenStore((s) => s.backgroundLocked);

  const finalizePolygon = (): void => {
    const canvas = fabricRef.current;
    if (!canvas || draftPolygonPointsRef.current.length < 3) return;

    const points = [...draftPolygonPointsRef.current];
    const polygon = new Polygon(points, {
      fill: '#BFE7C1',
      stroke: '#2F7D4D',
      strokeWidth: 2,
      selectable: true,
      evented: true,
      objectCaching: false,
      opacity: 0.9,
    });

    const id = crypto.randomUUID();
    const entry = createGardenObjectEntry('bed', 'Грядка', useGardenStore.getState().currentYear, 0, 0, 0, 0);
    entry.id = id;
    entry.width = 120;
    entry.height = 120;
    polygon.set({
      objectId: id,
      objectType: 'bed',
      name: 'Грядка',
      year: useGardenStore.getState().currentYear,
      hasControls: true,
      hasBorders: true,
      cornerStyle: 'circle',
      borderColor: '#2F7D4D',
      cornerColor: '#2F7D4D',
    });

    canvas.add(polygon);
    canvas.setActiveObject(polygon);
    canvas.renderAll();
    useGardenStore.getState().addObject(entry);

    draftPolygonPointsRef.current = [];
    if (draftPolygonRef.current) {
      canvas.remove(draftPolygonRef.current);
      draftPolygonRef.current = null;
    }
  };

  const createQuickObject = (tool: Exclude<ToolId, 'pointer' | 'polygon' | 'tree' | 'text' | 'eraser'>, x: number, y: number): void => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const config = QUICK_OBJECTS[tool];
    const id = crypto.randomUUID();
    const text = new Text(config.icon, {
      left: x,
      top: y,
      fontSize: 32,
      originX: 'center',
      originY: 'center',
      selectable: true,
      evented: true,
    });

    const object = createGardenObjectEntry(config.type, config.label, useGardenStore.getState().currentYear, x, y, 80, 80, config.icon);
    object.id = id;
    text.set({
      objectId: id,
      objectType: config.type,
      name: config.label,
      year: useGardenStore.getState().currentYear,
      customIcon: config.icon,
      hasControls: true,
      hasBorders: true,
    });

    canvas.add(text);
    canvas.setActiveObject(text);
    canvas.renderAll();
    useGardenStore.getState().addObject(object);
  };

  const createTextObject = (x: number, y: number): void => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const activeObject = canvas.getActiveObject();
    const attachedTo = activeObject && 'objectId' in activeObject ? String(activeObject.get('objectId') ?? '') : null;
    const label = attachedTo ? 'Подпись' : 'Текст';
    const text = new IText(label, {
      left: x,
      top: y,
      fontSize: 18,
      fill: '#1F2937',
      originX: 'center',
      originY: 'center',
      padding: 8,
      borderColor: '#3B82F6',
      cornerColor: '#3B82F6',
      hasControls: true,
      evented: true,
      selectable: true,
    });

    const object = createGardenObjectEntry('custom', label, useGardenStore.getState().currentYear, x, y, 100, 32, 'T');
    object.parentId = attachedTo;
    const textId = object.id;

    text.set({
      objectId: textId,
      objectType: 'custom',
      name: label,
      year: useGardenStore.getState().currentYear,
      attachedTo,
    });

    if (attachedTo) {
      attachTextToObject(canvas, text, attachedTo);
    }

    canvas.add(text);
    canvas.setActiveObject(text);
    canvas.renderAll();
    useGardenStore.getState().addObject(object);
  };

  const createTreeObject = (payload: TreeDialogState): void => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const icon = new Text('🌳', {
      left: payload.x,
      top: payload.y,
      fontSize: 32,
      originX: 'center',
      originY: 'center',
      selectable: true,
      evented: true,
    });

    const id = crypto.randomUUID();
    const entry = createGardenObjectEntry('tree', payload.name, payload.year, payload.x, payload.y, 80, 80, '🌳');
    entry.id = id;
    entry.varieties = [
      {
        id: crypto.randomUUID(),
        name: payload.variety,
        notes: `Сорт добавлен в ${payload.year}`,
      },
    ];
    if (payload.harvest > 0) {
      entry.history[payload.year] = {
        harvest: payload.harvest,
      };
    }

    icon.set({
      objectId: id,
      objectType: 'tree',
      name: payload.name,
      year: payload.year,
      customIcon: '🌳',
      hasControls: true,
      hasBorders: true,
      borderColor: '#2F7D4D',
      cornerColor: '#2F7D4D',
    });

    canvas.add(icon);
    canvas.setActiveObject(icon);
    canvas.renderAll();
    useGardenStore.getState().addObject(entry);
  };

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

    const handleCanvasClick = (event: TPointerEventInfo<TPointerEvent>): void => {
      if (activeTool === 'pointer' || activeTool === 'eraser') return;
      if (activeTool === 'polygon') {
        const pointer = canvas.getScenePoint(event.e);
        const snapped = getSnapPoint(pointer.x, pointer.y);
        const point = new Point(snapped.x, snapped.y);
        draftPolygonPointsRef.current = [...draftPolygonPointsRef.current, point];

        if (draftPolygonRef.current) {
          canvas.remove(draftPolygonRef.current);
        }

        if (draftPolygonPointsRef.current.length >= 3) {
          const preview = new Polygon(draftPolygonPointsRef.current, {
            fill: '#BFE7C1',
            stroke: '#2F7D4D',
            strokeWidth: 2,
            selectable: false,
            evented: false,
            objectCaching: false,
            opacity: 0.8,
          });
          draftPolygonRef.current = preview;
          canvas.add(preview);
          canvas.renderAll();
        }
        return;
      }

      if (activeTool === 'tree') {
        const pointer = canvas.getScenePoint(event.e);
        const snapped = getSnapPoint(pointer.x, pointer.y);
        setTreeDialog({
          visible: true,
          x: snapped.x,
          y: snapped.y,
          name: 'Яблоня',
          variety: 'Гала',
          year: useGardenStore.getState().currentYear,
          harvest: 0,
        });
        return;
      }

      if (activeTool === 'text') {
        const pointer = canvas.getScenePoint(event.e);
        const snapped = getSnapPoint(pointer.x, pointer.y);
        createTextObject(snapped.x, snapped.y);
        return;
      }

      if (activeTool === 'barrel' || activeTool === 'well' || activeTool === 'greenhouse' || activeTool === 'shed') {
        const pointer = canvas.getScenePoint(event.e);
        const snapped = getSnapPoint(pointer.x, pointer.y);
        createQuickObject(activeTool, snapped.x, snapped.y);
      }
    };

    const handleDoubleClick = (): void => {
      if (activeTool === 'polygon') {
        finalizePolygon();
      }
    };

    canvas.on('mouse:wheel', onWheel);
    canvas.on('mouse:down', handleCanvasClick);
    canvas.on('mouse:dblclick', handleDoubleClick);

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
      resizeObserver.disconnect();
      if (fabricRef.current) {
        fabricRef.current.dispose();
        fabricRef.current = null;
      }
      setCanvas(null);
    };
  }, [activeTool, setCanvas, setScale]);

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

  return (
    <div ref={containerRef} className="relative w-full h-full bg-background">
      <canvas ref={canvasRef} />

      {treeDialog?.visible && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-neutral-900/20 p-4">
          <div className="w-full max-w-sm rounded-xl border border-border bg-white p-4 shadow-panel">
            <h3 className="mb-3 text-lg font-semibold text-text-primary">Добавить дерево</h3>
            <div className="space-y-3">
              <label className="block text-sm text-text-secondary">
                Название
                <input
                  className="mt-1 w-full rounded-md border border-border px-2 py-2 text-sm"
                  value={treeDialog.name}
                  onChange={(event) =>
                    setTreeDialog((current) => (current ? { ...current, name: event.target.value } : current))
                  }
                />
              </label>

              <label className="block text-sm text-text-secondary">
                Сорт
                <input
                  className="mt-1 w-full rounded-md border border-border px-2 py-2 text-sm"
                  value={treeDialog.variety}
                  onChange={(event) =>
                    setTreeDialog((current) => (current ? { ...current, variety: event.target.value } : current))
                  }
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm text-text-secondary">
                  Год
                  <input
                    type="number"
                    className="mt-1 w-full rounded-md border border-border px-2 py-2 text-sm"
                    value={treeDialog.year}
                    onChange={(event) =>
                      setTreeDialog((current) =>
                        current ? { ...current, year: Number(event.target.value || 0) } : current,
                      )
                    }
                  />
                </label>

                <label className="block text-sm text-text-secondary">
                  Урожай, кг
                  <input
                    type="number"
                    className="mt-1 w-full rounded-md border border-border px-2 py-2 text-sm"
                    value={treeDialog.harvest}
                    onChange={(event) =>
                      setTreeDialog((current) =>
                        current ? { ...current, harvest: Number(event.target.value || 0) } : current,
                      )
                    }
                  />
                </label>
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setTreeDialog(null)}
                className="rounded-md border border-border px-3 py-2 text-sm text-text-secondary"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => {
                  createTreeObject(treeDialog);
                  setTreeDialog(null);
                }}
                className="rounded-md bg-primary px-3 py-2 text-sm text-white"
              >
                Добавить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

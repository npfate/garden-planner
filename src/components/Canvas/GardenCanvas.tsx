import { useEffect, useRef } from 'react';
import { Canvas, FabricImage, Line, Group, Point } from 'fabric';
import type { TPointerEvent, TPointerEventInfo } from 'fabric';
import { useGardenStore } from '../../store/gardenStore';

const PIXELS_PER_METER = 50;
const GRID_COLOR = '#E5E7EB';
const ZOOM_FACTOR = 1.1;
const MIN_SCALE = 10;
const MAX_SCALE = 500;

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
  const setCanvas = useGardenStore((s) => s.setCanvas);
  const setScale = useGardenStore((s) => s.setScale);
  const gridStep = useGardenStore((s) => s.gridStep);
  const scale = useGardenStore((s) => s.scale);
  const backgroundImage = useGardenStore((s) => s.backgroundImage);
  const backgroundLocked = useGardenStore((s) => s.backgroundLocked);

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

    canvas.on('mouse:wheel', onWheel);

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

  return (
    <div ref={containerRef} className="relative w-full h-full bg-background">
      <canvas ref={canvasRef} />
    </div>
  );
}

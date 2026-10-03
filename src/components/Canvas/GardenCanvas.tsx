import { Canvas, Point, Rect } from 'fabric';
import type { TPointerEvent, TPointerEventInfo, FabricObject } from 'fabric';
import { useEffect, useRef } from 'react';
import { useGardenStore, useCanvasStore } from '../../store/gardenStore';
import { isVisibleAt } from '../../utils/wayback';
import type { ToolId } from '../../store/gardenStore';
import type { GardenObject, GardenObjectType, IsoDate } from '../../types/garden';
import { MARKER_SIZE, todayIso } from '../../utils/markers';
import { makeEvent } from '../../utils/wayback';
import {
  createFabricObjectFromEntry,
  drawGrid,
  drawTransplantHints,
  findObjectByGardenId,
  isTransplantLine,
  markAsCreatedOnCanvas,
  reconcileObjectsWithStore,
  getGardenId,
  getSnapPoint,
  isBackgroundObject,
  loadBackgroundImage,
  setBackgroundSelectable,
  syncFabricObjectToStore,
} from './fabricSync';

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
    history: { [year]: { harvest: 0 } },
    customIcon: customIcon ?? null,
    lifecycle: 'perennial',
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
  if (tool === 'bed' || tool === 'tree') {
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

    const onObjectModified = (): void => {
      const activeObj = canvas.getActiveObject();
      if (!activeObj) return;
      const id = getGardenId(activeObj);
      const before = id ? useGardenStore.getState().objects.find((o) => o.id === id) : undefined;
      syncFabricObjectToStore(activeObj);
      // Событие «перемещение» в журнал (wayback machine) — только если реально сдвинули
      if (before && (Math.abs(before.x - (activeObj.left ?? 0)) > 1 || Math.abs(before.y - (activeObj.top ?? 0)) > 1)) {
        useGardenStore.getState().addEvent(
          makeEvent('moved', before, `Перемещено: ${before.name} → (${Math.round(activeObj.left ?? 0)}; ${Math.round(activeObj.top ?? 0)})`),
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
      const entry = createGardenObjectEntry(
        'bed',
        `Грядка ${bedsCount}`,
        gs.currentYear,
        left,
        top,
        width,
        height,
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

      useCanvasStore.getState().setActiveTool('select');
      bedDraftRef.current = null;
    };

    const placeTreeMarker = (pointer: Point, plantDate?: string | null): void => {
      const snapped = getSnapPoint(pointer.x, pointer.y);
      const gs = useGardenStore.getState();
      const entry = createGardenObjectEntry(
        'tree',
        'Яблоня',
        gs.currentYear,
        snapped.x,
        snapped.y,
        MARKER_SIZE,
        MARKER_SIZE,
        '🍎',
        plantDate ?? undefined,
      );
      gs.addObject(entry);

      const marker = createFabricObjectFromEntry(entry);
      markAsCreatedOnCanvas(marker);
      canvas.add(marker);
      canvas.setActiveObject(marker);
      selectByObject(marker);
      canvas.renderAll();
      useCanvasStore.getState().setActiveTool('select');
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
        placeTreeMarker(canvas.getScenePoint(event.e), useGardenStore.getState().viewDate);
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
      if (activeToolRef.current === 'bed' && bedDraftRef.current) {
        if (bedDraftRef.current.preview) canvas.remove(bedDraftRef.current.preview);
        bedDraftRef.current = null;
        canvas.renderAll();
      } else if (activeToolRef.current === 'tree') {
        useCanvasStore.getState().setActiveTool('select');
      }
    };

    const deleteSelected = (): void => {
      const activeObj = canvas.getActiveObject();
      if (!activeObj) return;
      const id = getGardenId(activeObj);
      if (!id) return;
      // Клавиша Delete — «выкопка» (soft-delete): объект остаётся в истории.
      useGardenStore.getState().removeObject(id);
      canvas.remove(activeObj);
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

    if (activeTool === 'bed' || activeTool === 'tree' || activeTool === 'pan') {
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
    const now = s.viewDate ?? `${s.currentYear}-12-31`;
    return s.objects
      .filter((o) => {
        if (!isVisibleAt(o, s.currentYear, s.viewDate)) return false;
        if (o.transplantedToId) {
          const next = byId.get(o.transplantedToId);
          // следующее место цепочки живо — старое не показываем
          if (next && (!next.removedAt || next.removedAt >= now)) return false;
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

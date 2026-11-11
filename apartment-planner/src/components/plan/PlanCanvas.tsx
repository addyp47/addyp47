import { useCallback, useEffect, useRef, useState } from 'react';
import { screenToWorld, useEditor } from '../../store/editor';
import type { Vec2 } from '../../model/types';
import { Grid } from './Grid';
import { BackgroundLayer, DimensionLine, RoomLabels, RoomsLayer, VertexHandles, WallDimensions, WallsLayer, SELECT_COLOR, WALL_FILL } from './layers';
import { projectVertices, snapPoint, type Guide } from '../../geometry/snapping';
import { addRoom, addWalls, findVerticesAt, moveVertices, type VertexRef } from '../../model/operations';
import { dist } from '../../geometry/vec';
import { formatFtIn } from '../../geometry/units';
import { setPlanSvg } from './svgRef';
import { WarningsLayer } from './WarningsLayer';
import { getWarnings } from '../../analysis/warnings';
import { OpeningShape, OpeningsLayer } from './OpeningShape';
import { clampOpeningT, nearestWall, wallLength } from '../../geometry/plan';
import { createOpening } from '../../model/defaults';
import type { FurnitureItem, Opening, OpeningKind } from '../../model/types';
import { FurnitureDimensions, FurnitureHandles, FurnitureShape } from './FurnitureShape';
import { toLocal, toWorld } from '../../geometry/plan';
import { CATALOG_BY_ID, createFurniture } from '../../catalog/furniture';
import { normalizeDeg, snap } from '../../geometry/vec';

type DragState =
  | { type: 'pan'; startX: number; startY: number; viewX: number; viewY: number; moved: boolean }
  | { type: 'vertex'; refs: VertexRef[]; anchor: Vec2 | null; start: Vec2 }
  | { type: 'background'; start: Vec2; bgStart: Vec2 }
  | { type: 'opening'; id: string; grab: number }
  | { type: 'move'; id: string; offset: Vec2 }
  | { type: 'rotate'; id: string }
  | { type: 'resize'; id: string; hx: number; hy: number; start: FurnitureItem }
  | null;

export const FURNITURE_DND_TYPE = 'application/x-apartment-furniture';
const MIN_SIZE = 4;

const HINTS: Record<string, string> = {
  select: 'Click to select · drag empty space to pan · scroll to zoom · Del to delete',
  room: 'Click corners to trace a room · click the first point to close · Shift = free angle · Backspace undo point · Esc cancel',
  wall: 'Click to place wall points · double-click or Enter to finish · Shift = free angle · Esc cancel',
  calibrate: 'Click both ends of a wall whose real length you know',
  door: 'Click a wall to add a door · the side you hover is the swing side',
  window: 'Click a wall to add a window',
  outlet: 'Click a wall to add an outlet on that side',
};

const isOpeningTool = (t: string): t is OpeningKind => t === 'door' || t === 'window' || t === 'outlet';

export function PlanCanvas() {
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const drag = useRef<DragState>(null);
  const [cursor, setCursor] = useState<Vec2 | null>(null);
  const [trace, setTrace] = useState<Vec2[]>([]);
  const [snapState, setSnapState] = useState<{ point: Vec2; guides: Guide[]; vertex: boolean } | null>(null);
  const [shiftDown, setShiftDown] = useState(false);
  const [openingPreview, setOpeningPreview] = useState<Opening | null>(null);

  const project = useEditor((s) => s.project);
  const view = useEditor((s) => s.view);
  const viewport = useEditor((s) => s.viewport);
  const tool = useEditor((s) => s.tool);
  const selection = useEditor((s) => s.selection);
  const hoverId = useEditor((s) => s.hoverId);
  const traceCreatesWalls = useEditor((s) => s.traceCreatesWalls);
  const showWarnings = useEditor((s) => s.showWarnings);
  const warnings = getWarnings(project);
  const flagged = new Set(warnings.filter((w) => w.kind === 'wall' || w.kind === 'door' || w.kind === 'overlap').flatMap((w) => w.furnitureIds));
  const { setView, setViewport, mutate, checkpoint, select, setHover, setCalibration, setTool } = useEditor.getState();

  const px = 1 / view.scale; // one screen pixel in world inches
  const tracing = tool === 'room' || tool === 'wall' || tool === 'calibrate';

  useEffect(() => setPlanSvg(svgRef.current), []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setViewport(entry.contentRect.width, entry.contentRect.height));
    ro.observe(el);
    return () => ro.disconnect();
  }, [setViewport]);

  // Reset in-progress trace when switching tools.
  useEffect(() => {
    setTrace([]);
    setSnapState(null);
    setOpeningPreview(null);
  }, [tool]);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const v = useEditor.getState().view;
      if (e.ctrlKey || !e.shiftKey) {
        const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
        const s = Math.min(20, Math.max(0.1, v.scale * factor));
        const wx = (sx - v.x) / v.scale;
        const wy = (sy - v.y) / v.scale;
        setView({ scale: s, x: sx - wx * s, y: sy - wy * s });
      } else {
        setView({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY });
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [setView]);

  const finishTrace = useCallback(
    (points: Vec2[], close: boolean) => {
      if (tool === 'room') {
        if (points.length < 3) return;
        let id = '';
        mutate((d) => {
          id = addRoom(d, points, traceCreatesWalls);
        });
        useEditor.setState({ selection: { kind: 'room', id } });
      } else if (tool === 'wall') {
        if (points.length < 2) return;
        mutate((d) => {
          addWalls(d, points, close);
        });
      }
      setTrace([]);
    },
    [tool, mutate, traceCreatesWalls],
  );

  // Trace-specific keys.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setShiftDown(e.type === 'keydown');
      if (e.type !== 'keydown' || !tracing) return;
      if ((e.target as HTMLElement)?.closest?.('input, textarea, select')) return;
      if (e.key === 'Escape') {
        if (trace.length) setTrace([]);
        else setTool('select');
        e.stopPropagation();
      } else if (e.key === 'Enter') {
        finishTrace(trace, false);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        setTrace((t) => t.slice(0, -1));
      }
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('keyup', onKey, true);
    };
  }, [tracing, trace, finishTrace, setTool]);

  const localPoint = (e: React.PointerEvent) => {
    const rect = svgRef.current!.getBoundingClientRect();
    return { sx: e.clientX - rect.left, sy: e.clientY - rect.top };
  };

  const snapTrace = (raw: Vec2, free: boolean) =>
    snapPoint(raw, {
      anchor: trace.length ? trace[trace.length - 1] : null,
      candidates: [...projectVertices(project), ...trace],
      threshold: 10 * px,
      free,
    });

  const openingPreviewAt = (world: Vec2): Opening | null => {
    if (!isOpeningTool(tool)) return null;
    const hit = nearestWall(project.walls, world, 24 * px);
    if (!hit) return null;
    const o = createOpening(tool, hit.wall.id, 0, hit.side);
    const L = wallLength(hit.wall);
    o.t = clampOpeningT(Math.round(hit.t * L) / L, o.width, hit.wall);
    return o;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const { sx, sy } = localPoint(e);
    const world = screenToWorld(view, sx, sy);
    const target = (e.target as Element).closest('[data-kind]') as HTMLElement | SVGElement | null;
    const kind = target?.getAttribute('data-kind');
    const id = target?.getAttribute('data-id') ?? '';
    const capture = () => svgRef.current?.setPointerCapture(e.pointerId);

    const startPan = () => {
      drag.current = { type: 'pan', startX: sx, startY: sy, viewX: view.x, viewY: view.y, moved: false };
      capture();
    };

    if (e.button === 1 || (e.button === 0 && e.altKey)) return startPan();
    if (e.button !== 0) return;

    if (tracing) {
      const s = snapTrace(world, e.shiftKey);
      const p = s.point;
      if (tool === 'calibrate') {
        if (trace.length === 0) setTrace([p]);
        else {
          if (dist(trace[0], p) > 1) setCalibration({ a: trace[0], b: p });
          setTrace([]);
        }
        return;
      }
      // Close room by clicking the first point.
      if (tool === 'room' && trace.length >= 3 && dist(p, trace[0]) < 10 * px) return finishTrace(trace, true);
      // Clicking the last point again (double-click) finishes.
      if (trace.length >= 1 && dist(p, trace[trace.length - 1]) < 0.5) {
        return finishTrace(trace, tool === 'wall' && trace.length > 2 && dist(trace[0], trace[trace.length - 1]) < 0.5);
      }
      setTrace([...trace, p]);
      return;
    }

    if (isOpeningTool(tool)) {
      const prev = openingPreviewAt(world);
      if (prev) {
        mutate((d) => void d.openings.push(prev));
        useEditor.setState({ selection: { kind: 'opening', id: prev.id } });
      }
      return;
    }

    // Select tool
    switch (kind) {
      case 'furniture': {
        const f = project.furniture.find((x) => x.id === id);
        if (!f) return;
        select({ kind, id });
        checkpoint();
        drag.current = { type: 'move', id, offset: { x: world.x - f.x, y: world.y - f.y } };
        capture();
        return;
      }
      case 'handle': {
        const f = selection?.kind === 'furniture' && project.furniture.find((x) => x.id === selection.id);
        if (!f) return;
        checkpoint();
        if (target!.getAttribute('data-handle') === 'rotate') drag.current = { type: 'rotate', id: f.id };
        else
          drag.current = {
            type: 'resize',
            id: f.id,
            hx: Number(target!.getAttribute('data-hx')),
            hy: Number(target!.getAttribute('data-hy')),
            start: { ...f },
          };
        capture();
        return;
      }
      case 'opening': {
        const o = project.openings.find((x) => x.id === id);
        const w = o && project.walls.find((x) => x.id === o.wallId);
        select({ kind, id });
        if (o && w) {
          const hit = nearestWall([w], world, Infinity);
          checkpoint();
          drag.current = { type: 'opening', id, grab: (hit?.t ?? o.t) - o.t };
          capture();
        }
        return;
      }
      case 'vertex': {
        const at = { x: Number(target!.getAttribute('data-x')), y: Number(target!.getAttribute('data-y')) };
        const refs = findVerticesAt(project, at);
        let anchor: Vec2 | null = null;
        if (selection?.kind === 'wall') {
          const w = project.walls.find((x) => x.id === selection.id);
          if (w) anchor = dist(w.a, at) < 0.75 ? w.b : w.a;
        }
        checkpoint();
        drag.current = { type: 'vertex', refs, anchor, start: at };
        capture();
        return;
      }
      case 'wall':
      case 'room':
        select({ kind, id });
        return startPan();
      case 'background':
        if (project.background && !project.background.locked) {
          checkpoint();
          drag.current = { type: 'background', start: world, bgStart: { x: project.background.x, y: project.background.y } };
          capture();
          return;
        }
        select(null);
        return startPan();
      default:
        select(null);
        return startPan();
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const { sx, sy } = localPoint(e);
    const world = screenToWorld(view, sx, sy);
    setCursor(world);
    const d = drag.current;

    if (d?.type === 'pan') {
      d.moved = d.moved || Math.abs(sx - d.startX) + Math.abs(sy - d.startY) > 3;
      setView({ ...view, x: d.viewX + sx - d.startX, y: d.viewY + sy - d.startY });
      return;
    }
    if (d?.type === 'vertex') {
      const movingRefs = new Set(d.refs.map((r) => `${r.kind}:${r.id}:${r.index}`));
      const candidates: Vec2[] = [];
      for (const w of project.walls) {
        if (!movingRefs.has(`wall-a:${w.id}:0`)) candidates.push(w.a);
        if (!movingRefs.has(`wall-b:${w.id}:0`)) candidates.push(w.b);
      }
      for (const r of project.rooms) r.polygon.forEach((v, i) => !movingRefs.has(`room:${r.id}:${i}`) && candidates.push(v));
      const s = snapPoint(world, { anchor: d.anchor, candidates, threshold: 10 * px, free: e.shiftKey });
      setSnapState({ point: s.point, guides: s.guides, vertex: !!s.vertex });
      mutate((draft) => moveVertices(draft, d.refs, s.point), { record: false });
      return;
    }
    if (d?.type === 'background') {
      mutate(
        (draft) => {
          if (!draft.background) return;
          draft.background.x = d.bgStart.x + world.x - d.start.x;
          draft.background.y = d.bgStart.y + world.y - d.start.y;
        },
        { record: false },
      );
      return;
    }

    if (d?.type === 'move' || d?.type === 'rotate' || d?.type === 'resize') {
      mutate(
        (draft) => {
          const f = draft.furniture.find((x) => x.id === d.id);
          if (!f) return;
          if (d.type === 'move') {
            f.x = snap(world.x - d.offset.x, 0.5);
            f.y = snap(world.y - d.offset.y, 0.5);
          } else if (d.type === 'rotate') {
            const deg = (Math.atan2(world.y - f.y, world.x - f.x) * 180) / Math.PI + 90;
            f.rotation = normalizeDeg(e.shiftKey ? Math.round(deg) : snap(deg, 15));
          } else {
            Object.assign(f, resizeFurniture(d.start, d.hx, d.hy, world, e.shiftKey));
          }
        },
        { record: false },
      );
      return;
    }

    if (d?.type === 'opening') {
      mutate(
        (draft) => {
          const o = draft.openings.find((x) => x.id === d.id);
          const w = o && draft.walls.find((x) => x.id === o.wallId);
          if (!o || !w) return;
          const hit = nearestWall([w], world, Infinity);
          if (!hit) return;
          // snap to whole inches along the wall
          const L = wallLength(w);
          const t = Math.round((hit.t - d.grab) * L) / L;
          o.t = clampOpeningT(t, o.width, w);
        },
        { record: false },
      );
      return;
    }

    if (tracing) {
      const s = snapTrace(world, e.shiftKey);
      setSnapState({ point: s.point, guides: s.guides, vertex: !!s.vertex });
      return;
    }

    if (isOpeningTool(tool)) {
      setOpeningPreview(openingPreviewAt(world));
      return;
    }

    // Hover highlight (select tool, no drag)
    const target = (e.target as Element).closest('[data-kind]');
    const hk = target?.getAttribute('data-kind');
    const hid = hk === 'wall' || hk === 'furniture' || hk === 'opening' ? target!.getAttribute('data-id') : null;
    if (hid !== hoverId) setHover(hid);
  };

  const onDrop = (e: React.DragEvent) => {
    const catalogId = e.dataTransfer.getData(FURNITURE_DND_TYPE);
    const c = CATALOG_BY_ID.get(catalogId);
    if (!c) return;
    e.preventDefault();
    const rect = svgRef.current!.getBoundingClientRect();
    const world = screenToWorld(view, e.clientX - rect.left, e.clientY - rect.top);
    const f = createFurniture(c, world);
    mutate((d) => void d.furniture.push(f));
    setTool('select');
    select({ kind: 'furniture', id: f.id });
  };

  const onPointerUp = () => {
    const d = drag.current;
    if (d?.type === 'vertex') setSnapState(null);
    drag.current = null;
  };

  // Overlay for trace tools
  const preview = snapState?.point ?? null;
  const tracePts = preview && tracing ? [...trace, preview] : trace;
  const lastSeg = tracing && trace.length && preview ? { a: trace[trace.length - 1], b: preview } : null;

  const selectedWall = selection?.kind === 'wall' ? project.walls.find((w) => w.id === selection.id) : undefined;
  const selectedRoom = selection?.kind === 'room' ? project.rooms.find((r) => r.id === selection.id) : undefined;

  const selectMode = tool === 'select';
  const rugs = project.furniture.filter((f) => f.kind === 'rug');
  const pieces = project.furniture.filter((f) => f.kind !== 'rug');
  const selectedFurniture = selection?.kind === 'furniture' ? project.furniture.find((f) => f.id === selection.id) : undefined;
  const hoveredFurniture = hoverId ? project.furniture.find((f) => f.id === hoverId) : undefined;
  const furnitureState = (id: string) => (selection?.id === id ? 'selected' : hoverId === id ? 'hover' : 'idle');

  const cursorStyle = tracing || isOpeningTool(tool) ? 'crosshair' : drag.current?.type === 'pan' ? 'grabbing' : 'default';

  return (
    <div className="plan-wrap" ref={wrapRef}>
      <svg
        ref={svgRef}
        className="plan-svg"
        width={viewport.width}
        height={viewport.height}
        style={{ cursor: cursorStyle }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => {
          setCursor(null);
          if (!drag.current) setHover(null);
        }}
        onContextMenu={(e) => e.preventDefault()}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes(FURNITURE_DND_TYPE)) e.preventDefault();
        }}
        onDrop={onDrop}
      >
        <g id="plan-content" transform={`translate(${view.x} ${view.y}) scale(${view.scale})`}>
          <Grid view={view} width={viewport.width} height={viewport.height} />
          <BackgroundLayer bg={project.background} />
          <RoomsLayer project={project} selection={selection} px={px} interactive={!tracing} />
          {rugs.map((f) => (
            <FurnitureShape key={f.id} f={f} palette={project.style.palette} px={px} state={furnitureState(f.id)} interactive={selectMode} flagged={false} />
          ))}
          <WallsLayer
            walls={project.walls}
            color={WALL_FILL}
            selection={selection}
            hoverId={hoverId}
            px={px}
            interactive={!tracing}
          />
          <OpeningsLayer
            openings={project.openings}
            walls={project.walls}
            px={px}
            selectedId={selection?.kind === 'opening' ? selection.id : null}
            hoverId={hoverId}
            interactive={!tracing && !isOpeningTool(tool)}
          />
          <RoomLabels rooms={project.rooms} px={px} />
          {pieces.map((f) => (
            <FurnitureShape key={f.id} f={f} palette={project.style.palette} px={px} state={furnitureState(f.id)} interactive={selectMode} flagged={showWarnings && flagged.has(f.id)} />
          ))}
          {openingPreview && (
            <g className="no-export" pointerEvents="none">
              <OpeningShape opening={openingPreview} wall={project.walls.find((w) => w.id === openingPreview.wallId)!} px={px} ghost selected />
            </g>
          )}

          {showWarnings && <WarningsLayer warnings={warnings} project={project} px={px} />}

          {/* Selection affordances */}
          {selectedWall && !tracing && (
            <>
              <WallDimensions wall={selectedWall} px={px} />
              <VertexHandles points={[selectedWall.a, selectedWall.b]} px={px} />
            </>
          )}
          {selectedRoom && !tracing && <VertexHandles points={selectedRoom.polygon} px={px} />}
          {selectedFurniture && <FurnitureDimensions f={selectedFurniture} px={px} />}
          {hoveredFurniture && hoveredFurniture !== selectedFurniture && <FurnitureDimensions f={hoveredFurniture} px={px} />}
          {selectedFurniture && selectMode && <FurnitureHandles f={selectedFurniture} px={px} />}

          {/* Snap guides */}
          {snapState && (
            <g className="no-export" pointerEvents="none">
              {snapState.guides.map((g, i) => (
                <line
                  key={i}
                  x1={g.from.x}
                  y1={g.from.y}
                  x2={g.to.x}
                  y2={g.to.y}
                  stroke="#e0567a"
                  strokeWidth={px}
                  strokeDasharray={`${4 * px} ${3 * px}`}
                />
              ))}
            </g>
          )}

          {/* Trace overlay */}
          {tracing && (
            <g className="no-export" pointerEvents="none">
              {tracePts.length > 1 && (
                <polyline
                  points={tracePts.map((p) => `${p.x},${p.y}`).join(' ')}
                  fill={tool === 'room' ? 'rgba(47,125,225,0.08)' : 'none'}
                  stroke={tool === 'calibrate' ? '#e0567a' : SELECT_COLOR}
                  strokeWidth={2 * px}
                  strokeDasharray={tool === 'calibrate' ? `${6 * px} ${4 * px}` : undefined}
                />
              )}
              {trace.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={(i === 0 && tool === 'room' ? 6 : 4) * px} fill="white" stroke={SELECT_COLOR} strokeWidth={2 * px} />
              ))}
              {preview && (
                <circle cx={preview.x} cy={preview.y} r={(snapState?.vertex ? 6 : 3) * px} fill={snapState?.vertex ? '#e0567a' : SELECT_COLOR} />
              )}
              {lastSeg && dist(lastSeg.a, lastSeg.b) > 1 && <DimensionLine a={lastSeg.a} b={lastSeg.b} offset={-16 * px} px={px} />}
            </g>
          )}
        </g>
      </svg>
      <div className="statusbar">
        <span className="hint">
          {HINTS[tool] ?? ''}
          {tool === 'room' && shiftDown ? ' (free angle)' : ''}
        </span>
        {cursor && (
          <span>
            {formatFtIn(cursor.x)}, {formatFtIn(cursor.y)}
          </span>
        )}
        {hoveredFurniture && !drag.current && (
          <span>
            <b>{hoveredFurniture.name}</b> {formatFtIn(hoveredFurniture.width, true)} W × {formatFtIn(hoveredFurniture.depth, true)} D ×{' '}
            {formatFtIn(hoveredFurniture.height, true)} H
          </span>
        )}
        <span>{(view.scale * 12).toFixed(1)} px/ft</span>
      </div>
    </div>
  );
}

/**
 * Resize from a handle: the opposite edge/corner stays fixed. Works in the
 * piece's local frame so rotated items resize along their own axes.
 */
function resizeFurniture(start: FurnitureItem, hx: number, hy: number, world: Vec2, keepAspect: boolean): Partial<FurnitureItem> {
  const local = toLocal(start, world);
  let w = start.width;
  let d = start.depth;
  let cx = 0;
  let cy = 0;
  if (hx !== 0) {
    const anchor = (-hx * start.width) / 2;
    w = Math.max(MIN_SIZE, snap(Math.abs(local.x - anchor), 0.5));
    cx = anchor + (hx * w) / 2;
  }
  if (hy !== 0) {
    const anchor = (-hy * start.depth) / 2;
    d = Math.max(MIN_SIZE, snap(Math.abs(local.y - anchor), 0.5));
    cy = anchor + (hy * d) / 2;
  }
  if (keepAspect && hx !== 0 && hy !== 0) {
    const k = Math.max(w / start.width, d / start.depth);
    w = snap(start.width * k, 0.5);
    d = snap(start.depth * k, 0.5);
    cx = (-hx * start.width) / 2 + (hx * w) / 2;
    cy = (-hy * start.depth) / 2 + (hy * d) / 2;
  }
  const c = toWorld(start, { x: cx, y: cy });
  return { width: w, depth: d, x: c.x, y: c.y };
}


import type { Project, Selection, Vec2 } from './types';
import { createWall, newId } from './defaults';
import { dist } from '../geometry/vec';

const EPS = 0.75;

function sameSegment(a1: Vec2, b1: Vec2, a2: Vec2, b2: Vec2) {
  return (dist(a1, a2) < EPS && dist(b1, b2) < EPS) || (dist(a1, b2) < EPS && dist(b1, a2) < EPS);
}

/** Add walls along a polyline (closed when `closed`), skipping segments that already exist. Returns new wall ids. */
export function addWalls(p: Project, points: Vec2[], closed: boolean): string[] {
  const ids: string[] = [];
  const n = points.length;
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    if (dist(a, b) < 1) continue;
    if (p.walls.some((w) => sameSegment(w.a, w.b, a, b))) continue;
    const w = createWall(a, b, p.ceilingHeight);
    p.walls.push(w);
    ids.push(w.id);
  }
  return ids;
}

export function addRoom(p: Project, polygon: Vec2[], withWalls: boolean): string {
  const id = newId('room');
  const n = p.rooms.length + 1;
  p.rooms.push({ id, name: `Room ${n}`, type: n === 1 ? 'living' : 'other', polygon: polygon.map((q) => ({ ...q })) });
  if (withWalls) addWalls(p, polygon, true);
  return id;
}

/**
 * Calibration: scale all world geometry about the origin. Furniture keeps its
 * real-world size; only positions move. Opening widths are real-world too.
 */
export function scaleProject(p: Project, factor: number) {
  const s = (v: Vec2) => {
    v.x *= factor;
    v.y *= factor;
  };
  if (p.background) {
    p.background.x *= factor;
    p.background.y *= factor;
    p.background.inchesPerPixel *= factor;
  }
  for (const w of p.walls) {
    s(w.a);
    s(w.b);
  }
  for (const r of p.rooms) r.polygon.forEach(s);
  for (const f of p.furniture) {
    f.x *= factor;
    f.y *= factor;
  }
}

/** All wall endpoints and room vertices sitting at `at`. */
export interface VertexRef {
  kind: 'wall-a' | 'wall-b' | 'room';
  id: string;
  index: number;
}

export function findVerticesAt(p: Project, at: Vec2, eps = EPS): VertexRef[] {
  const refs: VertexRef[] = [];
  for (const w of p.walls) {
    if (dist(w.a, at) < eps) refs.push({ kind: 'wall-a', id: w.id, index: 0 });
    if (dist(w.b, at) < eps) refs.push({ kind: 'wall-b', id: w.id, index: 0 });
  }
  for (const r of p.rooms) {
    r.polygon.forEach((v, i) => {
      if (dist(v, at) < eps) refs.push({ kind: 'room', id: r.id, index: i });
    });
  }
  return refs;
}

export function moveVertices(p: Project, refs: VertexRef[], to: Vec2) {
  for (const ref of refs) {
    if (ref.kind === 'room') {
      const r = p.rooms.find((x) => x.id === ref.id);
      if (r) r.polygon[ref.index] = { ...to };
    } else {
      const w = p.walls.find((x) => x.id === ref.id);
      if (w) w[ref.kind === 'wall-a' ? 'a' : 'b'] = { ...to };
    }
  }
}

export function deleteSelection(p: Project, sel: Selection) {
  switch (sel.kind) {
    case 'furniture':
      p.furniture = p.furniture.filter((f) => f.id !== sel.id);
      break;
    case 'wall':
      p.walls = p.walls.filter((w) => w.id !== sel.id);
      p.openings = p.openings.filter((o) => o.wallId !== sel.id);
      break;
    case 'opening':
      p.openings = p.openings.filter((o) => o.id !== sel.id);
      break;
    case 'room':
      p.rooms = p.rooms.filter((r) => r.id !== sel.id);
      break;
  }
}

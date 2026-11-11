import type { FurnitureItem, FurnitureKind, Opening, Project, Room, RoomType, Vec2, Wall } from '../../model/types';
import { createEmptyProject, newId } from '../../model/defaults';
import { closestPointOnSegment, pointInPolygon, polygonArea, projectT } from '../../geometry/polygon';
import { dist, normalizeDeg, rotate } from '../../geometry/vec';

/**
 * Format-neutral description of a room scan: every element is a measured box.
 * Units are meters, y is up, and `axis` is the direction of the box's width on
 * the floor plane (x, z). Both the CapturedRoom JSON and USDZ readers produce this.
 */
export interface ScanBox {
  category: string;
  id?: string;
  parentId?: string;
  center: { x: number; y: number; z: number };
  axis: { x: number; z: number };
  width: number;
  height: number;
  depth: number;
}

export interface ScanData {
  walls: ScanBox[];
  doors: ScanBox[];
  windows: ScanBox[];
  openings: ScanBox[];
  objects: ScanBox[];
}

const M = 39.3701; // inches per meter
/** Scanned walls are surfaces with no thickness. Keeping them thin keeps room dimensions true to the scan. */
export const SCAN_WALL_THICKNESS = 1;
const CORNER_SNAP = 5; // inches: join wall ends that nearly meet

const OBJECT_MAP: Record<string, { kind: FurnitureKind; name: string }> = {
  storage: { kind: 'storage', name: 'Storage' },
  refrigerator: { kind: 'appliance', name: 'Refrigerator' },
  stove: { kind: 'appliance', name: 'Stove' },
  oven: { kind: 'appliance', name: 'Oven' },
  dishwasher: { kind: 'appliance', name: 'Dishwasher' },
  washerdryer: { kind: 'appliance', name: 'Washer / dryer' },
  sink: { kind: 'appliance', name: 'Sink' },
  toilet: { kind: 'appliance', name: 'Toilet' },
  bathtub: { kind: 'appliance', name: 'Bathtub' },
  bed: { kind: 'bed', name: 'Bed' },
  table: { kind: 'table', name: 'Table' },
  sofa: { kind: 'sofa', name: 'Sofa' },
  chair: { kind: 'chair', name: 'Chair' },
  fireplace: { kind: 'generic', name: 'Fireplace' },
  television: { kind: 'generic', name: 'Television' },
  stairs: { kind: 'generic', name: 'Stairs' },
};

/** Things fixed to the building: flagged so they aren't mistaken for movable furniture. */
const FIXED = new Set(['refrigerator', 'stove', 'oven', 'dishwasher', 'washerdryer', 'sink', 'toilet', 'bathtub', 'fireplace', 'stairs']);

export interface ScanSummary {
  walls: number;
  doors: number;
  windows: number;
  objects: number;
  rooms: number;
}

export function summarizeScan(p: Project): ScanSummary {
  return {
    walls: p.walls.length,
    doors: p.openings.filter((o) => o.kind === 'door' || o.kind === 'opening').length,
    windows: p.openings.filter((o) => o.kind === 'window').length,
    objects: p.furniture.length,
    rooms: p.rooms.length,
  };
}

export function scanToProject(scan: ScanData, name: string): Project {
  if (scan.walls.length === 0) throw new Error('No walls found in that scan.');
  const project = createEmptyProject(name);
  project.source = { kind: 'roomplan' };

  const floorY = Math.min(...scan.walls.map((w) => w.center.y - w.height / 2));
  project.ceilingHeight = Math.round(Math.max(...scan.walls.map((w) => w.height)) * M);

  // Square the plan up: rotate so the longest wall runs left-to-right.
  const longest = scan.walls.reduce((a, b) => (b.width > a.width ? b : a));
  const turn = -(Math.atan2(longest.axis.z, longest.axis.x) * 180) / Math.PI;
  const toPlan = (x: number, z: number): Vec2 => rotate({ x: x * M, y: z * M }, turn);
  const yawOf = (b: ScanBox) => (Math.atan2(b.axis.z, b.axis.x) * 180) / Math.PI + turn;

  // Walls
  const wallOfScanId = new Map<string, Wall>();
  for (const w of scan.walls) {
    const hx = (w.axis.x * w.width) / 2;
    const hz = (w.axis.z * w.width) / 2;
    const wall: Wall = {
      id: newId('wall'),
      a: toPlan(w.center.x - hx, w.center.z - hz),
      b: toPlan(w.center.x + hx, w.center.z + hz),
      thickness: SCAN_WALL_THICKNESS,
      height: Math.round(w.height * M * 2) / 2,
    };
    project.walls.push(wall);
    if (w.id) wallOfScanId.set(w.id, wall);
  }
  snapCorners(project.walls);

  // Doors, windows, open doorways
  const ends = project.walls.flatMap((w) => [w.a, w.b]);
  const middle = { x: ends.reduce((t, p) => t + p.x, 0) / ends.length, y: ends.reduce((t, p) => t + p.y, 0) / ends.length };
  const addOpenings = (boxes: ScanBox[], kind: Opening['kind']) => {
    for (const b of boxes) {
      const c = toPlan(b.center.x, b.center.z);
      const wall = (b.parentId && wallOfScanId.get(b.parentId)) || nearestWallTo(project.walls, c);
      if (!wall) continue;
      // A scan doesn't record which way a door swings: default to swinging into the scanned space.
      const n = { x: -(wall.b.y - wall.a.y), y: wall.b.x - wall.a.x };
      const side: 1 | -1 = (middle.x - c.x) * n.x + (middle.y - c.y) * n.y >= 0 ? 1 : -1;
      const sill = kind === 'window' ? Math.max(0, (b.center.y - b.height / 2 - floorY) * M) : 0;
      const top = (b.center.y + b.height / 2 - floorY) * M;
      project.openings.push({
        id: newId(kind),
        kind,
        wallId: wall.id,
        t: Math.min(1, Math.max(0, projectT(c, wall.a, wall.b))),
        width: Math.round(b.width * M * 2) / 2,
        hinge: 'start',
        side,
        sillHeight: Math.round(sill * 2) / 2,
        headHeight: Math.round(top * 2) / 2,
      });
    }
  };
  addOpenings(scan.doors, 'door');
  addOpenings(scan.windows, 'window');
  addOpenings(scan.openings, 'opening');

  // Objects
  const counts: Record<string, number> = {};
  for (const o of scan.objects) {
    const key = o.category.toLowerCase().replace(/[^a-z]/g, '');
    const map = OBJECT_MAP[key] ?? { kind: 'generic' as FurnitureKind, name: o.category || 'Object' };
    counts[key] = (counts[key] ?? 0) + 1;
    const c = toPlan(o.center.x, o.center.z);
    const elevation = Math.max(0, (o.center.y - o.height / 2 - floorY) * M);
    const item: FurnitureItem = {
      id: newId('furn'),
      catalogId: `scan-${key}`,
      name: counts[key] > 1 ? `${map.name} ${counts[key]}` : map.name,
      kind: map.kind,
      x: Math.round(c.x * 2) / 2,
      y: Math.round(c.y * 2) / 2,
      rotation: Math.round(normalizeDeg(yawOf(o)) * 10) / 10,
      width: Math.max(1, Math.round(o.width * M * 2) / 2),
      depth: Math.max(1, Math.round(o.depth * M * 2) / 2),
      height: Math.max(0.5, Math.round(o.height * M * 2) / 2),
      elevation: elevation < 2 ? 0 : Math.round(elevation * 2) / 2,
      shape: 'rect',
      // Wall-mounted things (a TV on the wall) don't take up floor.
      obstacle: elevation < 12,
    };
    if (FIXED.has(key)) item.color = '#d9dcdf';
    project.furniture.push(item);
  }

  // Shift so the plan starts near the origin.
  const pts = project.walls.flatMap((w) => [w.a, w.b]);
  const minX = Math.min(...pts.map((p) => p.x));
  const minY = Math.min(...pts.map((p) => p.y));
  for (const w of project.walls) for (const p of [w.a, w.b]) (p.x -= minX), (p.y -= minY);
  for (const f of project.furniture) (f.x -= minX), (f.y -= minY);
  // Round after snapping so shared corners stay shared.
  for (const w of project.walls) for (const p of [w.a, w.b]) (p.x = Math.round(p.x * 4) / 4), (p.y = Math.round(p.y * 4) / 4);

  project.rooms = deriveRooms(project.walls);
  for (const r of project.rooms) r.type = guessRoomType(r, project.furniture);
  project.rooms.forEach((r, i) => (r.name = project.rooms.length === 1 ? 'Scanned room' : `Room ${i + 1}`));
  return project;
}

/** Merge wall endpoints that nearly touch, so corners are closed. */
function snapCorners(walls: Wall[]) {
  const clusters: { sum: Vec2; n: number; members: Vec2[] }[] = [];
  for (const w of walls)
    for (const p of [w.a, w.b]) {
      const c = clusters.find((k) => dist({ x: k.sum.x / k.n, y: k.sum.y / k.n }, p) < CORNER_SNAP);
      if (c) {
        c.sum.x += p.x;
        c.sum.y += p.y;
        c.n++;
        c.members.push(p);
      } else clusters.push({ sum: { ...p }, n: 1, members: [p] });
    }
  for (const c of clusters)
    for (const p of c.members) {
      p.x = c.sum.x / c.n;
      p.y = c.sum.y / c.n;
    }
}

function nearestWallTo(walls: Wall[], p: Vec2): Wall | null {
  let best: Wall | null = null;
  let bestD = Infinity;
  for (const w of walls) {
    const d = dist(p, closestPointOnSegment(p, w.a, w.b));
    if (d < bestD) {
      bestD = d;
      best = w;
    }
  }
  return best;
}

const key = (p: Vec2) => `${Math.round(p.x)},${Math.round(p.y)}`;

/**
 * Turn closed loops of walls into room polygons. Loops are found where every
 * corner joins exactly two walls; anything else (T-junctions in multi-room
 * scans) falls back to one outline around all the walls.
 */
export function deriveRooms(walls: Wall[]): Room[] {
  const adj = new Map<string, { p: Vec2; next: Vec2[] }>();
  const link = (a: Vec2, b: Vec2) => {
    const n = adj.get(key(a)) ?? { p: a, next: [] };
    n.next.push(b);
    adj.set(key(a), n);
  };
  for (const w of walls) {
    if (dist(w.a, w.b) < 1) continue;
    link(w.a, w.b);
    link(w.b, w.a);
  }
  const rooms: Room[] = [];
  const seen = new Set<string>();
  let clean = true;
  for (const [k, node] of adj) {
    if (seen.has(k)) continue;
    const loop: Vec2[] = [];
    let prev: string | null = null;
    let cur: { p: Vec2; next: Vec2[] } | undefined = node;
    let closed = false;
    while (cur && cur.next.length === 2 && !seen.has(key(cur.p))) {
      seen.add(key(cur.p));
      loop.push({ ...cur.p });
      const nxt: Vec2 = key(cur.next[0]) !== prev ? cur.next[0] : cur.next[1];
      prev = key(cur.p);
      if (key(nxt) === k) {
        closed = true;
        break;
      }
      cur = adj.get(key(nxt));
    }
    if (closed && loop.length >= 3) rooms.push({ id: newId('room'), name: 'Room', type: 'other', polygon: loop });
    else {
      clean = false;
      seen.add(k);
    }
  }
  if (rooms.length > 0 && clean) return rooms.sort((a, b) => polygonArea(b.polygon) - polygonArea(a.polygon));
  // Fallback: outline of everything.
  const hull = convexHull(walls.flatMap((w) => [w.a, w.b]));
  return hull.length >= 3 ? [{ id: newId('room'), name: 'Scanned area', type: 'other', polygon: hull }] : [];
}

export function convexHull(points: Vec2[]): Vec2[] {
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (pts.length < 3) return pts.map((p) => ({ ...p }));
  const cross = (o: Vec2, a: Vec2, b: Vec2) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const half = (list: Vec2[]) => {
    const h: Vec2[] = [];
    for (const p of list) {
      while (h.length >= 2 && cross(h[h.length - 2], h[h.length - 1], p) <= 1e-9) h.pop();
      h.push(p);
    }
    h.pop();
    return h;
  };
  return [...half(pts), ...half([...pts].reverse())].map((p) => ({ ...p }));
}

function guessRoomType(room: Room, furniture: FurnitureItem[]): RoomType {
  const inside = furniture.filter((f) => pointInPolygon({ x: f.x, y: f.y }, room.polygon));
  const has = (...ids: string[]) => inside.some((f) => ids.includes(f.catalogId.replace('scan-', '')));
  if (has('bed')) return 'bedroom';
  if (has('toilet', 'bathtub')) return 'bathroom';
  if (has('sofa')) return 'living';
  if (has('stove', 'oven', 'refrigerator', 'dishwasher')) return 'kitchen';
  if (has('table') && inside.filter((f) => f.kind === 'chair').length >= 2) return 'dining';
  return 'other';
}

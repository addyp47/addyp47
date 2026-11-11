import type { FurnitureItem, Opening, Project, Vec2, Wall } from '../model/types';
import { add, dist, dot, lerp, norm, perp, rotate, scale, sub } from './vec';
import type { Poly } from './polygon';
import { bbox, type BBox } from './polygon';

export function wallLength(w: Wall): number {
  return dist(w.a, w.b);
}

export function wallDir(w: Wall): Vec2 {
  return norm(sub(w.b, w.a));
}

/** Unit normal pointing to the "left" of a→b (side = +1). */
export function wallNormal(w: Wall): Vec2 {
  return perp(wallDir(w));
}

/** Rectangle footprint of a wall, extended by half thickness at each end (square caps). */
export function wallPolygon(w: Wall): Poly {
  const d = wallDir(w);
  const n = perp(d);
  const h = w.thickness / 2;
  const a = sub(w.a, scale(d, h));
  const b = add(w.b, scale(d, h));
  return [add(a, scale(n, h)), add(b, scale(n, h)), sub(b, scale(n, h)), sub(a, scale(n, h))];
}

export function openingCenter(o: Opening, w: Wall): Vec2 {
  return lerp(w.a, w.b, o.t);
}

/** Endpoints of the opening along the wall centerline. */
export function openingSpan(o: Opening, w: Wall): [Vec2, Vec2] {
  const c = openingCenter(o, w);
  const d = wallDir(w);
  return [sub(c, scale(d, o.width / 2)), add(c, scale(d, o.width / 2))];
}

/** Clamp t so an opening of `width` fits within the wall. */
export function clampOpeningT(t: number, width: number, w: Wall): number {
  const L = wallLength(w);
  if (L <= width) return 0.5;
  const m = width / 2 / L;
  return Math.min(1 - m, Math.max(m, t));
}

/** Rectangle cut through the wall at the opening (the doorway itself). */
export function openingPolygon(o: Opening, w: Wall): Poly {
  const [p0, p1] = openingSpan(o, w);
  const n = scale(wallNormal(w), w.thickness / 2);
  return [add(p0, n), add(p1, n), sub(p1, n), sub(p0, n)];
}

export interface DoorGeometry {
  hinge: Vec2;
  /** Free end of the leaf when closed (latch side). */
  latch: Vec2;
  /** Free end of the leaf when open 90°. */
  open: Vec2;
  /** Sweep sector polygon (convex), for collision. */
  swing: Poly;
  /** Sweep sign for drawing the arc. */
  sweepFlag: 0 | 1;
}

export function doorGeometry(o: Opening, w: Wall, segments = 12): DoorGeometry {
  const [p0, p1] = openingSpan(o, w);
  const n = scale(wallNormal(w), o.side);
  const offset = scale(n, w.thickness / 2);
  const hinge = add(o.hinge === 'start' ? p0 : p1, offset);
  const latch = add(o.hinge === 'start' ? p1 : p0, offset);
  const closedVec = sub(latch, hinge);
  const sign = dot(rotate(closedVec, 90), n) >= 0 ? 1 : -1;
  const swing: Poly = [hinge];
  for (let i = 0; i <= segments; i++) swing.push(add(hinge, rotate(closedVec, (sign * 90 * i) / segments)));
  const open = add(hinge, rotate(closedVec, sign * 90));
  // Arc drawn from open → latch around hinge. SVG sweep-flag 1 = clockwise on screen (positive angle).
  return { hinge, latch, open, swing, sweepFlag: sign > 0 ? 0 : 1 };
}

export function furnitureLocalCorners(f: Pick<FurnitureItem, 'width' | 'depth'>): Vec2[] {
  const w = f.width / 2;
  const d = f.depth / 2;
  return [
    { x: -w, y: -d },
    { x: w, y: -d },
    { x: w, y: d },
    { x: -w, y: d },
  ];
}

export function toWorld(f: Pick<FurnitureItem, 'x' | 'y' | 'rotation'>, local: Vec2): Vec2 {
  return add({ x: f.x, y: f.y }, rotate(local, f.rotation));
}

export function toLocal(f: Pick<FurnitureItem, 'x' | 'y' | 'rotation'>, world: Vec2): Vec2 {
  return rotate(sub(world, { x: f.x, y: f.y }), -f.rotation);
}

/** Footprint polygon (ellipses approximated by a 20-gon). */
export function furniturePolygon(f: FurnitureItem): Poly {
  if (f.shape === 'ellipse') {
    const pts: Poly = [];
    const n = 20;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      pts.push(toWorld(f, { x: (Math.cos(a) * f.width) / 2, y: (Math.sin(a) * f.depth) / 2 }));
    }
    return pts;
  }
  return furnitureLocalCorners(f).map((c) => toWorld(f, c));
}

/** Bounds of everything drawn in the plan (for fit-to-view and PNG export). */
export function projectBounds(p: Project, includeBackground = true): BBox | null {
  const pts: Vec2[] = [];
  for (const r of p.rooms) pts.push(...r.polygon);
  for (const w of p.walls) pts.push(...wallPolygon(w));
  for (const f of p.furniture) pts.push(...furniturePolygon(f));
  if (includeBackground && p.background && p.background.visible) {
    const b = p.background;
    pts.push({ x: b.x, y: b.y }, { x: b.x + b.naturalWidth * b.inchesPerPixel, y: b.y + b.naturalHeight * b.inchesPerPixel });
  }
  return bbox(pts);
}

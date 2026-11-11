import type { Vec2 } from '../model/types';
import { cross, dist, dot, sub } from './vec';

export type Poly = Vec2[];

function projectPoly(poly: Poly, axis: Vec2): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const p of poly) {
    const d = dot(p, axis);
    if (d < min) min = d;
    if (d > max) max = d;
  }
  return [min, max];
}

/**
 * Separating Axis Theorem for CONVEX polygons. Returns true when they overlap
 * by more than `eps` along every axis (so merely touching is not overlap).
 */
export function convexPolysOverlap(a: Poly, b: Poly, eps = 0.25): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p1 = poly[i];
      const p2 = poly[(i + 1) % poly.length];
      const edge = sub(p2, p1);
      const l = Math.hypot(edge.x, edge.y);
      if (l === 0) continue;
      const axis = { x: -edge.y / l, y: edge.x / l };
      const [aMin, aMax] = projectPoly(a, axis);
      const [bMin, bMax] = projectPoly(b, axis);
      const overlap = Math.min(aMax, bMax) - Math.max(aMin, bMin);
      if (overlap <= eps) return false;
    }
  }
  return true;
}

export function closestPointOnSegment(p: Vec2, a: Vec2, b: Vec2): Vec2 {
  const ab = sub(b, a);
  const l2 = dot(ab, ab);
  if (l2 === 0) return { ...a };
  const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / l2));
  return { x: a.x + ab.x * t, y: a.y + ab.y * t };
}

/** Parameter t of the projection of p onto line ab (unclamped). */
export function projectT(p: Vec2, a: Vec2, b: Vec2): number {
  const ab = sub(b, a);
  const l2 = dot(ab, ab);
  return l2 === 0 ? 0 : dot(sub(p, a), ab) / l2;
}

export function pointSegmentDistance(p: Vec2, a: Vec2, b: Vec2): number {
  return dist(p, closestPointOnSegment(p, a, b));
}

function segmentsIntersect(a1: Vec2, a2: Vec2, b1: Vec2, b2: Vec2): boolean {
  const d1 = cross(sub(a2, a1), sub(b1, a1));
  const d2 = cross(sub(a2, a1), sub(b2, a1));
  const d3 = cross(sub(b2, b1), sub(a1, b1));
  const d4 = cross(sub(b2, b1), sub(a2, b1));
  return d1 * d2 < 0 && d3 * d4 < 0;
}

export interface ClosestPair {
  distance: number;
  a: Vec2;
  b: Vec2;
}

/** Minimum distance between two (convex) polygons with the closest points. 0 when overlapping. */
export function polygonDistance(pa: Poly, pb: Poly): ClosestPair {
  if (convexPolysOverlap(pa, pb, 0)) {
    return { distance: 0, a: pa[0], b: pa[0] };
  }
  let best: ClosestPair = { distance: Infinity, a: pa[0], b: pb[0] };
  const consider = (points: Poly, edges: Poly, pointsAreA: boolean) => {
    for (const p of points) {
      for (let i = 0; i < edges.length; i++) {
        const q = closestPointOnSegment(p, edges[i], edges[(i + 1) % edges.length]);
        const d = dist(p, q);
        if (d < best.distance) best = pointsAreA ? { distance: d, a: p, b: q } : { distance: d, a: q, b: p };
      }
    }
  };
  // Edge crossings (non-convex edge cases) → 0
  for (let i = 0; i < pa.length; i++) {
    for (let j = 0; j < pb.length; j++) {
      if (segmentsIntersect(pa[i], pa[(i + 1) % pa.length], pb[j], pb[(j + 1) % pb.length])) {
        return { distance: 0, a: pa[i], b: pb[j] };
      }
    }
  }
  consider(pa, pb, true);
  consider(pb, pa, false);
  return best;
}

export function pointInPolygon(p: Vec2, poly: Poly): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function polygonArea(poly: Poly): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s) / 2;
}

export function polygonCentroid(poly: Poly): Vec2 {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    const f = p.x * q.y - q.x * p.y;
    a += f;
    cx += (p.x + q.x) * f;
    cy += (p.y + q.y) * f;
  }
  if (Math.abs(a) < 1e-9) {
    const n = poly.length || 1;
    return { x: poly.reduce((s, p) => s + p.x, 0) / n, y: poly.reduce((s, p) => s + p.y, 0) / n };
  }
  return { x: cx / (3 * a), y: cy / (3 * a) };
}

export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function bbox(points: Vec2[]): BBox | null {
  if (points.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY };
}

export function polyToPath(poly: Poly): string {
  return poly.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ') + ' Z';
}

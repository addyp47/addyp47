import type { Project, Vec2 } from '../model/types';
import { dist } from './vec';

export interface Guide {
  from: Vec2;
  to: Vec2;
}

export interface SnapResult {
  point: Vec2;
  /** Snapped exactly onto an existing vertex. */
  vertex: Vec2 | null;
  guides: Guide[];
}

export function projectVertices(project: Project): Vec2[] {
  const pts: Vec2[] = [];
  for (const w of project.walls) pts.push(w.a, w.b);
  for (const r of project.rooms) pts.push(...r.polygon);
  return pts;
}

/**
 * Snap a pointer position for tracing:
 * 1. onto an existing vertex (or in-progress point) within `threshold`;
 * 2. otherwise orthogonally (0/90°) relative to `anchor` unless `free`;
 * 3. then align the free axis with nearby vertices (dashed guides);
 * 4. finally round to whole inches.
 */
export function snapPoint(
  raw: Vec2,
  opts: { anchor: Vec2 | null; candidates: Vec2[]; threshold: number; free: boolean; exclude?: Vec2[] },
): SnapResult {
  const { anchor, candidates, threshold, free } = opts;
  const excluded = (c: Vec2) => opts.exclude?.some((e) => e === c) ?? false;

  let best: Vec2 | null = null;
  let bestD = threshold;
  for (const c of candidates) {
    if (excluded(c)) continue;
    const d = dist(raw, c);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  if (best) return { point: { ...best }, vertex: best, guides: [] };

  const p = { ...raw };
  let lockX = false;
  let lockY = false;
  if (anchor && !free) {
    if (Math.abs(raw.x - anchor.x) > Math.abs(raw.y - anchor.y)) {
      p.y = anchor.y;
      lockY = true;
    } else {
      p.x = anchor.x;
      lockX = true;
    }
  }

  const guides: Guide[] = [];
  if (!free) {
    let bx: Vec2 | null = null;
    let by: Vec2 | null = null;
    let dx = threshold;
    let dy = threshold;
    for (const c of candidates) {
      if (excluded(c)) continue;
      if (!lockX && Math.abs(c.x - p.x) < dx) {
        dx = Math.abs(c.x - p.x);
        bx = c;
      }
      if (!lockY && Math.abs(c.y - p.y) < dy) {
        dy = Math.abs(c.y - p.y);
        by = c;
      }
    }
    if (bx) {
      p.x = bx.x;
      guides.push({ from: bx, to: { ...p } });
    }
    if (by) {
      p.y = by.y;
      guides.push({ from: by, to: { ...p } });
    }
  }

  if (!guides.some((g) => g.from.x === p.x) && !lockX) p.x = Math.round(p.x);
  if (!guides.some((g) => g.from.y === p.y) && !lockY) p.y = Math.round(p.y);
  return { point: p, vertex: null, guides };
}

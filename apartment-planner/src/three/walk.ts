import type { Project, Vec2 } from '../model/types';
import { furniturePolygon, wallLength } from '../geometry/plan';
import { closestPointOnSegment, pointInPolygon, projectT } from '../geometry/polygon';
import { dist } from '../geometry/vec';

/** Eye height and body size for the first-person walkthrough (inches). */
export const EYE_HEIGHT = 64;
export const BODY_RADIUS = 9;
/** Furniture lower than this can be stepped over (rugs, bath mats). */
const STEP_OVER = 6;

/** True when a person standing at `p` would intersect a wall or a piece of furniture. */
export function isBlocked(project: Project, p: Vec2, radius = BODY_RADIUS): boolean {
  for (const w of project.walls) {
    const L = wallLength(w);
    if (L < 1) continue;
    const q = closestPointOnSegment(p, w.a, w.b);
    if (dist(p, q) >= radius + w.thickness / 2) continue;
    // Doors and open doorways let you through, if you fit.
    const along = projectT(p, w.a, w.b) * L;
    const passable = project.openings.some(
      (o) => o.wallId === w.id && (o.kind === 'door' || o.kind === 'opening') && Math.abs(along - o.t * L) <= o.width / 2 - radius * 0.6,
    );
    if (!passable) return true;
  }
  for (const f of project.furniture) {
    if (!f.obstacle || f.height + f.elevation < STEP_OVER || f.elevation > EYE_HEIGHT + 8) continue;
    // Cheap reject, then exact footprint test.
    if (dist(p, { x: f.x, y: f.y }) > Math.hypot(f.width, f.depth) / 2 + radius) continue;
    const poly = furniturePolygon(f);
    if (pointInPolygon(p, poly)) return true;
    for (let i = 0; i < poly.length; i++) {
      if (dist(p, closestPointOnSegment(p, poly[i], poly[(i + 1) % poly.length])) < radius) return true;
    }
  }
  return false;
}

/**
 * Move by `delta`, sliding along obstacles. If you start inside something
 * (e.g. the walk began inside a sofa), any move is allowed so you can get out.
 */
export function walkStep(project: Project, from: Vec2, delta: Vec2, radius = BODY_RADIUS): Vec2 {
  if (isBlocked(project, from, radius)) return { x: from.x + delta.x, y: from.y + delta.y };
  const tries: Vec2[] = [
    { x: from.x + delta.x, y: from.y + delta.y },
    { x: from.x + delta.x, y: from.y },
    { x: from.x, y: from.y + delta.y },
  ];
  for (const t of tries) if (!isBlocked(project, t, radius)) return t;
  return from;
}

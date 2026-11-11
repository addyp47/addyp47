import type { FurnitureItem, Project, Vec2 } from '../model/types';
import { CLEARANCE_EXEMPT_IDS, CLEARANCE_EXEMPT_KINDS } from '../catalog/furniture';
import { doorGeometry, furniturePolygon, openingPolygon, wallPolygon } from '../geometry/plan';
import { convexPolysOverlap, polygonDistance, segmentsIntersect, type Poly } from '../geometry/polygon';
import { lerp } from '../geometry/vec';
import { formatInches } from '../geometry/units';

export const WALKWAY_MIN = 30; // inches: comfortable walkway
/** Gaps smaller than this are treated as "pushed together on purpose", not walkways. */
export const TOUCHING_GAP = 2;
const OVERLAP_EPS = 0.75;

export type WarningKind = 'wall' | 'door' | 'clearance' | 'overlap';

export interface PlanWarning {
  id: string;
  kind: WarningKind;
  severity: 'error' | 'warning';
  message: string;
  furnitureIds: string[];
  /** Where to draw the marker. */
  at: Vec2;
  /** Closest points for clearance warnings. */
  line?: [Vec2, Vec2];
  gap?: number;
  openingId?: string;
}

function checksClearance(f: FurnitureItem): boolean {
  return f.obstacle && !CLEARANCE_EXEMPT_KINDS.includes(f.kind) && !CLEARANCE_EXEMPT_IDS.has(f.catalogId);
}

const isLowTable = (f: FurnitureItem) => f.kind === 'table' && f.height <= 20;
const isSeat = (f: FurnitureItem) => f.kind === 'sofa' || f.kind === 'chair' || f.kind === 'bed';

/** Pairs where a small gap is intended (coffee table ↔ sofa is ideally 14–18"). */
function pairExempt(a: FurnitureItem, b: FurnitureItem): boolean {
  return (isLowTable(a) && isSeat(b)) || (isLowTable(b) && isSeat(a));
}

/** Pieces that legitimately overlap others (chairs tuck under tables, things sit on rugs). */
function overlapExempt(a: FurnitureItem, b: FurnitureItem): boolean {
  if (!a.obstacle || !b.obstacle) return true;
  const tucks = (x: FurnitureItem) => x.kind === 'chair';
  const tucksUnder = (x: FurnitureItem) => x.kind === 'table' || x.kind === 'desk';
  return (tucks(a) && tucksUnder(b)) || (tucks(b) && tucksUnder(a));
}

const centroid = (poly: Poly): Vec2 => ({
  x: poly.reduce((s, p) => s + p.x, 0) / poly.length,
  y: poly.reduce((s, p) => s + p.y, 0) / poly.length,
});

export function computeWarnings(project: Project): PlanWarning[] {
  const out: PlanWarning[] = [];
  const furniture = project.furniture;
  const polys = new Map(furniture.map((f) => [f.id, furniturePolygon(f)]));
  const wallPolys = project.walls.map((w) => ({ wall: w, poly: wallPolygon(w) }));
  const wallById = new Map(project.walls.map((w) => [w.id, w]));
  const doors = project.openings
    .filter((o) => o.kind === 'door' && wallById.has(o.wallId))
    .map((o) => {
      const w = wallById.get(o.wallId)!;
      return { opening: o, swing: doorGeometry(o, w).swing, doorway: openingPolygon(o, w) };
    });

  for (const f of furniture) {
    if (!f.obstacle) continue;
    const fp = polys.get(f.id)!;

    // 1. Overlapping a wall
    if (wallPolys.some(({ poly }) => convexPolysOverlap(fp, poly, OVERLAP_EPS))) {
      out.push({
        id: `wall:${f.id}`,
        kind: 'wall',
        severity: 'error',
        message: `${f.name} overlaps a wall`,
        furnitureIds: [f.id],
        at: { x: f.x, y: f.y },
      });
    }

    // 2. Blocking a door swing or doorway
    for (const d of doors) {
      if (convexPolysOverlap(fp, d.swing, OVERLAP_EPS) || convexPolysOverlap(fp, d.doorway, OVERLAP_EPS)) {
        out.push({
          id: `door:${f.id}:${d.opening.id}`,
          kind: 'door',
          severity: 'error',
          message: `${f.name} blocks a door swing`,
          furnitureIds: [f.id],
          at: centroid(d.swing),
          openingId: d.opening.id,
        });
      }
    }

    // 3. Walkway gap to walls
    if (checksClearance(f)) {
      let best: { distance: number; a: Vec2; b: Vec2 } | null = null;
      for (const { poly } of wallPolys) {
        const c = polygonDistance(fp, poly);
        if (c.distance > TOUCHING_GAP && c.distance < WALKWAY_MIN && (!best || c.distance < best.distance)) best = c;
      }
      if (best) {
        out.push({
          id: `clear-wall:${f.id}`,
          kind: 'clearance',
          severity: 'warning',
          message: `Only ${formatInches(best.distance)} between ${f.name} and the wall. Push it against the wall or leave ${WALKWAY_MIN}"+`,
          furnitureIds: [f.id],
          at: lerp(best.a, best.b, 0.5),
          line: [best.a, best.b],
          gap: best.distance,
        });
      }
    }
  }

  // 4. Furniture ↔ furniture: overlaps and tight walkways
  for (let i = 0; i < furniture.length; i++) {
    const a = furniture[i];
    if (!a.obstacle) continue;
    for (let j = i + 1; j < furniture.length; j++) {
      const b = furniture[j];
      if (!b.obstacle) continue;
      const pa = polys.get(a.id)!;
      const pb = polys.get(b.id)!;
      if (convexPolysOverlap(pa, pb, OVERLAP_EPS)) {
        if (!overlapExempt(a, b)) {
          out.push({
            id: `overlap:${a.id}:${b.id}`,
            kind: 'overlap',
            severity: 'warning',
            message: `${a.name} overlaps ${b.name}`,
            furnitureIds: [a.id, b.id],
            at: lerp({ x: a.x, y: a.y }, { x: b.x, y: b.y }, 0.5),
          });
        }
        continue;
      }
      if (!checksClearance(a) || !checksClearance(b) || pairExempt(a, b)) continue;
      const c = polygonDistance(pa, pb);
      // A gap that runs through a wall isn't a walkway (pieces in neighboring rooms).
      if (project.walls.some((w) => segmentsIntersect(c.a, c.b, w.a, w.b))) continue;
      if (c.distance > TOUCHING_GAP && c.distance < WALKWAY_MIN) {
        out.push({
          id: `clear:${a.id}:${b.id}`,
          kind: 'clearance',
          severity: 'warning',
          message: `Only ${formatInches(c.distance)} between ${a.name} and ${b.name} (aim for ${WALKWAY_MIN}" to walk through)`,
          furnitureIds: [a.id, b.id],
          at: lerp(c.a, c.b, 0.5),
          line: [c.a, c.b],
          gap: c.distance,
        });
      }
    }
  }

  const order: Record<WarningKind, number> = { wall: 0, door: 1, overlap: 2, clearance: 3 };
  return out.sort((x, y) => order[x.kind] - order[y.kind]);
}

const cache = new WeakMap<Project, PlanWarning[]>();
/** Memoized per project snapshot (immer gives a new object on every change). */
export function getWarnings(project: Project): PlanWarning[] {
  let w = cache.get(project);
  if (!w) {
    w = computeWarnings(project);
    cache.set(project, w);
  }
  return w;
}

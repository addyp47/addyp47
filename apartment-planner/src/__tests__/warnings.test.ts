import { describe, expect, it } from 'vitest';
import { computeWarnings } from '../analysis/warnings';
import { createEmptyProject, createOpening, createWall } from '../model/defaults';
import { CATALOG_BY_ID, createFurniture } from '../catalog/furniture';
import type { Project } from '../model/types';

function room(): Project {
  const p = createEmptyProject();
  // 12' x 10' box, walls 5" thick, centered on lines
  const pts = [{ x: 0, y: 0 }, { x: 144, y: 0 }, { x: 144, y: 120 }, { x: 0, y: 120 }];
  for (let i = 0; i < 4; i++) p.walls.push(createWall(pts[i], pts[(i + 1) % 4]));
  return p;
}
const place = (p: Project, id: string, x: number, y: number, rotation = 0) => {
  const f = createFurniture(CATALOG_BY_ID.get(id)!, { x, y }, rotation);
  p.furniture.push(f);
  return f;
};

describe('warnings', () => {
  it('flags a piece overlapping a wall', () => {
    const p = room();
    place(p, 'dresser', 72, 5); // depth 18 → spans y -4..14, wall inner face at 2.5
    expect(computeWarnings(p).some((w) => w.kind === 'wall')).toBe(true);
  });

  it('does not flag a piece flush against a wall', () => {
    const p = room();
    place(p, 'dresser', 72, 2.5 + 9); // back exactly on wall face
    expect(computeWarnings(p).filter((w) => w.kind === 'wall' || w.kind === 'clearance')).toHaveLength(0);
  });

  it('flags a blocked door swing', () => {
    const p = room();
    const w = p.walls[0]; // top wall, a→b along +x; side +1 swings toward +y (into room)
    p.openings.push(createOpening('door', w.id, 0.5, 1));
    place(p, 'side-table', 72, 20);
    expect(computeWarnings(p).some((x) => x.kind === 'door')).toBe(true);
    p.openings[0].side = -1; // swing outward
    expect(computeWarnings(p).some((x) => x.kind === 'door')).toBe(false);
  });

  it('flags tight walkways between pieces but not sofa↔coffee table', () => {
    const p = room();
    place(p, 'loveseat', 72, 2.5 + 17.5); // against top wall (35" deep)
    place(p, 'coffee-table', 72, 37.5 + 16 + 12); // 16" in front of loveseat
    expect(computeWarnings(p).filter((w) => w.kind === 'clearance')).toHaveLength(0);
    place(p, 'dresser', 72, 120 - 2.5 - 9); // against bottom wall
    // gap coffee table (bottom edge 77.5) to dresser (top edge 99.5) = 22"
    const c = computeWarnings(p).filter((w) => w.kind === 'clearance');
    expect(c).toHaveLength(1);
    expect(c[0].gap).toBeCloseTo(22);
  });

  it('flags a piece floating a few inches from a wall', () => {
    const p = room();
    place(p, 'bookshelf', 40, 2.5 + 6 + 12); // 12" from wall
    const c = computeWarnings(p).filter((w) => w.kind === 'clearance');
    expect(c).toHaveLength(1);
    expect(c[0].gap).toBeCloseTo(12);
  });

  it('ignores rugs and chairs tucked under tables', () => {
    const p = room();
    place(p, 'rug-5x8', 72, 60);
    place(p, 'dining-4', 72, 60);
    place(p, 'dining-chair', 72, 60 + 15);
    expect(computeWarnings(p).filter((w) => w.kind === 'overlap')).toHaveLength(0);
  });
});

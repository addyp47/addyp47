import { describe, expect, it } from 'vitest';
import { wallPieces } from '../three/buildScene';
import { createOpening, createWall } from '../model/defaults';

describe('3D wall pieces', () => {
  it('cuts a door to the floor and leaves a header', () => {
    const w = createWall({ x: 0, y: 0 }, { x: 120, y: 0 }); // 96" high, 5" thick
    const door = { ...createOpening('door', w.id, 0.5), width: 32 }; // 44..76, head 80
    const pieces = wallPieces(w, [door]);
    expect(pieces).toEqual([
      { s: -2.5, e: 44, y0: 0, y1: 96 },
      { s: 44, e: 76, y0: 80, y1: 96 },
      { s: 76, e: 122.5, y0: 0, y1: 96 },
    ]);
  });
  it('keeps wall below and above a window', () => {
    const w = createWall({ x: 0, y: 0 }, { x: 120, y: 0 });
    const win = createOpening('window', w.id, 0.5); // sill 30, head 78
    const mid = wallPieces(w, [win]).filter((p) => p.s === 42);
    expect(mid.map((p) => [p.y0, p.y1])).toEqual([[0, 30], [78, 96]]);
  });
});

import { isBlocked, walkStep } from '../three/walk';
import { createEmptyProject } from '../model/defaults';
import { CATALOG_BY_ID, createFurniture } from '../catalog/furniture';

describe('walkthrough collision', () => {
  const setup = () => {
    const p = createEmptyProject();
    const w = createWall({ x: 0, y: 0 }, { x: 200, y: 0 });
    p.walls.push(w);
    p.openings.push({ ...createOpening('door', w.id, 0.5), width: 32 }); // doorway 84..116
    return p;
  };
  it('stops at walls but passes through doorways', () => {
    const p = setup();
    expect(isBlocked(p, { x: 30, y: 5 })).toBe(true);
    expect(isBlocked(p, { x: 100, y: 0 })).toBe(false);
    // walking straight at the wall stops; through the door continues
    expect(walkStep(p, { x: 30, y: 30 }, { x: 0, y: -25 })).toEqual({ x: 30, y: 30 });
    expect(walkStep(p, { x: 100, y: 15 }, { x: 0, y: -25 }).y).toBe(-10);
  });
  it('slides along a wall instead of sticking', () => {
    const p = setup();
    const next = walkStep(p, { x: 30, y: 13 }, { x: 5, y: -5 });
    expect(next).toEqual({ x: 35, y: 13 });
  });
  it('is blocked by furniture but steps over rugs', () => {
    const p = setup();
    p.furniture.push(createFurniture(CATALOG_BY_ID.get('sofa-3')!, { x: 60, y: 100 }));
    p.furniture.push(createFurniture(CATALOG_BY_ID.get('rug-5x8')!, { x: 150, y: 100 }));
    expect(isBlocked(p, { x: 60, y: 100 })).toBe(true);
    expect(isBlocked(p, { x: 60, y: 124 })).toBe(true); // within body radius of the sofa front
    expect(isBlocked(p, { x: 150, y: 100 })).toBe(false);
  });
});

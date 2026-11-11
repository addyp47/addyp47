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

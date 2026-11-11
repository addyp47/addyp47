import { describe, expect, it } from 'vitest';
import { convexPolysOverlap, polygonArea, polygonDistance } from '../geometry/polygon';
import { formatFtIn, parseLength } from '../geometry/units';
import { doorGeometry, furniturePolygon, wallPolygon } from '../geometry/plan';
import { createOpening, createWall } from '../model/defaults';

const sq = (x: number, y: number, s: number) => [
  { x, y }, { x: x + s, y }, { x: x + s, y: y + s }, { x, y: y + s },
];

describe('units', () => {
  it('formats ft/in', () => {
    expect(formatFtIn(90)).toBe(`7' 6"`);
    expect(formatFtIn(24)).toBe(`2'`);
    expect(formatFtIn(5)).toBe(`5"`);
  });
  it('parses lengths', () => {
    expect(parseLength(`7' 6"`)).toBe(90);
    expect(parseLength('7ft 6in')).toBe(90);
    expect(parseLength('84')).toBe(84);
    expect(parseLength(`10'`)).toBe(120);
    expect(parseLength('abc')).toBeNull();
  });
});

describe('polygons', () => {
  it('detects overlap and separation', () => {
    expect(convexPolysOverlap(sq(0, 0, 10), sq(5, 5, 10))).toBe(true);
    expect(convexPolysOverlap(sq(0, 0, 10), sq(10, 0, 10))).toBe(false); // touching
    expect(convexPolysOverlap(sq(0, 0, 10), sq(20, 0, 10))).toBe(false);
  });
  it('measures distance', () => {
    expect(polygonDistance(sq(0, 0, 10), sq(30, 0, 10)).distance).toBeCloseTo(20);
    expect(polygonDistance(sq(0, 0, 10), sq(5, 5, 10)).distance).toBe(0);
  });
  it('computes area', () => {
    expect(polygonArea(sq(0, 0, 12))).toBe(144);
  });
});

describe('plan geometry', () => {
  it('builds wall footprint with square caps', () => {
    const w = createWall({ x: 0, y: 0 }, { x: 100, y: 0 });
    const xs = wallPolygon(w).map((p) => p.x);
    expect(Math.min(...xs)).toBeCloseTo(-2.5);
    expect(Math.max(...xs)).toBeCloseTo(102.5);
  });
  it('swings the door to the requested side', () => {
    const w = createWall({ x: 0, y: 0 }, { x: 100, y: 0 });
    const left = doorGeometry({ ...createOpening('door', w.id, 0.5, 1) }, w);
    const right = doorGeometry({ ...createOpening('door', w.id, 0.5, -1) }, w);
    // wall normal for a→b along +x is (0, 1) in y-down coords
    expect(left.open.y).toBeGreaterThan(20);
    expect(right.open.y).toBeLessThan(-20);
  });
  it('rotates furniture footprints', () => {
    const poly = furniturePolygon({
      id: 'f', catalogId: 'x', name: 'x', kind: 'generic', x: 0, y: 0, rotation: 90,
      width: 80, depth: 20, height: 10, elevation: 0, shape: 'rect', obstacle: true,
    });
    const ys = poly.map((p) => p.y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(80);
  });
});

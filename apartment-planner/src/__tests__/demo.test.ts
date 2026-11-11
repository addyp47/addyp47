import { describe, expect, it } from 'vitest';
import { createDemoProject } from '../demo/demoProject';
import { computeWarnings } from '../analysis/warnings';
import { isBlocked } from '../three/walk';

describe('demo apartment', () => {
  it('is a clean layout with no warnings', () => {
    expect(computeWarnings(createDemoProject()).map((x) => x.message)).toEqual([]);
  });
  it('lets you walk through each doorway', () => {
    const p = createDemoProject();
    expect(isBlocked(p, { x: 216, y: 126 })).toBe(false); // living → bedroom
    expect(isBlocked(p, { x: 244, y: 156 })).toBe(false); // bedroom → bath
    expect(isBlocked(p, { x: 216, y: 60 })).toBe(true); // solid wall
  });
});

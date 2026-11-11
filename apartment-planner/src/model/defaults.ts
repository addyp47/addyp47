import type { Opening, OpeningKind, Palette, Project, Wall, Vec2 } from './types';
import { SCHEMA_VERSION } from './types';

export function newId(prefix = 'id'): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${rand}`;
}

export const DEFAULT_WALL_THICKNESS = 5;
export const DEFAULT_CEILING_HEIGHT = 96;

export const DEFAULT_PALETTE: Palette = {
  walls: '#ece8df',
  floor: '#efe9df',
  wood: '#b48a5a',
  textile: '#9aa3ab',
  accents: ['#c9b79c', '#6b7f73', '#a65e46'],
};

export function createEmptyProject(name = 'My apartment'): Project {
  const now = Date.now();
  return {
    version: SCHEMA_VERSION,
    id: newId('proj'),
    name,
    createdAt: now,
    updatedAt: now,
    ceilingHeight: DEFAULT_CEILING_HEIGHT,
    background: null,
    rooms: [],
    walls: [],
    openings: [],
    furniture: [],
    style: { presetId: null, palette: { ...DEFAULT_PALETTE, accents: [...DEFAULT_PALETTE.accents] }, renterMode: true },
    source: { kind: 'manual' },
  };
}

export function createWall(a: Vec2, b: Vec2, ceilingHeight = DEFAULT_CEILING_HEIGHT): Wall {
  return { id: newId('wall'), a: { ...a }, b: { ...b }, thickness: DEFAULT_WALL_THICKNESS, height: ceilingHeight };
}

export const OPENING_DEFAULTS: Record<OpeningKind, Pick<Opening, 'width' | 'sillHeight' | 'headHeight'>> = {
  door: { width: 32, sillHeight: 0, headHeight: 80 },
  window: { width: 36, sillHeight: 30, headHeight: 78 },
  outlet: { width: 4, sillHeight: 12, headHeight: 16 },
  opening: { width: 36, sillHeight: 0, headHeight: 80 },
};

export function createOpening(kind: OpeningKind, wallId: string, t: number, side: 1 | -1 = 1): Opening {
  return {
    id: newId(kind),
    kind,
    wallId,
    t,
    hinge: 'start',
    side,
    ...OPENING_DEFAULTS[kind],
  };
}

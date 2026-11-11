import type { FurnitureItem, FurnitureKind, Opening, OpeningKind, Project, Vec2, Wall } from '../model/types';
import { createEmptyProject, createOpening, createWall, newId } from '../model/defaults';
import { CATALOG_BY_ID, createFurniture } from '../catalog/furniture';
import { PRESETS_BY_ID } from '../styles/presets';
import { wallLength } from '../geometry/plan';

/**
 * A furnished one-bedroom apartment (about 620 sq ft) used as a sample and for
 * demos: living room with kitchenette, bedroom, and bathroom.
 */
export function createDemoProject(): Project {
  const p = createEmptyProject('Demo apartment');
  const preset = PRESETS_BY_ID.get('midcentury')!;
  p.style = { presetId: preset.id, palette: { ...preset.palette, accents: [...preset.palette.accents] }, renterMode: true };

  const wall = (ax: number, ay: number, bx: number, by: number): Wall => {
    const w = createWall({ x: ax, y: ay }, { x: bx, y: by }, p.ceilingHeight);
    p.walls.push(w);
    return w;
  };
  // Walls are split at every junction so none overlap.
  const top1 = wall(0, 0, 216, 0);
  const top2 = wall(216, 0, 372, 0);
  const west = wall(0, 0, 0, 180);
  wall(0, 180, 216, 180);
  const mid1 = wall(216, 0, 216, 156);
  wall(216, 156, 216, 180);
  wall(216, 180, 216, 240);
  const east = wall(372, 0, 372, 156);
  const bedSouth1 = wall(216, 156, 300, 156);
  wall(300, 156, 372, 156);
  wall(300, 156, 300, 240);
  wall(216, 240, 300, 240);

  const rect = (x0: number, y0: number, x1: number, y1: number): Vec2[] => [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
  p.rooms.push(
    { id: newId('room'), name: 'Living room', type: 'living', polygon: rect(0, 0, 216, 180) },
    { id: newId('room'), name: 'Bedroom', type: 'bedroom', polygon: rect(216, 0, 372, 156) },
    { id: newId('room'), name: 'Bathroom', type: 'bathroom', polygon: rect(216, 156, 300, 240) },
  );

  /** Opening centered `at` inches from the wall's start; doors swing toward `into`. */
  const open = (kind: OpeningKind, w: Wall, at: number, opts: Partial<Opening> = {}, into?: Vec2) => {
    const o = { ...createOpening(kind, w.id, at / wallLength(w)), ...opts };
    if (into) {
      const n = { x: -(w.b.y - w.a.y), y: w.b.x - w.a.x };
      const c = { x: w.a.x + (w.b.x - w.a.x) * o.t, y: w.a.y + (w.b.y - w.a.y) * o.t };
      o.side = (into.x - c.x) * n.x + (into.y - c.y) * n.y >= 0 ? 1 : -1;
    }
    p.openings.push(o);
  };
  open('door', west, 150, { width: 34 }, { x: 100, y: 150 }); // entry
  open('door', mid1, 126, { width: 30, hinge: 'end' }, { x: 300, y: 126 }); // living → bedroom
  open('door', bedSouth1, 28, { width: 28 }, { x: 244, y: 120 }); // bedroom → bath (swings into the bedroom)
  open('window', top1, 62, { width: 48 });
  open('window', top1, 150, { width: 48 });
  open('window', top2, 84, { width: 60 });
  open('window', east, 110, { width: 36 });
  open('outlet', top1, 20, {}, { x: 20, y: 50 });
  open('outlet', west, 60, {}, { x: 50, y: 60 });
  open('outlet', top2, 20, {}, { x: 240, y: 50 });

  const add = (id: string, x: number, y: number, rotation = 0, patch: Partial<FurnitureItem> = {}) => {
    p.furniture.push({ ...createFurniture(CATALOG_BY_ID.get(id)!, { x, y }, rotation), ...patch });
  };
  /** Fixtures use the same ids a room scan produces, so they get the appliance models. */
  const fixture = (key: string, name: string, kind: FurnitureKind, x: number, y: number, rotation: number, w: number, d: number, h: number) => {
    p.furniture.push({ id: newId('furn'), catalogId: `scan-${key}`, name, kind, x, y, rotation, width: w, depth: d, height: h, elevation: 0, shape: 'rect', obstacle: true, color: '#d9dcdf' });
  };

  // Living room
  add('rug-8x10', 90, 62);
  add('sofa-3', 90, 21);
  add('coffee-table', 90, 66);
  add('armchair', 30, 76, 270);
  add('side-table', 150, 16);
  add('floor-lamp', 22, 14);
  add('tv-stand', 90, 169, 180);
  p.furniture.push({ id: newId('furn'), catalogId: 'scan-television', name: 'Television', kind: 'generic', x: 90, y: 171, rotation: 180, width: 48, depth: 2, height: 28, elevation: 24, shape: 'rect', obstacle: false });
  add('bookshelf', 9, 112, 270);
  add('plant-large', 196, 20);
  // Kitchenette along the south wall
  fixture('stove', 'Stove', 'appliance', 160, 164, 180, 30, 26, 36);
  fixture('refrigerator', 'Refrigerator', 'appliance', 197, 162, 180, 30, 30, 68);
  add('dining-round', 162, 104);
  add('dining-chair', 162, 74);
  add('dining-chair', 132, 104, 270);

  // Bedroom
  add('rug-6x9', 286, 80, 0);
  add('bed-queen', 286, 46);
  add('nightstand', 240, 11);
  add('nightstand', 332, 11);
  add('chest', 290, 144, 180);
  add('desk', 357, 131.5, 90, { width: 42 });
  add('office-chair', 330, 131.5, 90);

  // Bathroom
  fixture('bathtub', 'Bathtub', 'appliance', 258, 222, 180, 60, 30, 20);
  fixture('toilet', 'Toilet', 'appliance', 233, 190, 270, 18, 28, 30);
  fixture('sink', 'Sink', 'appliance', 285, 169, 0, 24, 20, 34);
  add('bath-mat', 262, 194);
  return p;
}

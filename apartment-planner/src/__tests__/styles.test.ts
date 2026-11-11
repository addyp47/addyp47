import { describe, expect, it } from 'vitest';
import { suggestRug } from '../styles/rugs';
import { PRESETS, visibleIdeas } from '../styles/presets';
import { CATALOG_BY_ID, createFurniture } from '../catalog/furniture';
import { createEmptyProject } from '../model/defaults';
import type { Project, RoomType } from '../model/types';

function withRoom(type: RoomType, w: number, h: number): Project {
  const p = createEmptyProject();
  p.rooms.push({ id: 'r', name: 'R', type, polygon: [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }] });
  return p;
}

describe('rug suggestions', () => {
  it('sizes a bedroom rug from the bed', () => {
    const p = withRoom('bedroom', 150, 140);
    p.furniture.push(createFurniture(CATALOG_BY_ID.get('bed-queen')!, { x: 75, y: 50 }));
    expect(suggestRug(p, p.rooms[0], 'front-legs')?.catalogId).toBe('rug-8x10');
    // A king wants a 9×12, but only if the room can take it
    p.furniture[0] = createFurniture(CATALOG_BY_ID.get('bed-king')!, { x: 75, y: 50 });
    expect(suggestRug(p, p.rooms[0], 'front-legs')?.catalogId).toBe('rug-8x10');
    const big = withRoom('bedroom', 180, 150);
    big.furniture.push(createFurniture(CATALOG_BY_ID.get('bed-king')!, { x: 90, y: 50 }));
    expect(suggestRug(big, big.rooms[0], 'front-legs')?.catalogId).toBe('rug-9x12');
  });

  it('scales living-room rugs with the style policy', () => {
    const p = withRoom('living', 15 * 12, 13 * 12);
    const big = suggestRug(p, p.rooms[0], 'all-legs')!.catalogId;
    const small = suggestRug(p, p.rooms[0], 'floating')!.catalogId;
    expect(big).toBe('rug-9x12');
    expect(small).toBe('rug-6x9');
  });

  it('extends a dining rug 24" past the table', () => {
    const p = withRoom('dining', 160, 140);
    p.furniture.push(createFurniture(CATALOG_BY_ID.get('dining-4')!, { x: 80, y: 70 }));
    expect(suggestRug(p, p.rooms[0], 'front-legs')?.catalogId).toBe('rug-8x10'); // needs 96×78
  });
});

describe('presets', () => {
  it('reference only real catalog items', () => {
    for (const preset of PRESETS)
      for (const room of Object.values(preset.rooms)) for (const id of room!.furniture) expect(CATALOG_BY_ID.has(id), id).toBe(true);
  });
  it('renter mode only shows renter-friendly ideas', () => {
    for (const preset of PRESETS) {
      const ideas = visibleIdeas(preset.ideas, true);
      expect(ideas.every((i) => i.renterFriendly)).toBe(true);
      expect(ideas.length).toBeGreaterThan(3);
    }
  });
});

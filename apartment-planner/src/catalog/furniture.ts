import type { FurnitureItem, FurnitureKind, Palette } from '../model/types';
import { newId } from '../model/defaults';

export interface CatalogItem {
  id: string;
  name: string;
  group: 'Living' | 'Bedroom' | 'Dining & kitchen' | 'Office' | 'Rugs' | 'Storage & decor';
  kind: FurnitureKind;
  /** Inches: width (side to side), depth (front to back), height. */
  width: number;
  depth: number;
  height: number;
  shape?: 'rect' | 'ellipse';
  elevation?: number;
  /** Shown as a hint in the library. */
  note?: string;
}

/** Typical US retail dimensions. Everything is editable once placed. */
export const CATALOG: CatalogItem[] = [
  // Living
  { id: 'sofa-3', name: 'Sofa (3-seat)', group: 'Living', kind: 'sofa', width: 84, depth: 36, height: 34 },
  { id: 'sofa-apt', name: 'Apartment sofa', group: 'Living', kind: 'sofa', width: 72, depth: 34, height: 33 },
  { id: 'loveseat', name: 'Loveseat', group: 'Living', kind: 'sofa', width: 60, depth: 35, height: 34 },
  { id: 'sectional', name: 'Sectional (rect. footprint)', group: 'Living', kind: 'sofa', width: 112, depth: 64, height: 34, note: 'Chaise side ~64" deep' },
  { id: 'armchair', name: 'Armchair', group: 'Living', kind: 'chair', width: 32, depth: 34, height: 32 },
  { id: 'accent-chair', name: 'Accent chair', group: 'Living', kind: 'chair', width: 28, depth: 30, height: 30 },
  { id: 'coffee-table', name: 'Coffee table', group: 'Living', kind: 'table', width: 48, depth: 24, height: 18 },
  { id: 'coffee-table-round', name: 'Round coffee table', group: 'Living', kind: 'table', width: 36, depth: 36, height: 17, shape: 'ellipse' },
  { id: 'side-table', name: 'Side table', group: 'Living', kind: 'table', width: 20, depth: 20, height: 24 },
  { id: 'ottoman', name: 'Ottoman / pouf', group: 'Living', kind: 'chair', width: 22, depth: 22, height: 17, shape: 'ellipse' },
  { id: 'tv-stand', name: 'TV stand / media console', group: 'Living', kind: 'storage', width: 60, depth: 16, height: 22 },

  // Bedroom
  { id: 'bed-twin', name: 'Twin bed', group: 'Bedroom', kind: 'bed', width: 42, depth: 80, height: 40, note: 'Mattress 38×75"' },
  { id: 'bed-full', name: 'Full bed', group: 'Bedroom', kind: 'bed', width: 57, depth: 80, height: 40, note: 'Mattress 54×75"' },
  { id: 'bed-queen', name: 'Queen bed', group: 'Bedroom', kind: 'bed', width: 64, depth: 86, height: 42, note: 'Mattress 60×80"' },
  { id: 'bed-king', name: 'King bed', group: 'Bedroom', kind: 'bed', width: 80, depth: 86, height: 42, note: 'Mattress 76×80"' },
  { id: 'bed-calking', name: 'California king bed', group: 'Bedroom', kind: 'bed', width: 76, depth: 90, height: 42, note: 'Mattress 72×84"' },
  { id: 'nightstand', name: 'Nightstand', group: 'Bedroom', kind: 'storage', width: 22, depth: 16, height: 24 },
  { id: 'dresser', name: 'Dresser (6-drawer)', group: 'Bedroom', kind: 'storage', width: 60, depth: 18, height: 32 },
  { id: 'chest', name: 'Tall chest', group: 'Bedroom', kind: 'storage', width: 34, depth: 18, height: 48 },
  { id: 'wardrobe', name: 'Wardrobe', group: 'Bedroom', kind: 'storage', width: 40, depth: 24, height: 72 },
  { id: 'clothes-rack', name: 'Clothing rack', group: 'Bedroom', kind: 'storage', width: 48, depth: 18, height: 64 },

  // Dining & kitchen
  { id: 'dining-4', name: 'Dining table (4)', group: 'Dining & kitchen', kind: 'table', width: 48, depth: 30, height: 30 },
  { id: 'dining-6', name: 'Dining table (6)', group: 'Dining & kitchen', kind: 'table', width: 72, depth: 36, height: 30 },
  { id: 'dining-round', name: 'Round dining table', group: 'Dining & kitchen', kind: 'table', width: 42, depth: 42, height: 30, shape: 'ellipse' },
  { id: 'dining-chair', name: 'Dining chair', group: 'Dining & kitchen', kind: 'chair', width: 18, depth: 21, height: 34 },
  { id: 'bench', name: 'Bench', group: 'Dining & kitchen', kind: 'chair', width: 48, depth: 15, height: 18 },
  { id: 'bar-stool', name: 'Counter stool', group: 'Dining & kitchen', kind: 'chair', width: 16, depth: 16, height: 26, shape: 'ellipse' },
  { id: 'kitchen-cart', name: 'Kitchen cart / island', group: 'Dining & kitchen', kind: 'table', width: 36, depth: 20, height: 36 },
  { id: 'bar-cart', name: 'Bar cart', group: 'Dining & kitchen', kind: 'storage', width: 30, depth: 16, height: 32 },

  // Office
  { id: 'desk', name: 'Desk', group: 'Office', kind: 'desk', width: 48, depth: 24, height: 30 },
  { id: 'desk-large', name: 'Large desk', group: 'Office', kind: 'desk', width: 60, depth: 30, height: 30 },
  { id: 'office-chair', name: 'Office chair', group: 'Office', kind: 'chair', width: 26, depth: 26, height: 40, shape: 'ellipse' },
  { id: 'bookshelf', name: 'Bookshelf', group: 'Office', kind: 'storage', width: 32, depth: 12, height: 72 },
  { id: 'cube-shelf', name: 'Cube shelf (2×2)', group: 'Office', kind: 'storage', width: 30, depth: 15, height: 30 },
  { id: 'filing', name: 'File cabinet', group: 'Office', kind: 'storage', width: 16, depth: 20, height: 28 },

  // Rugs
  { id: 'rug-4x6', name: "Rug 4'×6'", group: 'Rugs', kind: 'rug', width: 72, depth: 48, height: 0.5 },
  { id: 'rug-5x8', name: "Rug 5'×8'", group: 'Rugs', kind: 'rug', width: 96, depth: 60, height: 0.5 },
  { id: 'rug-6x9', name: "Rug 6'×9'", group: 'Rugs', kind: 'rug', width: 108, depth: 72, height: 0.5 },
  { id: 'rug-8x10', name: "Rug 8'×10'", group: 'Rugs', kind: 'rug', width: 120, depth: 96, height: 0.5 },
  { id: 'rug-9x12', name: "Rug 9'×12'", group: 'Rugs', kind: 'rug', width: 144, depth: 108, height: 0.5 },
  { id: 'rug-round-6', name: "Round rug 6'", group: 'Rugs', kind: 'rug', width: 72, depth: 72, height: 0.5, shape: 'ellipse' },
  { id: 'rug-round-8', name: "Round rug 8'", group: 'Rugs', kind: 'rug', width: 96, depth: 96, height: 0.5, shape: 'ellipse' },
  { id: 'runner', name: "Runner 2.5'×8'", group: 'Rugs', kind: 'rug', width: 96, depth: 30, height: 0.5 },
  { id: 'bath-mat', name: "Bath mat 2'×3'", group: 'Rugs', kind: 'rug', width: 36, depth: 24, height: 0.5 },

  // Storage & decor
  { id: 'console', name: 'Console table', group: 'Storage & decor', kind: 'table', width: 48, depth: 14, height: 30 },
  { id: 'sideboard', name: 'Sideboard / credenza', group: 'Storage & decor', kind: 'storage', width: 64, depth: 18, height: 30 },
  { id: 'shoe-rack', name: 'Shoe cabinet', group: 'Storage & decor', kind: 'storage', width: 32, depth: 10, height: 40 },
  { id: 'ladder-shelf', name: 'Ladder shelf', group: 'Storage & decor', kind: 'storage', width: 24, depth: 16, height: 70 },
  { id: 'floor-lamp', name: 'Floor lamp', group: 'Storage & decor', kind: 'lamp', width: 14, depth: 14, height: 64, shape: 'ellipse' },
  { id: 'arc-lamp', name: 'Arc lamp (base)', group: 'Storage & decor', kind: 'lamp', width: 16, depth: 16, height: 80, shape: 'ellipse' },
  { id: 'plant-large', name: 'Floor plant', group: 'Storage & decor', kind: 'plant', width: 22, depth: 22, height: 60, shape: 'ellipse' },
  { id: 'plant-small', name: 'Small plant', group: 'Storage & decor', kind: 'plant', width: 12, depth: 12, height: 24, shape: 'ellipse' },
  { id: 'mirror', name: 'Floor mirror', group: 'Storage & decor', kind: 'generic', width: 24, depth: 4, height: 65 },
  { id: 'room-divider', name: 'Folding room divider', group: 'Storage & decor', kind: 'generic', width: 70, depth: 2, height: 70 },
];

export const CATALOG_BY_ID = new Map(CATALOG.map((c) => [c.id, c]));

/** Small or easily-moved pieces don't trigger walkway warnings (chairs pull out, lamps tuck in). */
export const CLEARANCE_EXEMPT_KINDS: FurnitureKind[] = ['rug', 'chair', 'lamp', 'plant'];
export const CLEARANCE_EXEMPT_IDS = new Set(['side-table', 'nightstand', 'mirror', 'room-divider', 'filing']);

export function createFurniture(c: CatalogItem, at: { x: number; y: number }, rotation = 0): FurnitureItem {
  return {
    id: newId('furn'),
    catalogId: c.id,
    name: c.name,
    kind: c.kind,
    x: Math.round(at.x),
    y: Math.round(at.y),
    rotation,
    width: c.width,
    depth: c.depth,
    height: c.height,
    elevation: c.elevation ?? 0,
    shape: c.shape ?? 'rect',
    obstacle: c.kind !== 'rug',
  };
}

export function furnitureColor(f: FurnitureItem, palette: Palette): string {
  if (f.color) return f.color;
  switch (f.kind) {
    case 'sofa':
      return palette.textile;
    case 'chair':
      return palette.accents[1] ?? palette.textile;
    case 'bed':
      return palette.textile;
    case 'rug':
      return palette.accents[0] ?? '#c9b79c';
    case 'lamp':
      return palette.accents[2] ?? '#a65e46';
    case 'plant':
      return '#6f8f5e';
    case 'appliance':
      return '#d9dcdf';
    default:
      return palette.wood;
  }
}

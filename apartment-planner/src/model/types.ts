/**
 * Core plan data model. All lengths are in INCHES; plan x → right, y → down.
 * Kept free of React so a future three.js view / importers can share it.
 */

export type Id = string;

export interface Vec2 {
  x: number;
  y: number;
}

export const SCHEMA_VERSION = 1;

export type RoomType =
  | 'living'
  | 'bedroom'
  | 'kitchen'
  | 'dining'
  | 'office'
  | 'bathroom'
  | 'entry'
  | 'other';

export interface Room {
  id: Id;
  name: string;
  type: RoomType;
  /** Closed polygon, world inches. */
  polygon: Vec2[];
  /** Overrides the style palette floor color when set. */
  floorColor?: string;
}

export interface Wall {
  id: Id;
  a: Vec2;
  b: Vec2;
  thickness: number;
  /** For future 3D extrusion. */
  height: number;
}

/** 'opening' is a doorless pass-through (cased opening / archway). */
export type OpeningKind = 'door' | 'window' | 'outlet' | 'opening';

export interface Opening {
  id: Id;
  kind: OpeningKind;
  wallId: Id;
  /** Center position along the wall, 0 = wall.a, 1 = wall.b. */
  t: number;
  /** Width along the wall. */
  width: number;
  /** Doors: which end of the opening holds the hinge. */
  hinge: 'start' | 'end';
  /** Doors: which side of the wall the leaf swings into (+1 = left of a→b). */
  side: 1 | -1;
  /** Bottom of opening above floor (3D). */
  sillHeight: number;
  /** Top of opening above floor (3D). */
  headHeight: number;
}

export interface BackgroundImage {
  dataUrl: string;
  naturalWidth: number;
  naturalHeight: number;
  /** World position of the image's top-left corner. */
  x: number;
  y: number;
  inchesPerPixel: number;
  opacity: number;
  visible: boolean;
  locked: boolean;
}

export type FurnitureKind =
  | 'sofa'
  | 'chair'
  | 'bed'
  | 'table'
  | 'desk'
  | 'storage'
  | 'rug'
  | 'lamp'
  | 'plant'
  | 'appliance'
  | 'generic';

export interface FurnitureItem {
  id: Id;
  catalogId: string;
  name: string;
  kind: FurnitureKind;
  /** Center, world inches. */
  x: number;
  y: number;
  /** Degrees, clockwise on screen. */
  rotation: number;
  width: number;
  depth: number;
  height: number;
  /** Height above floor of the bottom (shelves, wall-mounted, 3D). */
  elevation: number;
  shape: 'rect' | 'ellipse';
  /** Overrides palette-derived color. */
  color?: string;
  /** Takes up floor space for walkway checks (rugs: false). */
  obstacle: boolean;
}

export interface Palette {
  walls: string;
  floor: string;
  wood: string;
  textile: string;
  accents: string[];
}

export interface StyleSettings {
  presetId: string | null;
  palette: Palette;
  renterMode: boolean;
}

export interface Project {
  version: number;
  id: Id;
  name: string;
  createdAt: number;
  updatedAt: number;
  ceilingHeight: number;
  background: BackgroundImage | null;
  rooms: Room[];
  walls: Wall[];
  openings: Opening[];
  furniture: FurnitureItem[];
  style: StyleSettings;
  source: { kind: 'manual' | 'json' | 'roomplan' };
}

export type SelectionKind = 'furniture' | 'wall' | 'opening' | 'room';

export interface Selection {
  kind: SelectionKind;
  id: Id;
}

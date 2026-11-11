import type { FurnitureItem, Project, Room } from '../model/types';
import type { RugPolicy } from './presets';
import { CATALOG_BY_ID } from '../catalog/furniture';
import { largestInscribedRect, pointInPolygon } from '../geometry/polygon';
import { formatFtIn } from '../geometry/units';

/** Standard rectangular rug sizes, long side first (inches). */
export const STANDARD_RUGS = [
  { catalogId: 'rug-4x6', long: 72, short: 48, label: "4'×6'" },
  { catalogId: 'rug-5x8', long: 96, short: 60, label: "5'×8'" },
  { catalogId: 'rug-6x9', long: 108, short: 72, label: "6'×9'" },
  { catalogId: 'rug-8x10', long: 120, short: 96, label: "8'×10'" },
  { catalogId: 'rug-9x12', long: 144, short: 108, label: "9'×12'" },
];

export interface RugPlacement {
  x: number;
  y: number;
  rotation: number;
}

export interface RugSuggestion {
  catalogId: string;
  label: string;
  reason: string;
  placement: RugPlacement;
  secondary?: { catalogId: string; label: string; reason: string };
}

const WALL_ALLOWANCE = 5; // rough wall thickness: polygons are traced on wall centerlines or faces

/** Usable rectangle of a room (largest inscribed rectangle, minus walls). */
export function roomInterior(room: Room) {
  const b = largestInscribedRect(room.polygon)!;
  const w = Math.max(0, b.maxX - b.minX - WALL_ALLOWANCE);
  const h = Math.max(0, b.maxY - b.minY - WALL_ALLOWANCE);
  const center = { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
  const pad = WALL_ALLOWANCE / 2;
  const rect = { minX: b.minX + pad, minY: b.minY + pad, maxX: b.maxX - pad, maxY: b.maxY - pad };
  return { width: w, depth: h, long: Math.max(w, h), short: Math.min(w, h), horizontal: w >= h, center, rect };
}

/** Nudge a rug so its footprint stays inside the room's usable rectangle. */
function clampInto(p: RugPlacement, catalogId: string, rect: { minX: number; minY: number; maxX: number; maxY: number }): RugPlacement {
  const c = CATALOG_BY_ID.get(catalogId);
  if (!c) return p;
  const r = (p.rotation * Math.PI) / 180;
  const ex = (Math.abs(Math.cos(r)) * c.width + Math.abs(Math.sin(r)) * c.depth) / 2;
  const ey = (Math.abs(Math.sin(r)) * c.width + Math.abs(Math.cos(r)) * c.depth) / 2;
  const clamp = (v: number, lo: number, hi: number) => (lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v)));
  return { ...p, x: clamp(p.x, rect.minX + ex, rect.maxX - ex), y: clamp(p.y, rect.minY + ey, rect.maxY - ey) };
}

export function furnitureInRoom(project: Project, room: Room): FurnitureItem[] {
  return project.furniture.filter((f) => pointInPolygon({ x: f.x, y: f.y }, room.polygon));
}

function largestFitting(long: number, short: number, border: number, maxIndex = STANDARD_RUGS.length - 1) {
  for (let i = maxIndex; i >= 0; i--) {
    const r = STANDARD_RUGS[i];
    if (r.long <= long - 2 * border && r.short <= short - 2 * border) return r;
  }
  return null;
}

function smallestCovering(needLong: number, needShort: number) {
  return STANDARD_RUGS.find((r) => r.long >= needLong && r.short >= needShort) ?? null;
}

/** Suggest a rug size for a room from its dimensions, its furniture, and the style's rug policy. */
export function suggestRug(project: Project, room: Room, policy: RugPolicy): RugSuggestion | null {
  const s = suggestRugRaw(project, room, policy);
  if (!s) return null;
  return { ...s, placement: clampInto(s.placement, s.catalogId, roomInterior(room).rect) };
}

function suggestRugRaw(project: Project, room: Room, policy: RugPolicy): RugSuggestion | null {
  const dims = roomInterior(room);
  if (dims.short < 24) return null;
  const c = dims.center;
  const centered: RugPlacement = { x: c.x, y: c.y, rotation: dims.horizontal ? 0 : 90 };
  const inRoom = furnitureInRoom(project, room);
  const roomSize = `${formatFtIn(dims.width)} × ${formatFtIn(dims.depth)}`;

  switch (room.type) {
    case 'bedroom': {
      const bed = inRoom.find((f) => f.kind === 'bed');
      const bedW = bed?.width ?? 64;
      const r = smallestCovering(bedW + 48, 0) ?? STANDARD_RUGS[STANDARD_RUGS.length - 1];
      const usable = r.long <= dims.long - 12 ? r : largestFitting(dims.long, dims.short, 6);
      if (!usable) return runner(centered, 'Room is too tight for an area rug. Use a runner beside the bed.');
      // Center under the lower two-thirds of the bed, long side across the bed.
      const placement = bed ? lowerTwoThirds(bed) : centered;
      return {
        catalogId: usable.catalogId,
        label: usable.label,
        reason: `${bed ? bed.name : 'A queen bed'} is ${formatFtIn(bedW)} wide. A ${usable.label} rug run sideways under the lower ⅔ shows about ${formatFtIn((usable.long - bedW) / 2)} on each side.`,
        placement,
        secondary: policy === 'layered' ? { catalogId: 'rug-round-6', label: "Round 6'", reason: 'Layer a sheepskin or round rug at one corner.' } : undefined,
      };
    }
    case 'dining': {
      const table = inRoom.find((f) => f.kind === 'table' && f.height >= 26);
      const tw = table ? Math.max(table.width, table.depth) : 48;
      const td = table ? Math.min(table.width, table.depth) : 30;
      // 24" beyond the table on every side so chair legs stay on the rug when pulled out.
      const round = table?.shape === 'ellipse';
      if (round) {
        const need = tw + 48;
        const id = need <= 72 ? 'rug-round-6' : 'rug-round-8';
        return {
          catalogId: id,
          label: need <= 72 ? "Round 6'" : "Round 8'",
          reason: `Round table: the rug should be about ${formatFtIn(need)} across so chairs stay on it.`,
          placement: { x: table!.x, y: table!.y, rotation: 0 },
        };
      }
      const r = smallestCovering(tw + 48, td + 48);
      const fits = r && r.long <= dims.long && r.short <= dims.short;
      const pick = fits ? r! : largestFitting(dims.long, dims.short, 6);
      if (!pick) return null;
      return {
        catalogId: pick.catalogId,
        label: pick.label,
        reason: fits
          ? `Table + 24" on all sides (${formatFtIn(tw + 48)} × ${formatFtIn(td + 48)}) so chairs stay on the rug when pulled out.`
          : `Ideally the rug would be table + 24" on all sides, but ${roomSize} can only fit a ${pick.label}.`,
        placement: table ? { x: table.x, y: table.y, rotation: table.width >= table.depth ? table.rotation : table.rotation + 90 } : centered,
      };
    }
    case 'office': {
      const pick = largestFitting(dims.long, dims.short, 18, 1);
      if (!pick) return runner(centered, 'A runner or chair mat fits better here.');
      const desk = inRoom.find((f) => f.kind === 'desk');
      return {
        catalogId: pick.catalogId,
        label: pick.label,
        reason: `Big enough that the desk chair stays on the rug as it rolls back.`,
        placement: desk ? { x: desk.x, y: desk.y, rotation: desk.rotation } : centered,
      };
    }
    case 'kitchen':
    case 'entry':
      return runner(centered, room.type === 'kitchen' ? 'A runner in front of the counters (washable or flat-weave).' : 'A runner guides the eye through the entry and catches grit.');
    case 'bathroom':
      return { catalogId: 'bath-mat', label: "2'×3' bath mat", reason: 'In front of the tub or shower, quick-dry cotton or teak.', placement: centered };
    default: {
      // living + other: depends on style policy
      const borders: Record<RugPolicy, number> = { 'all-legs': 12, 'front-legs': 18, floating: 24, layered: 12 };
      const caps: Record<RugPolicy, number> = { 'all-legs': 4, 'front-legs': 3, floating: 2, layered: 4 };
      const pick = largestFitting(dims.long, dims.short, borders[policy], caps[policy]) ?? largestFitting(dims.long, dims.short, 6);
      if (!pick) return null;
      const why: Record<RugPolicy, string> = {
        'all-legs': 'Large enough for every piece in the seating group to sit fully on it',
        'front-legs': 'Front legs of the sofa and chairs rest on it, which ties the group together',
        floating: 'Smaller, so more floor shows and the room feels open and calm',
        layered: 'A big base rug to layer a smaller patterned one on top',
      };
      const sofa = inRoom.find((f) => f.kind === 'sofa');
      return {
        catalogId: pick.catalogId,
        label: pick.label,
        reason: `${why[policy]}. Leaves about ${formatFtIn(Math.min(dims.long - pick.long, dims.short - pick.short) / 2)} of floor at the edges of this ${roomSize} room.`,
        placement: sofa ? inFrontOf(sofa, pick.short, policy) : centered,
        secondary: policy === 'layered' ? { catalogId: 'rug-5x8', label: "5'×8'", reason: 'Layer a vintage or patterned 5×8 on top, offset slightly.' } : undefined,
      };
    }
  }
}

function runner(placement: RugPlacement, reason: string): RugSuggestion {
  return { catalogId: 'runner', label: "2.5'×8' runner", reason, placement };
}

/** Rug center under the lower 2/3 of a bed (bed back is local -y). */
function lowerTwoThirds(bed: FurnitureItem): RugPlacement {
  const shift = bed.depth / 6;
  const r = (bed.rotation * Math.PI) / 180;
  // local +y is toward the foot of the bed
  return { x: bed.x - Math.sin(r) * shift, y: bed.y + Math.cos(r) * shift, rotation: bed.rotation };
}

/** Rug centered in front of a sofa (sofa back is local -y). */
function inFrontOf(sofa: FurnitureItem, rugShort: number, policy: RugPolicy): RugPlacement {
  const tuck = policy === 'all-legs' || policy === 'layered' ? sofa.depth : policy === 'front-legs' ? 10 : -6;
  const shift = sofa.depth / 2 - tuck + rugShort / 2;
  const r = (sofa.rotation * Math.PI) / 180;
  return { x: sofa.x - Math.sin(r) * shift, y: sofa.y + Math.cos(r) * shift, rotation: sofa.rotation };
}

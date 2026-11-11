import type { ScanBox, ScanData } from './scan';

/**
 * Reader for Apple's CapturedRoom encoded as JSON (RoomPlan's `CapturedRoom`
 * is Codable, and scanning apps that offer a "JSON" export write this shape):
 *
 *   { walls: [{ category, dimensions: [w, h, d], transform: [16 floats, column-major],
 *               identifier, parentIdentifier, ... }], doors, windows, openings, objects }
 */

type Raw = Record<string, unknown>;

export function isCapturedRoom(data: unknown): boolean {
  const d = data as Raw | null;
  if (!d || typeof d !== 'object' || !Array.isArray(d.walls)) return false;
  const first = (d.walls as Raw[])[0];
  return d.walls.length === 0 ? Array.isArray(d.objects) && Array.isArray(d.doors) : !!first && 'transform' in first && 'dimensions' in first;
}

function numbers(v: unknown): number[] {
  if (Array.isArray(v)) return v.flatMap((x) => numbers(x));
  if (typeof v === 'number') return [v];
  if (v && typeof v === 'object') {
    // { x, y, z } or { columns: [...] } style encodings
    const o = v as Raw;
    if ('x' in o) return [o.x, o.y, o.z, o.w].filter((n): n is number => typeof n === 'number');
    return Object.values(o).flatMap((x) => numbers(x));
  }
  return [];
}

/** Category is a Swift enum: either "wall" or { "door": { "isOpen": false } }. */
function categoryName(v: unknown): string {
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object') return Object.keys(v as Raw)[0] ?? '';
  return '';
}

function toBox(raw: Raw): ScanBox | null {
  const t = numbers(raw.transform);
  const d = numbers(raw.dimensions);
  if (t.length < 16 || d.length < 2) return null;
  // Column-major 4×4: column 0 is the local x axis, column 3 the position.
  const ax = { x: t[0], z: t[2] };
  const len = Math.hypot(ax.x, ax.z) || 1;
  return {
    category: categoryName(raw.category),
    id: typeof raw.identifier === 'string' ? raw.identifier : undefined,
    parentId: typeof raw.parentIdentifier === 'string' ? raw.parentIdentifier : undefined,
    center: { x: t[12], y: t[13], z: t[14] },
    axis: { x: ax.x / len, z: ax.z / len },
    width: Math.abs(d[0]),
    height: Math.abs(d[1]),
    depth: Math.abs(d[2] ?? 0),
  };
}

export function capturedRoomToScan(data: unknown): ScanData {
  const d = data as Raw;
  const list = (k: string) => (Array.isArray(d[k]) ? (d[k] as Raw[]).map(toBox).filter((b): b is ScanBox => !!b) : []);
  return { walls: list('walls'), doors: list('doors'), windows: list('windows'), openings: list('openings'), objects: list('objects') };
}

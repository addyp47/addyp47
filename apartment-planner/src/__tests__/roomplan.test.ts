import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { capturedRoomToScan, isCapturedRoom } from '../importers/roomplan/capturedRoom';
import { deriveRooms, scanToProject } from '../importers/roomplan/scan';
import { footprint, usdzToScan } from '../importers/roomplan/usdz';
import { jsonImporter } from '../importers/json';
import { wallLength } from '../geometry/plan';
import { polygonArea } from '../geometry/polygon';
import { createWall } from '../model/defaults';

const IN = 39.3701;

/** Column-major transform: yaw about +y (three.js / ARKit convention), then translate. */
function xf(x: number, y: number, z: number, yawDeg: number): number[] {
  const r = (yawDeg * Math.PI) / 180;
  const c = Math.cos(r), s = Math.sin(r);
  return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, x, y, z, 1];
}

/** A 4.0 m × 3.2 m room, 2.5 m ceiling, floor at y = -1.1 (ARKit origin is the phone, not the floor). */
function capturedRoom() {
  const FY = -1.1;
  const wall = (id: string, x: number, z: number, yaw: number, w: number) => ({
    identifier: id, parentIdentifier: null, category: { wall: {} }, confidence: { high: {} },
    dimensions: [w, 2.5, 0], transform: xf(x, FY + 1.25, z, yaw),
  });
  return {
    version: 2,
    story: 0,
    walls: [wall('W0', 0, -1.6, 0, 4), wall('W1', 2, 0, 90, 3.2), wall('W2', 0, 1.6, 180, 4), wall('W3', -2, 0, 270, 3.2)],
    doors: [{ identifier: 'D0', parentIdentifier: 'W0', category: { door: { isOpen: false } }, dimensions: [0.8, 2.0, 0], transform: xf(-1.2, FY + 1.0, -1.6, 0) }],
    windows: [{ identifier: 'N0', parentIdentifier: 'W2', category: { window: {} }, dimensions: [1.2, 1.0, 0], transform: xf(0.5, FY + 1.5, 1.6, 180) }],
    openings: [],
    objects: [
      { identifier: 'O0', parentIdentifier: null, category: { bed: {} }, dimensions: [1.6, 0.6, 2.0], transform: xf(1.2, FY + 0.3, 0.2, 90) },
      { identifier: 'O1', parentIdentifier: null, category: { television: {} }, dimensions: [1.0, 0.6, 0.05], transform: xf(-1.95, FY + 1.4, 0, 90) },
    ],
  };
}

describe('RoomPlan CapturedRoom JSON', () => {
  it('is detected and converted with real dimensions', () => {
    const data = capturedRoom();
    expect(isCapturedRoom(data)).toBe(true);
    expect(isCapturedRoom({ version: 1, walls: [{ a: {}, b: {} }] })).toBe(false);
    const p = scanToProject(capturedRoomToScan(data), 'Scan');

    expect(p.walls).toHaveLength(4);
    const lengths = p.walls.map((w) => wallLength(w)).sort((a, b) => a - b);
    expect(lengths[0]).toBeCloseTo(3.2 * IN, 0);
    expect(lengths[3]).toBeCloseTo(4 * IN, 0);
    expect(p.walls[0].height).toBeCloseTo(2.5 * IN, 0);
    expect(p.ceilingHeight).toBe(98);

    // One closed room with the right floor area
    expect(p.rooms).toHaveLength(1);
    expect(polygonArea(p.rooms[0].polygon)).toBeCloseTo(4 * IN * 3.2 * IN, -2);
    expect(p.rooms[0].type).toBe('bedroom');

    const door = p.openings.find((o) => o.kind === 'door')!;
    expect(door.width).toBeCloseTo(0.8 * IN, 0);
    expect(door.sillHeight).toBe(0);
    expect(door.headHeight).toBeCloseTo(2.0 * IN, 0);
    const doorWall = p.walls.find((w) => w.id === door.wallId)!;
    expect(wallLength(doorWall)).toBeCloseTo(4 * IN, 0);
    expect(Math.min(door.t, 1 - door.t)).toBeCloseTo(0.2, 1); // 0.8 m from one end of a 4 m wall

    const win = p.openings.find((o) => o.kind === 'window')!;
    expect(win.sillHeight).toBeCloseTo(1.0 * IN, 0);
    expect(win.headHeight).toBeCloseTo(2.0 * IN, 0);

    const bed = p.furniture.find((f) => f.kind === 'bed')!;
    expect([bed.width, bed.depth, bed.height]).toEqual([63, 78.5, 23.5]);
    expect(bed.elevation).toBe(0);
    expect(bed.rotation % 180).toBeCloseTo(90, 0);
    // Bed center is 0.8 m from the wall it backs onto → inside the room
    expect(bed.x).toBeGreaterThan(0);
    expect(bed.x).toBeLessThan(4 * IN);

    const tv = p.furniture.find((f) => f.name === 'Television')!;
    expect(tv.elevation).toBeGreaterThan(40);
    expect(tv.obstacle).toBe(false);
  });

  it('imports through the JSON importer', async () => {
    const file = { name: 'bedroom.json', type: 'application/json', text: async () => JSON.stringify(capturedRoom()) } as unknown as File;
    const p = await jsonImporter.import(file);
    expect(p.source.kind).toBe('roomplan');
    expect(p.name).toBe('bedroom');
  });
});

describe('RoomPlan USDZ', () => {
  it('reads boxes from a binary USDZ (synthetic fixture, room rotated 20°)', async () => {
    const buf = readFileSync(fileURLToPath(new URL('./fixtures/roomplan-synthetic.usdz', import.meta.url)));
    const scan = await usdzToScan(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
    expect([scan.walls.length, scan.doors.length, scan.windows.length, scan.objects.length]).toEqual([4, 1, 1, 2]);
    const p = scanToProject(scan, 'Scan');
    const lengths = p.walls.map((w) => wallLength(w)).sort((a, b) => a - b);
    expect(lengths[0]).toBeCloseTo(3.2 * IN, 0);
    expect(lengths[3]).toBeCloseTo(4 * IN, 0);
    // Squared up: every wall is horizontal or vertical
    for (const w of p.walls) expect(Math.min(Math.abs(w.a.x - w.b.x), Math.abs(w.a.y - w.b.y))).toBeLessThan(0.6);
    expect(p.rooms).toHaveLength(1);
    const bed = p.furniture.find((f) => f.kind === 'bed')!;
    expect(bed.width).toBeCloseTo(1.6 * IN, 0);
    expect(bed.depth).toBeCloseTo(2.0 * IN, 0);
    expect(bed.height).toBeCloseTo(0.6 * IN, 0);
    const storage = p.furniture.find((f) => f.kind === 'storage')!;
    expect(storage.height).toBeCloseTo(0.9 * IN, 0);
    const door = p.openings.find((o) => o.kind === 'door')!;
    expect(door.width).toBeCloseTo(0.8 * IN, 0);
  });
});

describe('scan helpers', () => {
  it('finds the tight footprint of a rotated box', () => {
    const r = (30 * Math.PI) / 180;
    const pts = [[-1, -0.5], [1, -0.5], [1, 0.5], [-1, 0.5]].map(([x, y]) => ({ x: x * Math.cos(r) - y * Math.sin(r), y: x * Math.sin(r) + y * Math.cos(r) }));
    const f = footprint(pts, null);
    expect([f.width, f.depth].sort()).toEqual([expect.closeTo(1, 5), expect.closeTo(2, 5)]);
  });
  it('falls back to one outline when walls do not form simple loops', () => {
    const walls = [createWall({ x: 0, y: 0 }, { x: 100, y: 0 }), createWall({ x: 100, y: 0 }, { x: 100, y: 80 }), createWall({ x: 50, y: 0 }, { x: 50, y: 80 })];
    const rooms = deriveRooms(walls);
    expect(rooms).toHaveLength(1);
    expect(rooms[0].name).toBe('Scanned area');
  });
});

describe('scanned doors', () => {
  it('swing into the room by default', async () => {
    const { doorGeometry } = await import('../geometry/plan');
    const { pointInPolygon } = await import('../geometry/polygon');
    const p = scanToProject(capturedRoomToScan(capturedRoom()), 'Scan');
    const door = p.openings.find((o) => o.kind === 'door')!;
    const g = doorGeometry(door, p.walls.find((w) => w.id === door.wallId)!);
    expect(pointInPolygon(g.open, p.rooms[0].polygon)).toBe(true);
  });
});

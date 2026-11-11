import type { PlanImporter } from '../types';
import { convexHull, scanToProject, type ScanBox, type ScanData } from './scan';

/**
 * Reader for the USDZ that RoomPlan exports (CapturedRoom.export, "parametric"
 * mode): one box mesh per wall, door, window, and object, named by category
 * (Wall0, Door0, Window1, Sofa0, Storage2, ...). We read each box's measured
 * footprint and height from its vertices, so it works however the file stores
 * transforms.
 */

const ARCH = /^(wall|door|window|opening|floor)/i;
const OBJECTS = /^(storage|refrigerator|stove|bed|sink|washerdryer|toilet|bathtub|oven|dishwasher|table|sofa|chair|fireplace|television|stairs)/i;

interface P2 {
  x: number;
  y: number;
}

/** Oriented footprint of a set of floor-plane points. Prefers `hint` (the mesh's own x axis) when it fits as tightly as the best rectangle. */
export function footprint(points: P2[], hint: P2 | null): { center: P2; axis: P2; width: number; depth: number } {
  const extent = (u: P2) => {
    const v = { x: -u.y, y: u.x };
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const p of points) {
      const a = p.x * u.x + p.y * u.y;
      const b = p.x * v.x + p.y * v.y;
      u0 = Math.min(u0, a); u1 = Math.max(u1, a); v0 = Math.min(v0, b); v1 = Math.max(v1, b);
    }
    const cu = (u0 + u1) / 2;
    const cv = (v0 + v1) / 2;
    return { center: { x: u.x * cu + v.x * cv, y: u.y * cu + v.y * cv }, axis: u, width: u1 - u0, depth: v1 - v0 };
  };
  const hull = convexHull(points);
  let best: ReturnType<typeof extent> | null = null;
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i];
    const b = hull[(i + 1) % hull.length];
    const l = Math.hypot(b.x - a.x, b.y - a.y);
    if (l < 1e-6) continue;
    const e = extent({ x: (b.x - a.x) / l, y: (b.y - a.y) / l });
    if (!best || e.width * e.depth < best.width * best.depth - 1e-9) best = e;
  }
  if (!best) best = extent({ x: 1, y: 0 });
  if (hint) {
    const l = Math.hypot(hint.x, hint.y);
    if (l > 1e-6) {
      const h = extent({ x: hint.x / l, y: hint.y / l });
      if (h.width * h.depth <= best.width * best.depth * 1.03 + 1e-6) return h;
    }
  }
  return best;
}

export async function usdzToScan(buffer: ArrayBuffer): Promise<ScanData> {
  const [THREE, { USDLoader }] = await Promise.all([import('three'), import('three/examples/jsm/loaders/USDLoader.js')]);
  let root: import('three').Object3D;
  try {
    root = new USDLoader().parse(buffer);
  } catch {
    throw new Error('Could not read that USDZ file.');
  }
  root.updateMatrixWorld(true);
  const scan: ScanData = { walls: [], doors: [], windows: [], openings: [], objects: [] };
  const v = new THREE.Vector3();

  root.traverse((o) => {
    const mesh = o as import('three').Mesh;
    if (!mesh.isMesh || !mesh.geometry?.attributes.position) return;
    // Use the mesh's own name, or the nearest named ancestor (some exporters name only the group).
    let name = '';
    for (let n: import('three').Object3D | null = mesh; n && !name; n = n.parent) {
      const clean = n.name.replace(/_grp$/i, '').replace(/_/g, '');
      if (ARCH.test(clean) || OBJECTS.test(clean)) name = clean;
    }
    if (!name) return;
    const category = name.replace(/\d+$/, '').toLowerCase();
    if (category === 'floor') return;

    const pos = mesh.geometry.attributes.position;
    const pts: P2[] = [];
    let y0 = Infinity;
    let y1 = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
      pts.push({ x: v.x, y: v.z });
      y0 = Math.min(y0, v.y);
      y1 = Math.max(y1, v.y);
    }
    if (pts.length < 2) return;
    const e = mesh.matrixWorld.elements;
    const isArch = ARCH.test(category);
    let f = footprint(pts, { x: e[0], y: e[2] });
    // Walls, doors, and windows: width is always the long side.
    if (isArch && f.depth > f.width) f = { center: f.center, axis: { x: -f.axis.y, y: f.axis.x }, width: f.depth, depth: f.width };
    const box: ScanBox = {
      category,
      center: { x: f.center.x, y: (y0 + y1) / 2, z: f.center.y },
      axis: { x: f.axis.x, z: f.axis.y },
      width: f.width,
      height: y1 - y0,
      depth: f.depth,
    };
    if (category === 'wall') scan.walls.push(box);
    else if (category === 'door') scan.doors.push(box);
    else if (category === 'window') scan.windows.push(box);
    else if (category === 'opening') scan.openings.push(box);
    else scan.objects.push(box);
  });
  return scan;
}

export const roomplanUsdzImporter: PlanImporter = {
  id: 'roomplan-usdz',
  label: 'RoomPlan scan (USDZ)',
  accept: '.usdz,model/vnd.usdz+zip',
  canImport: (file) => file.name.toLowerCase().endsWith('.usdz'),
  async import(file) {
    const scan = await usdzToScan(await file.arrayBuffer());
    if (scan.walls.length === 0) {
      throw new Error("No walls found. This USDZ doesn't look like a RoomPlan room scan (a plain 3D mesh scan can't be imported).");
    }
    return scanToProject(scan, file.name.replace(/\.usdz$/i, '') || 'Scanned apartment');
  },
};

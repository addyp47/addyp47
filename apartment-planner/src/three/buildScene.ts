import * as THREE from 'three';
import type { FurnitureItem, Opening, Project, Wall } from '../model/types';
import { doorGeometry, wallLength } from '../geometry/plan';
import { furnitureColor } from '../catalog/furniture';

/**
 * Builds three.js objects from the plan model. World units are inches;
 * plan (x, y) maps to three (x, z) and height is +y.
 */

const WALL_EDGE = 0x2b2e33;

function disposeObject(obj: THREE.Object3D) {
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    m.geometry?.dispose?.();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
    else mat?.dispose?.();
  });
}

export function clearGroup(group: THREE.Group) {
  for (const child of [...group.children]) {
    group.remove(child);
    disposeObject(child);
  }
}

interface WallPiece {
  s: number;
  e: number;
  y0: number;
  y1: number;
}

/** Split a wall into solid boxes around its doors, windows, and open doorways. */
export function wallPieces(wall: Wall, openings: Opening[]): WallPiece[] {
  const L = wallLength(wall);
  const half = wall.thickness / 2;
  const H = wall.height;
  const cuts = openings
    .filter((o) => o.wallId === wall.id && o.kind !== 'outlet')
    .map((o) => ({
      s: Math.max(0, o.t * L - o.width / 2),
      e: Math.min(L, o.t * L + o.width / 2),
      sill: Math.max(0, Math.min(H, o.sillHeight)),
      head: Math.max(0, Math.min(H, o.headHeight)),
    }))
    .filter((c) => c.e > c.s)
    .sort((a, b) => a.s - b.s);

  const pieces: WallPiece[] = [];
  let cursor = -half;
  for (const c of cuts) {
    if (c.s > cursor) pieces.push({ s: cursor, e: c.s, y0: 0, y1: H });
    const s = Math.max(c.s, cursor);
    if (c.e > s) {
      if (c.sill > 0) pieces.push({ s, e: c.e, y0: 0, y1: c.sill });
      if (c.head < H) pieces.push({ s, e: c.e, y0: c.head, y1: H });
    }
    cursor = Math.max(cursor, c.e);
  }
  if (L + half > cursor) pieces.push({ s: cursor, e: L + half, y0: 0, y1: H });
  return pieces;
}

/** Floors, walls (with cut openings), window glass, and door-swing sectors. */
export function buildStructure(project: Project, blockedDoorIds: Set<string>): THREE.Group {
  const root = new THREE.Group();
  const palette = project.style.palette;

  for (const room of project.rooms) {
    if (room.polygon.length < 3) continue;
    const shape = new THREE.Shape(room.polygon.map((p) => new THREE.Vector2(p.x, -p.y)));
    const geo = new THREE.ShapeGeometry(shape);
    geo.rotateX(-Math.PI / 2);
    const floor = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: room.floorColor ?? palette.floor, roughness: 0.9, side: THREE.DoubleSide }));
    floor.receiveShadow = true;
    floor.userData = { kind: 'room', id: room.id };
    root.add(floor);
  }

  for (const wall of project.walls) {
    const L = wallLength(wall);
    if (L < 0.5) continue;
    const group = new THREE.Group();
    group.position.set(wall.a.x, 0, wall.a.y);
    group.rotation.y = -Math.atan2(wall.b.y - wall.a.y, wall.b.x - wall.a.x);
    const material = new THREE.MeshStandardMaterial({ color: palette.walls, roughness: 0.95, transparent: true });
    for (const p of wallPieces(wall, project.openings)) {
      const geo = new THREE.BoxGeometry(p.e - p.s, p.y1 - p.y0, wall.thickness);
      const mesh = new THREE.Mesh(geo, material);
      mesh.position.set((p.s + p.e) / 2, (p.y0 + p.y1) / 2, 0);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: WALL_EDGE, transparent: true, opacity: 0.35 }));
      edges.position.copy(mesh.position);
      group.add(edges);
    }
    // Window glass
    for (const o of project.openings) {
      if (o.wallId !== wall.id || o.kind !== 'window') continue;
      const glass = new THREE.Mesh(
        new THREE.BoxGeometry(o.width, Math.max(1, o.headHeight - o.sillHeight), 0.5),
        new THREE.MeshStandardMaterial({ color: 0x9fd0e8, transparent: true, opacity: 0.35, roughness: 0.1 }),
      );
      glass.position.set(o.t * L, (o.sillHeight + o.headHeight) / 2, 0);
      group.add(glass);
    }
    const mid = new THREE.Vector3((wall.a.x + wall.b.x) / 2, 0, (wall.a.y + wall.b.y) / 2);
    const dir = new THREE.Vector3(wall.b.x - wall.a.x, 0, wall.b.y - wall.a.y).normalize();
    group.userData = { kind: 'wall', id: wall.id, mid, normal: new THREE.Vector3(-dir.z, 0, dir.x), material };
    root.add(group);
  }

  // Door swings drawn on the floor so clearance is visible in 3D.
  const wallById = new Map(project.walls.map((w) => [w.id, w]));
  for (const o of project.openings) {
    const w = wallById.get(o.wallId);
    if (o.kind !== 'door' || !w) continue;
    const g = doorGeometry(o, w, 16);
    const shape = new THREE.Shape(g.swing.map((p) => new THREE.Vector2(p.x, -p.y)));
    const geo = new THREE.ShapeGeometry(shape);
    geo.rotateX(-Math.PI / 2);
    const blocked = blockedDoorIds.has(o.id);
    const sector = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({ color: blocked ? 0xc0392b : 0x4a7fb5, transparent: true, opacity: blocked ? 0.45 : 0.18, side: THREE.DoubleSide, depthWrite: false }),
    );
    sector.position.y = 0.3;
    root.add(sector);
    // Door leaf, shown open
    const leafLen = Math.hypot(g.open.x - g.hinge.x, g.open.y - g.hinge.y);
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(leafLen, o.headHeight, 1.5), new THREE.MeshStandardMaterial({ color: palette.wood, roughness: 0.7 }));
    leaf.position.set((g.hinge.x + g.open.x) / 2, o.headHeight / 2, (g.hinge.y + g.open.y) / 2);
    leaf.rotation.y = -Math.atan2(g.open.y - g.hinge.y, g.open.x - g.hinge.x);
    leaf.castShadow = true;
    root.add(leaf);
  }
  return root;
}

function box(w: number, h: number, d: number, color: THREE.ColorRepresentation, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(Math.max(w, 0.1), Math.max(h, 0.1), Math.max(d, 0.1)), new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
  m.position.set(x, y + h / 2, z);
  return m;
}

function cyl(rx: number, rz: number, h: number, color: THREE.ColorRepresentation, y = 0): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, Math.max(h, 0.1), 28), new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
  m.scale.set(rx, 1, rz);
  m.position.y = y + h / 2;
  return m;
}

const shadeHex = (hex: string, amt: number) => new THREE.Color(hex).lerp(new THREE.Color(amt < 0 ? 0x000000 : 0xffffff), Math.abs(amt));

/** Simple recognizable massing per furniture kind. Local frame: width on x, depth on z, back at -z, floor at y = 0. */
function furnitureParts(f: FurnitureItem, color: string): THREE.Mesh[] {
  const { width: w, depth: d, height: h } = f;
  const round = f.shape === 'ellipse';
  switch (f.kind) {
    case 'sofa': {
      const seat = Math.min(18, h * 0.5);
      const back = Math.min(8, d * 0.25);
      const arm = Math.min(7, w * 0.1);
      return [
        box(w, seat, d, color),
        box(w, h - seat, back, shadeHex(color, -0.12), 0, seat, -d / 2 + back / 2),
        box(arm, Math.min(h - seat, 8), d - back, shadeHex(color, -0.08), -w / 2 + arm / 2, seat, back / 2),
        box(arm, Math.min(h - seat, 8), d - back, shadeHex(color, -0.08), w / 2 - arm / 2, seat, back / 2),
      ];
    }
    case 'bed': {
      const base = Math.min(24, h * 0.6);
      return [
        box(w, base * 0.5, d, shadeHex(color, -0.25)),
        box(w - 2, base * 0.5, d - 4, shadeHex(color, 0.55), 0, base * 0.5, 1),
        box(w - 2, 1.5, d * 0.6, color, 0, base, d * 0.2 - 1),
        box(w, h, 3, shadeHex(color, -0.3), 0, 0, -d / 2 + 1.5),
        ...(w >= 50 ? [-1, 1] : [0]).map((k) => box(Math.min(26, w * 0.4), 5, 16, 0xffffff, (k * w) / 4, base, -d / 2 + 13)),
      ];
    }
    case 'table':
    case 'desk': {
      const top = Math.min(2, h * 0.15);
      if (round) return [cyl(w / 2, d / 2, top, color, h - top), cyl(Math.min(4, w / 6), Math.min(4, d / 6), h - top, shadeHex(color, -0.2))];
      const leg = Math.min(2.5, w / 8, d / 8);
      const legs = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => box(leg, h - top, leg, shadeHex(color, -0.2), sx * (w / 2 - leg), 0, sz * (d / 2 - leg))));
      return [box(w, top, d, color, 0, h - top), ...legs];
    }
    case 'chair': {
      if (round) return [cyl(w / 2, d / 2, h, color)];
      const seat = Math.min(18, h * 0.55);
      return [box(w, seat, d, color), box(w, h - seat, Math.min(4, d * 0.2), shadeHex(color, -0.15), 0, seat, -d / 2 + Math.min(2, d * 0.1))];
    }
    case 'rug':
      return [round ? cyl(w / 2, d / 2, 0.5, color) : box(w, 0.5, d, color)];
    case 'lamp':
      return [cyl(w / 2, d / 2, 1.5, 0x333333), cyl(0.7, 0.7, h * 0.8, 0x333333), cyl(w / 2, d / 2, h * 0.2, shadeHex(color, 0.5), h * 0.8)];
    case 'plant': {
      const pot = h * 0.3;
      const leaves = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshStandardMaterial({ color, roughness: 0.9 }));
      leaves.scale.set(w / 2, (h - pot) / 2, d / 2);
      leaves.position.y = pot + (h - pot) / 2;
      return [cyl(w / 3.2, d / 3.2, pot, 0xb9a58c), leaves];
    }
    default:
      return [round ? cyl(w / 2, d / 2, h, color) : box(w, h, d, color)];
  }
}

export interface FurnitureBuildOptions {
  selectedId: string | null;
  flaggedIds: Set<string>;
}

export function buildFurniture(project: Project, opts: FurnitureBuildOptions): THREE.Group {
  const root = new THREE.Group();
  for (const f of project.furniture) {
    const group = new THREE.Group();
    group.position.set(f.x, f.elevation, f.y);
    group.rotation.y = (-f.rotation * Math.PI) / 180;
    group.userData = { kind: 'furniture', id: f.id };
    const flagged = opts.flaggedIds.has(f.id);
    for (const part of furnitureParts(f, furnitureColor(f, project.style.palette))) {
      part.castShadow = f.kind !== 'rug';
      part.receiveShadow = true;
      if (flagged) {
        const mat = part.material as THREE.MeshStandardMaterial;
        mat.emissive = new THREE.Color(0xc0392b);
        mat.emissiveIntensity = 0.45;
      }
      group.add(part);
    }
    if (opts.selectedId === f.id) {
      const outline = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(f.width + 1, f.height + 1, f.depth + 1)),
        new THREE.LineBasicMaterial({ color: 0x2f7de1 }),
      );
      outline.position.y = f.height / 2;
      group.add(outline);
    }
    root.add(group);
  }
  return root;
}

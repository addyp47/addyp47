import * as THREE from 'three';
import type { Opening, Project, Wall } from '../model/types';
import { doorGeometry, wallLength } from '../geometry/plan';
import { furnitureColor } from '../catalog/furniture';
import { furnitureModel } from './furnitureModels';

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
    // Ceiling: only shown in walk mode (View3D toggles it).
    const ceiling = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xf4f2ec, side: THREE.DoubleSide }));
    ceiling.position.y = project.ceilingHeight;
    ceiling.visible = false;
    ceiling.userData = { kind: 'ceiling' };
    root.add(ceiling);
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
    for (const part of furnitureModel(f, furnitureColor(f, project.style.palette), project.style.palette)) {
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

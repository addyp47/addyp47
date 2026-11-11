import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { FurnitureItem, Palette } from '../model/types';

/**
 * Parametric furniture models. Every model is generated to the piece's exact
 * width × depth × height, so a 78" sofa and a 96" sofa are both correct to the
 * inch (arms and legs keep their size; the seat grows). Colors come from the
 * style palette, so presets restyle the 3D view too.
 *
 * Local frame: width on x, depth on z, back at -z, floor at y = 0. Inches.
 */

type C = THREE.ColorRepresentation;

const mix = (c: C, amt: number) => new THREE.Color(c).lerp(new THREE.Color(amt < 0 ? 0x000000 : 0xffffff), Math.abs(amt));
const mat = (color: C, rough = 0.8, metal = 0) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });

/** Box with its base at y (not centered), optionally with rounded edges. */
function box(w: number, h: number, d: number, color: C, x = 0, y = 0, z = 0, round = 0, rough = 0.8): THREE.Mesh {
  w = Math.max(w, 0.1);
  h = Math.max(h, 0.1);
  d = Math.max(d, 0.1);
  const r = Math.min(round, w / 2 - 0.01, h / 2 - 0.01, d / 2 - 0.01);
  const geo = r > 0.2 ? new RoundedBoxGeometry(w, h, d, 3, r) : new THREE.BoxGeometry(w, h, d);
  const m = new THREE.Mesh(geo, mat(color, rough));
  m.position.set(x, y + h / 2, z);
  return m;
}

/** Elliptical cylinder (or cone when rTop differs) with its base at y. */
function cyl(rx: number, rz: number, h: number, color: C, x = 0, y = 0, z = 0, topScale = 1, rough = 0.8): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(topScale, 1, Math.max(h, 0.1), 32), mat(color, rough));
  m.scale.set(Math.max(rx, 0.05), 1, Math.max(rz, 0.05));
  m.position.set(x, y + h / 2, z);
  return m;
}

function legs(w: number, d: number, h: number, color: C, size = 1.6, inset = 1.5): THREE.Mesh[] {
  return [-1, 1].flatMap((sx) => [-1, 1].map((sz) => box(size, h, size, color, sx * (w / 2 - inset - size / 2), 0, sz * (d / 2 - inset - size / 2))));
}

function upholstered(w: number, d: number, h: number, color: C, wood: C): THREE.Mesh[] {
  const leg = Math.min(4, h * 0.12);
  const seatTop = Math.min(18, h * 0.52);
  const arm = Math.min(7, w * 0.11);
  const back = Math.min(8, d * 0.24);
  const armH = Math.min(h - leg, seatTop + 7) - leg;
  const inner = w - arm * 2;
  const seats = Math.max(1, Math.round(inner / 27));
  const sw = inner / seats;
  const cushionD = d - back - 1;
  const parts: THREE.Mesh[] = [
    ...legs(w, d, leg, wood, 1.8, 1),
    box(w, seatTop - leg - 5, d, mix(color, -0.1), 0, leg, 0, 1.5),
    box(arm, armH, d, mix(color, -0.06), -w / 2 + arm / 2, leg, 0, 2.2),
    box(arm, armH, d, mix(color, -0.06), w / 2 - arm / 2, leg, 0, 2.2),
    box(inner, h - leg, back, mix(color, -0.12), 0, leg, -d / 2 + back / 2, 2),
  ];
  for (let i = 0; i < seats; i++) {
    const x = -inner / 2 + sw * (i + 0.5);
    parts.push(box(sw - 0.6, 5.5, cushionD, color, x, seatTop - 5, -d / 2 + back + cushionD / 2 + 0.5, 1.8));
    parts.push(box(sw - 1.2, Math.max(6, h - seatTop - 3), 5, mix(color, 0.06), x, seatTop + 0.3, -d / 2 + back + 2.2, 2.2));
  }
  return parts;
}

function bed(w: number, d: number, h: number, color: C, wood: C): THREE.Mesh[] {
  const top = Math.min(25, h * 0.6);
  const frameH = Math.min(9, top * 0.4);
  const leg = Math.min(5, top * 0.2);
  const mattressH = top - leg - frameH + 2;
  const parts: THREE.Mesh[] = [
    ...legs(w, d, leg, wood, 2, 1),
    box(w, frameH, d, wood, 0, leg, 0, 0.6),
    box(w, h, 2.5, mix(wood, -0.1), 0, 0, -d / 2 + 1.25, 0.8),
    box(w - 3, mattressH, d - 5, 0xf4f1ea, 0, leg + frameH - 2, 1, 2.5),
    // duvet over the lower two thirds, folded back at the top
    box(w - 1.5, 2, d * 0.62, color, 0, top - 0.8, d / 2 - d * 0.31 - 1.5, 0.9),
    box(w - 1.5, 2.6, 7, mix(color, 0.35), 0, top - 0.6, d / 2 - d * 0.62 - 3, 1.2),
  ];
  const n = w >= 50 ? 2 : 1;
  const pw = Math.min(27, (w - 8) / n);
  for (let i = 0; i < n; i++) parts.push(box(pw, 5, 17, 0xffffff, (i - (n - 1) / 2) * (pw + 3), top - 0.5, -d / 2 + 13, 2.4));
  return parts;
}

function drawers(w: number, d: number, h: number, color: C, wood: C, opts: { legH?: number; rows?: number; cols?: number; doors?: boolean } = {}): THREE.Mesh[] {
  const legH = opts.legH ?? Math.min(4, h * 0.1);
  const bodyH = h - legH;
  const parts: THREE.Mesh[] = [...(legH > 0.5 ? legs(w, d, legH, mix(wood, -0.25), 1.6, 1) : []), box(w, bodyH, d, color, 0, legH, 0, 0.5)];
  const cols = opts.cols ?? (w > 44 ? 2 : 1);
  const rows = opts.doors ? 1 : (opts.rows ?? Math.max(1, Math.round(bodyH / 9.5)));
  const gap = 0.7;
  const fw = (w - gap * (cols + 1)) / cols;
  const fh = (bodyH - gap * (rows + 1)) / rows;
  const front = mix(color, 0.08);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const x = -w / 2 + gap + fw / 2 + c * (fw + gap);
      const y = legH + gap + r * (fh + gap);
      parts.push(box(fw, fh, 0.7, front, x, y, d / 2 + 0.2, 0.25));
      if (opts.doors) parts.push(box(0.7, Math.min(8, fh * 0.2), 0.9, 0x2e2e2e, x + (c < cols / 2 ? fw / 2 - 2 : -fw / 2 + 2), y + fh * 0.45, d / 2 + 0.9));
      else parts.push(box(Math.min(5, fw * 0.3), 0.6, 0.9, 0x2e2e2e, x, y + fh / 2 - 0.3, d / 2 + 0.9));
    }
  return parts;
}

const BOOKS = [0x8c3b2f, 0x2f5d50, 0xd4a03c, 0x3c4f8a, 0xe8e2d6, 0x5b3a4a, 0x7d9aa6, 0x2e2e2e];

function shelves(w: number, d: number, h: number, color: C, withBooks: boolean): THREE.Mesh[] {
  const t = 0.8;
  const parts: THREE.Mesh[] = [
    box(t, h, d, color, -w / 2 + t / 2, 0, 0),
    box(t, h, d, color, w / 2 - t / 2, 0, 0),
    box(w, h, 0.4, mix(color, -0.12), 0, 0, -d / 2 + 0.2),
  ];
  const bays = Math.max(1, Math.round(h / 14));
  const bayH = (h - t) / bays;
  for (let i = 0; i <= bays; i++) parts.push(box(w - t * 2, t, d - 0.4, color, 0, i * bayH, 0.2));
  if (!withBooks) return parts;
  // Deterministic "random" books so the model doesn't flicker on rebuild.
  let seed = Math.round(w * 7 + h * 13);
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < bays; i++) {
    let x = -w / 2 + t + 0.6;
    const end = w / 2 - t - 0.6 - (i % 2 ? w * 0.25 : 0);
    while (x < end - 1.6) {
      const bw = 1 + rnd() * 1.3;
      const bh = bayH * (0.55 + rnd() * 0.3);
      parts.push(box(bw, bh, Math.min(d - 2.5, 7.5), BOOKS[Math.floor(rnd() * BOOKS.length)], x + bw / 2, i * bayH + t, -0.3));
      x += bw + 0.12;
    }
  }
  return parts;
}

function table(f: FurnitureItem, color: C): THREE.Mesh[] {
  const { width: w, depth: d, height: h } = f;
  const top = Math.min(1.6, h * 0.15);
  const dark = mix(color, -0.22);
  if (f.shape === 'ellipse') {
    return [cyl(w / 2, d / 2, top, color, 0, h - top), cyl(Math.min(2.5, w / 8), Math.min(2.5, d / 8), h - top - 1, dark, 0, 1), cyl(w * 0.28, d * 0.28, 1, dark, 0, 0, 0, 0.7)];
  }
  const leg = Math.min(2.2, w / 8, d / 8);
  const parts = [box(w, top, d, color, 0, h - top, 0, 0.3), ...legs(w, d, h - top, dark, leg, 1)];
  if (h <= 20 && h > 10) parts.push(box(w - 6, 0.8, d - 6, mix(color, -0.08), 0, h * 0.3, 0)); // coffee-table shelf
  else if (h > 20) parts.push(box(w - 4 - leg * 2, 2.5, 0.8, dark, 0, h - top - 2.5, d / 2 - 1.4 - leg / 2), box(w - 4 - leg * 2, 2.5, 0.8, dark, 0, h - top - 2.5, -d / 2 + 1.4 + leg / 2));
  return parts;
}

function desk(w: number, d: number, h: number, color: C): THREE.Mesh[] {
  const top = 1.4;
  const dark = mix(color, -0.22);
  const ped = Math.min(16, w * 0.3);
  return [
    box(w, top, d, color, 0, h - top, 0, 0.3),
    box(1.6, h - top, d - 3, dark, -w / 2 + 2, 0, 0),
    ...drawers(ped, d - 3, h - top, mix(color, -0.06), color, { legH: 0, rows: 3, cols: 1 }).map((m) => (m.position.x += w / 2 - ped / 2 - 1, m)),
    box(w - ped - 5, 8, 0.6, dark, -ped / 2 + 0.5, h - top - 8, -d / 2 + 2.5),
  ];
}

function chair(f: FurnitureItem, color: C, wood: C): THREE.Mesh[] {
  const { width: w, depth: d, height: h } = f;
  const id = f.catalogId;
  if (id === 'armchair' || id === 'accent-chair') return upholstered(w, d, h, color, wood);
  if (id === 'office-chair') {
    const seatY = Math.min(19, h * 0.48);
    const star = [0, 72, 144, 216, 288].map((a) => {
      const arm = box(w * 0.42, 1, 1.6, 0x2b2b2b, 0, 1.2, 0);
      arm.position.x = Math.cos((a * Math.PI) / 180) * w * 0.21;
      arm.position.z = Math.sin((a * Math.PI) / 180) * w * 0.21;
      arm.rotation.y = (-a * Math.PI) / 180;
      return arm;
    });
    return [...star, cyl(1.1, 1.1, seatY - 3, 0x3a3a3a, 0, 1.5), box(w * 0.74, 3, d * 0.72, color, 0, seatY - 3, 1, 1.4), box(w * 0.68, h - seatY - 3, 2.4, color, 0, seatY + 2.5, -d * 0.34, 1.1)];
  }
  if (f.shape === 'ellipse') {
    if (h <= 20) return [cyl(w / 2, d / 2, h, color, 0, 0, 0, 0.96)]; // ottoman / pouf
    const legR = 0.7;
    return [
      cyl(w / 2, d / 2, 1.8, color, 0, h - 1.8),
      ...[0, 90, 180, 270].map((a) => cyl(legR, legR, h - 1.8, mix(wood, -0.2), Math.cos((a * Math.PI) / 180) * w * 0.36, 0, Math.sin((a * Math.PI) / 180) * d * 0.36)),
      cyl(w * 0.4, d * 0.4, 0.6, mix(wood, -0.2), 0, h * 0.35, 0),
    ];
  }
  if (id === 'bench' || h <= 20) return [box(w, 2, d, color, 0, h - 2, 0, 0.5), ...legs(w, d, h - 2, mix(wood, -0.2), 1.6, 1.5)];
  const seatY = Math.min(18, h * 0.53);
  const post = 1.3;
  return [
    ...legs(w, d, seatY - 1.5, wood, post, 0.3),
    box(w, 1.8, d, color, 0, seatY - 1.8, 0, 0.5),
    box(post, h - seatY, post, wood, -w / 2 + post / 2 + 0.3, seatY, -d / 2 + post / 2 + 0.3),
    box(post, h - seatY, post, wood, w / 2 - post / 2 - 0.3, seatY, -d / 2 + post / 2 + 0.3),
    box(w - 1, (h - seatY) * 0.45, 1, color, 0, seatY + (h - seatY) * 0.5, -d / 2 + 0.9, 0.4),
  ];
}

function storage(f: FurnitureItem, color: C, wood: C): THREE.Mesh[] {
  const { width: w, depth: d, height: h } = f;
  switch (f.catalogId) {
    case 'bookshelf':
    case 'cube-shelf':
      return shelves(w, d, h, color, true);
    case 'ladder-shelf':
      return shelves(w, d, h, color, false);
    case 'wardrobe':
      return drawers(w, d, h, color, wood, { doors: true, cols: 2, legH: 2 });
    case 'shoe-rack':
      return drawers(w, d, h, color, wood, { rows: 3, cols: 1, legH: 3 });
    case 'clothes-rack': {
      const metal = 0x2b2b2b;
      const parts = [
        box(1, h, 1, metal, -w / 2 + 0.5, 0, 0),
        box(1, h, 1, metal, w / 2 - 0.5, 0, 0),
        box(w, 1, 1, metal, 0, h - 1, 0),
        box(1, 1, d, metal, -w / 2 + 0.5, 0, 0),
        box(1, 1, d, metal, w / 2 - 0.5, 0, 0),
        box(w, 0.8, d * 0.8, wood, 0, 5, 0),
      ];
      const n = Math.max(3, Math.floor(w / 6));
      for (let i = 0; i < n; i++) parts.push(box(1.4, h * (0.45 + (i % 3) * 0.08), d * 0.85, BOOKS[(i * 3) % BOOKS.length], -w / 2 + 4 + (i * (w - 8)) / (n - 1), h - 2 - h * (0.45 + (i % 3) * 0.08), 0, 0.5));
      return parts;
    }
    case 'bar-cart':
      return [...legs(w, d, h, 0xb08d57, 0.9, 0.3), box(w, 0.8, d, color, 0, h - 0.8, 0), box(w, 0.8, d, color, 0, h * 0.35, 0), cyl(1.6, 1.6, 9, 0x2f5d50, -w * 0.2, h, 0), cyl(1.4, 1.4, 7, 0xb8452f, w * 0.1, h, 1)];
    default:
      return drawers(w, d, h, color, wood);
  }
}

function appliance(f: FurnitureItem, wood: C): THREE.Mesh[] {
  const { width: w, depth: d, height: h } = f;
  const white = f.color ?? 0xe6e8ea;
  const steel = 0xc3c7cb;
  const dark = 0x2a2c2f;
  switch (f.catalogId.replace('scan-', '')) {
    case 'refrigerator':
      return [box(w, h, d - 1.5, steel, 0, 0, -0.75, 0.6, 0.4), box(w - 0.6, h * 0.62 - 0.4, 1.5, mix(steel, 0.12), 0, h * 0.38 + 0.2, d / 2 - 0.75, 0.3, 0.4), box(w - 0.6, h * 0.38 - 0.4, 1.5, mix(steel, 0.12), 0, 0.2, d / 2 - 0.75, 0.3, 0.4), box(0.9, h * 0.3, 1.2, dark, -w / 2 + 3, h * 0.45, d / 2 + 0.5), box(0.9, h * 0.2, 1.2, dark, -w / 2 + 3, h * 0.12, d / 2 + 0.5)];
    case 'stove':
    case 'oven': {
      const parts = [box(w, h, d, steel, 0, 0, 0, 0.4, 0.4), box(w - 4, h * 0.42, 0.6, dark, 0, h * 0.18, d / 2 + 0.1, 0.3), box(w - 6, 0.9, 1.4, 0x888c90, 0, h * 0.66, d / 2 + 0.6)];
      if (f.catalogId.endsWith('stove')) {
        parts.push(box(w - 1, 0.4, d - 1, dark, 0, h, 0));
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push(cyl(Math.min(4, w * 0.14), Math.min(4, d * 0.14), 0.4, 0x555a5f, sx * w * 0.23, h + 0.4, sz * d * 0.22));
      }
      return parts;
    }
    case 'dishwasher':
      return [box(w, h, d, steel, 0, 0, 0, 0.4, 0.4), box(w - 2, h - 8, 0.6, mix(steel, 0.1), 0, 3, d / 2 + 0.1, 0.3), box(w - 8, 0.9, 1.3, 0x888c90, 0, h - 6, d / 2 + 0.6)];
    case 'washerdryer': {
      const door = cyl(Math.min(w, h) * 0.3, Math.min(w, h) * 0.3, 1, dark, 0, 0, 0);
      door.rotation.x = Math.PI / 2;
      door.position.set(0, h * 0.5, d / 2 + 0.3);
      return [box(w, h, d, white, 0, 0, 0, 0.6, 0.5), door, box(w - 4, 3, 0.5, 0x9aa0a6, 0, h - 5, d / 2 + 0.1)];
    }
    case 'sink': {
      const faucet = cyl(0.6, 0.6, 7, 0xb9bdc2, 0, h, -d * 0.36);
      return [box(w, h - 1.2, d, wood, 0, 0, 0, 0.3), box(w + 0.6, 1.2, d + 0.6, 0xf1efe9, 0, h - 1.2, 0, 0.3), box(w * 0.62, 0.5, d * 0.55, 0x8f969c, 0, h - 0.2, d * 0.06, 0.2, 0.3), faucet, box(1, 1, 5, 0xb9bdc2, 0, h + 6, -d * 0.36 + 2.5)];
    }
    case 'toilet': {
      const tankD = Math.min(8, d * 0.3);
      const bowlH = Math.min(15, h * 0.55);
      return [box(w * 0.85, h, tankD, 0xf7f7f5, 0, 0, -d / 2 + tankD / 2, 1.2, 0.3), cyl(w * 0.4, (d - tankD) * 0.42, bowlH - 1, 0xf7f7f5, 0, 0, tankD / 2 - 0.5, 1.25, 0.3), cyl(w * 0.46, (d - tankD) * 0.5, 1.2, 0xffffff, 0, bowlH - 1, tankD / 2, 1, 0.3)];
    }
    case 'bathtub':
      return [box(w, h, d, 0xf7f7f5, 0, 0, 0, 2.5, 0.3), box(w - 6, 0.6, d - 6, 0xcfe3ea, 0, h - 0.4, 0, 2, 0.2)];
    default:
      return [box(w, h, d, white, 0, 0, 0, 0.5, 0.5)];
  }
}

function lamp(f: FurnitureItem, color: C): THREE.Mesh[] {
  const { width: w, depth: d, height: h } = f;
  const metal = 0x2b2b2b;
  if (f.catalogId === 'arc-lamp') {
    const reach = Math.max(w * 1.6, 26);
    const parts = [cyl(w / 2, d / 2, 2, 0xdad6cf, 0, 0, 0, 0.92, 0.4), cyl(0.6, 0.6, h * 0.7, metal, 0, 2, 0)];
    const steps = 7;
    for (let i = 0; i < steps; i++) {
      const a0 = (i / steps) * (Math.PI / 2);
      const seg = box(reach / steps + 0.8, 0.9, 0.9, metal, Math.sin(a0 + Math.PI / 4 / steps) * reach, h * 0.7 + Math.cos(a0) * h * 0.3 - 0.6, 0);
      seg.rotation.z = -a0;
      parts.push(seg);
    }
    parts.push(cyl(7, 7, 6, mix(color, 0.45), reach, h * 0.66, 0, 0.5));
    return parts;
  }
  const shadeH = Math.min(11, h * 0.2);
  return [cyl(w * 0.4, d * 0.4, 1, metal, 0, 0, 0, 0.9), cyl(0.55, 0.55, h - shadeH - 1, metal, 0, 1, 0), cyl(w / 2, d / 2, shadeH, mix(color, 0.5), 0, h - shadeH, 0, 0.72, 0.95)];
}

function plant(f: FurnitureItem, color: C): THREE.Mesh[] {
  const { width: w, depth: d, height: h } = f;
  const pot = Math.min(h * 0.28, 14);
  const parts = [cyl(w * 0.24, d * 0.24, pot, 0xb9a58c, 0, 0, 0, 1.3), cyl(0.6, 0.6, h * 0.35, 0x6b4a32, 0, pot, 0)];
  const blobs = [[0, 0.62, 0, 0.5], [0.22, 0.5, 0.1, 0.36], [-0.2, 0.55, -0.12, 0.38], [0.05, 0.78, -0.08, 0.34], [-0.08, 0.46, 0.22, 0.3]];
  blobs.forEach(([x, y, z, r], i) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), mat(mix(color, (i % 3) * 0.08 - 0.05), 0.9));
    m.scale.set(w * r, (h - pot) * r * 0.75, d * r);
    m.position.set(x * w, pot + (h - pot) * y, z * d);
    parts.push(m);
  });
  return parts;
}

function generic(f: FurnitureItem, color: C, wood: C): THREE.Mesh[] {
  const { width: w, depth: d, height: h } = f;
  switch (f.catalogId.replace('scan-', '')) {
    case 'television': {
      const parts = [box(w, h, Math.min(d, 2), 0x151617, 0, 0, 0, 0.4, 0.3), box(w - 1.2, h - 1.2, 0.2, 0x26303a, 0, 0.6, Math.min(d, 2) / 2 + 0.05, 0, 0.15)];
      return parts;
    }
    case 'mirror':
      return [box(w, h, d, wood, 0, 0, 0, 0.5), box(w - 3, h - 3, 0.3, 0xcfe0e6, 0, 1.5, d / 2 + 0.05, 0, 0.1)];
    case 'room-divider': {
      const n = 3;
      return Array.from({ length: n }, (_, i) => {
        const p = box(w / n + 0.5, h, 1, color, -w / 2 + (w / n) * (i + 0.5), 0, 0);
        p.rotation.y = (i % 2 ? -1 : 1) * 0.35;
        return p;
      });
    }
    case 'fireplace':
      return [box(w, h, d, 0xd8d2c8, 0, 0, 0, 0.4), box(w * 0.6, h * 0.55, 0.6, 0x1c1c1c, 0, 0, d / 2 + 0.1)];
    case 'stairs': {
      const steps = Math.max(3, Math.round(h / 7.5));
      return Array.from({ length: steps }, (_, i) => box(w, (h / steps) * (i + 1), d / steps, wood, 0, 0, -d / 2 + (d / steps) * (steps - i - 0.5)));
    }
    default:
      return [f.shape === 'ellipse' ? cyl(w / 2, d / 2, h, color) : box(w, h, d, color, 0, 0, 0, Math.min(1, h / 4))];
  }
}

function rug(f: FurnitureItem, color: C): THREE.Mesh[] {
  const { width: w, depth: d } = f;
  if (f.shape === 'ellipse') return [cyl(w / 2, d / 2, 0.4, mix(color, -0.12)), cyl(w / 2 - 3, d / 2 - 3, 0.45, color)];
  return [box(w, 0.4, d, mix(color, -0.12)), box(w - 6, 0.45, d - 6, color), box(w - 16, 0.5, d - 16, mix(color, 0.18))];
}

export function furnitureModel(f: FurnitureItem, color: string, palette: Palette): THREE.Mesh[] {
  const wood = palette.wood;
  switch (f.kind) {
    case 'sofa':
      return upholstered(f.width, f.depth, f.height, color, mix(wood, -0.2));
    case 'bed':
      return bed(f.width, f.depth, f.height, color, f.catalogId.startsWith('scan-') ? wood : mix(wood, -0.05));
    case 'chair':
      return chair(f, color, mix(wood, -0.1));
    case 'table':
      return f.catalogId === 'kitchen-cart' ? drawers(f.width, f.depth, f.height, color, wood, { doors: true, cols: 2, legH: 3 }) : table(f, color);
    case 'desk':
      return desk(f.width, f.depth, f.height, color);
    case 'storage':
      return storage(f, color, wood);
    case 'appliance':
      return appliance(f, wood);
    case 'lamp':
      return lamp(f, color);
    case 'plant':
      return plant(f, color);
    case 'rug':
      return rug(f, color);
    default:
      return generic(f, color, wood);
  }
}

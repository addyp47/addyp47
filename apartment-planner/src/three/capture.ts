import type { Object3D } from 'three';

/** Module-level handles to the live 3D view, used by PNG and GLB export. */
let capture: (() => Promise<Blob>) | null = null;
let roots: Object3D[] | null = null;

export function setCapture3D(fn: (() => Promise<Blob>) | null, r: Object3D[] | null) {
  capture = fn;
  roots = r;
}

export function capture3D(): Promise<Blob> | null {
  return capture ? capture() : null;
}

/** The plan's own objects (structure + furniture), without lights or ground. */
export function getExportRoots(): Object3D[] | null {
  return roots;
}

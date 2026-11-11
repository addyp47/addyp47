import { create } from 'zustand';
import { produce, type Draft } from 'immer';
import type { Project, Selection, Vec2 } from '../model/types';
import { createEmptyProject } from '../model/defaults';
import { projectBounds } from '../geometry/plan';

export type Tool = 'select' | 'room' | 'wall' | 'calibrate' | 'door' | 'window' | 'outlet';

export interface ViewTransform {
  /** Screen pixels per inch. */
  scale: number;
  /** Screen offset of world origin. */
  x: number;
  y: number;
}

export interface Photo {
  id: string;
  name: string;
  dataUrl: string;
  width: number;
  height: number;
}

export interface CalibrationRequest {
  a: Vec2;
  b: Vec2;
}

const HISTORY_LIMIT = 150;

interface EditorState {
  project: Project;
  past: Project[];
  future: Project[];
  selection: Selection | null;
  hoverId: string | null;
  tool: Tool;
  view: ViewTransform;
  viewport: { width: number; height: number };
  /** Room tool: also create walls along edges. */
  traceCreatesWalls: boolean;
  showWarnings: boolean;
  viewMode: '2d' | '3d';
  /** First-person walkthrough inside the 3D view. */
  walkMode: boolean;
  /** Reference photos for this session. Not saved with the layout (they'd fill browser storage). */
  photos: Photo[];
  calibration: CalibrationRequest | null;
  toast: { message: string; kind: 'info' | 'error' } | null;

  setTool: (tool: Tool) => void;
  select: (sel: Selection | null) => void;
  setHover: (id: string | null) => void;
  setView: (view: ViewTransform) => void;
  setViewport: (w: number, h: number) => void;
  setTraceCreatesWalls: (v: boolean) => void;
  setShowWarnings: (v: boolean) => void;
  setViewMode: (m: '2d' | '3d') => void;
  setWalkMode: (v: boolean) => void;
  addPhotos: (photos: Photo[]) => void;
  removePhoto: (id: string) => void;
  setCalibration: (c: CalibrationRequest | null) => void;
  showToast: (message: string, kind?: 'info' | 'error') => void;

  /** Apply a change to the project. `record: false` skips history (used mid-drag after checkpoint()). */
  mutate: (fn: (draft: Draft<Project>) => void, opts?: { record?: boolean }) => void;
  /** Snapshot the current project into history (call at the start of a drag). */
  checkpoint: () => void;
  undo: () => void;
  redo: () => void;
  loadProject: (p: Project) => void;
  fitToView: () => void;
}

export const useEditor = create<EditorState>((set, get) => ({
  project: createEmptyProject(),
  past: [],
  future: [],
  selection: null,
  hoverId: null,
  tool: 'select',
  view: { scale: 1.5, x: 80, y: 80 },
  viewport: { width: 800, height: 600 },
  traceCreatesWalls: true,
  showWarnings: true,
  viewMode: '2d',
  walkMode: false,
  photos: [],
  calibration: null,
  toast: null,

  setTool: (tool) => set({ tool, selection: tool === 'select' ? get().selection : null }),
  select: (selection) => set({ selection }),
  setHover: (hoverId) => set({ hoverId }),
  setView: (view) => set({ view }),
  setViewport: (width, height) => set({ viewport: { width, height } }),
  setTraceCreatesWalls: (traceCreatesWalls) => set({ traceCreatesWalls }),
  setShowWarnings: (showWarnings) => set({ showWarnings }),
  setViewMode: (viewMode) => set({ viewMode, tool: 'select', walkMode: false }),
  setWalkMode: (walkMode) => set({ walkMode }),
  addPhotos: (photos) => set({ photos: [...get().photos, ...photos] }),
  removePhoto: (id) => set({ photos: get().photos.filter((p) => p.id !== id) }),
  setCalibration: (calibration) => set({ calibration }),
  showToast: (message, kind = 'info') => {
    set({ toast: { message, kind } });
    window.setTimeout(() => {
      if (get().toast?.message === message) set({ toast: null });
    }, 3500);
  },

  mutate: (fn, opts) => {
    const { project, past } = get();
    const next = produce(project, (d) => {
      fn(d);
      d.updatedAt = Date.now();
    });
    if (next === project) return;
    if (opts?.record === false) {
      set({ project: next });
    } else {
      set({ project: next, past: [...past, project].slice(-HISTORY_LIMIT), future: [] });
    }
  },

  checkpoint: () => {
    const { project, past } = get();
    set({ past: [...past, project].slice(-HISTORY_LIMIT), future: [] });
  },

  undo: () => {
    const { past, project, future } = get();
    if (past.length === 0) return;
    const prev = past[past.length - 1];
    set({ project: prev, past: past.slice(0, -1), future: [project, ...future], selection: null });
  },

  redo: () => {
    const { past, project, future } = get();
    if (future.length === 0) return;
    const [next, ...rest] = future;
    set({ project: next, past: [...past, project], future: rest, selection: null });
  },

  loadProject: (p) => {
    set({ project: p, past: [], future: [], selection: null, hoverId: null, tool: 'select' });
    get().fitToView();
  },

  fitToView: () => {
    const { project, viewport } = get();
    const b = projectBounds(project);
    if (!b) {
      set({ view: { scale: 1.5, x: 80, y: 80 } });
      return;
    }
    const pad = 40;
    const w = Math.max(b.maxX - b.minX, 60);
    const h = Math.max(b.maxY - b.minY, 60);
    const s = Math.min((viewport.width - pad * 2) / w, (viewport.height - pad * 2) / h, 8);
    set({
      view: {
        scale: s,
        x: (viewport.width - w * s) / 2 - b.minX * s,
        y: (viewport.height - h * s) / 2 - b.minY * s,
      },
    });
  },
}));

export function screenToWorld(view: ViewTransform, sx: number, sy: number): Vec2 {
  return { x: (sx - view.x) / view.scale, y: (sy - view.y) / view.scale };
}

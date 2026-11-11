import type { Project } from '../model/types';
import { migrateProject } from '../model/migrate';

const INDEX_KEY = 'aptplanner:index';
const LAST_KEY = 'aptplanner:last';
const projectKey = (id: string) => `aptplanner:project:${id}`;

export interface SavedMeta {
  id: string;
  name: string;
  updatedAt: number;
  rooms: number;
  furniture: number;
}

function readIndex(): SavedMeta[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    return raw ? (JSON.parse(raw) as SavedMeta[]) : [];
  } catch {
    return [];
  }
}

function writeIndex(index: SavedMeta[]) {
  localStorage.setItem(INDEX_KEY, JSON.stringify(index));
}

export function listSaved(): SavedMeta[] {
  return readIndex().sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Save into the project's own slot. Throws a friendly Error if storage is full. */
export function saveProject(p: Project) {
  try {
    localStorage.setItem(projectKey(p.id), JSON.stringify(p));
    const meta: SavedMeta = { id: p.id, name: p.name, updatedAt: p.updatedAt, rooms: p.rooms.length, furniture: p.furniture.length };
    writeIndex([meta, ...readIndex().filter((m) => m.id !== p.id)]);
    localStorage.setItem(LAST_KEY, p.id);
  } catch (e) {
    if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22)) {
      throw new Error('Browser storage is full. Try a smaller floor plan image, delete old layouts, or export to JSON.');
    }
    throw e;
  }
}

export function loadSaved(id: string): Project | null {
  const raw = localStorage.getItem(projectKey(id));
  if (!raw) return null;
  return migrateProject(JSON.parse(raw));
}

export function deleteSaved(id: string) {
  localStorage.removeItem(projectKey(id));
  writeIndex(readIndex().filter((m) => m.id !== id));
  if (localStorage.getItem(LAST_KEY) === id) localStorage.removeItem(LAST_KEY);
}

export function loadLastOpened(): Project | null {
  try {
    const id = localStorage.getItem(LAST_KEY);
    return id ? loadSaved(id) : null;
  } catch {
    return null;
  }
}

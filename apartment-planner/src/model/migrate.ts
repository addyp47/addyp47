import type { Project } from './types';
import { SCHEMA_VERSION } from './types';
import { createEmptyProject } from './defaults';

/**
 * Bring any saved project up to the current schema. Add a `case` per version
 * bump; each step transforms vN → vN+1.
 */
export function migrateProject(raw: unknown): Project {
  const notOurs = "This doesn't look like an Apartment Planner layout file.";
  if (!raw || typeof raw !== 'object') throw new Error(notOurs);
  const data = raw as Partial<Project> & { version?: number };
  if (typeof data.version !== 'number' || (!Array.isArray(data.walls) && !Array.isArray(data.rooms))) throw new Error(notOurs);
  if (data.version > SCHEMA_VERSION) {
    throw new Error(`This file was made by a newer version (v${data.version}).`);
  }
  // v1 is current. Fill any missing collections defensively.
  const base = createEmptyProject(data.name ?? 'Imported apartment');
  const project: Project = {
    ...base,
    ...data,
    version: SCHEMA_VERSION,
    rooms: Array.isArray(data.rooms) ? data.rooms : [],
    walls: Array.isArray(data.walls) ? data.walls : [],
    openings: Array.isArray(data.openings) ? data.openings : [],
    furniture: Array.isArray(data.furniture) ? data.furniture : [],
    style: { ...base.style, ...(data.style ?? {}), palette: { ...base.style.palette, ...(data.style?.palette ?? {}) } },
    background: data.background ?? null,
    source: data.source ?? { kind: 'json' },
  };
  return project;
}

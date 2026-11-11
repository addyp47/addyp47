import type { PlanImporter } from './types';
import type { Project } from '../model/types';
import { migrateProject } from '../model/migrate';
import { newId } from '../model/defaults';

export const FILE_FORMAT = 'apartment-planner';

export function serializeProject(p: Project): string {
  return JSON.stringify({ format: FILE_FORMAT, ...p }, null, 2);
}

export const jsonImporter: PlanImporter = {
  id: 'json',
  label: 'Apartment Planner JSON',
  accept: '.json,application/json',
  canImport: (file) => file.name.toLowerCase().endsWith('.json') || file.type === 'application/json',
  async import(file) {
    let data: unknown;
    try {
      data = JSON.parse(await file.text());
    } catch {
      throw new Error('That file is not valid JSON.');
    }
    const obj = data as { format?: string };
    if (obj && typeof obj === 'object' && obj.format && obj.format !== FILE_FORMAT) {
      throw new Error(`Unrecognized file format "${obj.format}".`);
    }
    const { format: _format, ...rest } = obj as Record<string, unknown>;
    void _format;
    const project = migrateProject(rest);
    // Fresh id so importing never overwrites an existing saved layout.
    return { ...project, id: newId('proj'), source: project.source ?? { kind: 'json' } };
  },
};

/** Registry: add the RoomPlan importer here later. */
export const IMPORTERS: PlanImporter[] = [jsonImporter];

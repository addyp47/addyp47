import type { PlanImporter } from './types';
import type { Project } from '../model/types';
import { migrateProject } from '../model/migrate';
import { newId } from '../model/defaults';
import { capturedRoomToScan, isCapturedRoom } from './roomplan/capturedRoom';
import { scanToProject } from './roomplan/scan';
import { roomplanUsdzImporter } from './roomplan/usdz';

export const FILE_FORMAT = 'apartment-planner';

export function serializeProject(p: Project): string {
  return JSON.stringify({ format: FILE_FORMAT, ...p }, null, 2);
}

export const jsonImporter: PlanImporter = {
  id: 'json',
  label: 'Apartment Planner layout or RoomPlan scan (JSON)',
  accept: '.json,application/json',
  canImport: (file) => file.name.toLowerCase().endsWith('.json') || file.type === 'application/json',
  async import(file) {
    let data: unknown;
    try {
      data = JSON.parse(await file.text());
    } catch {
      throw new Error('That file is not valid JSON.');
    }
    // A RoomPlan CapturedRoom saved as JSON
    if (isCapturedRoom(data)) {
      return scanToProject(capturedRoomToScan(data), file.name.replace(/\.json$/i, '') || 'Scanned apartment');
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

/** Registry of everything the Import button accepts. */
export const IMPORTERS: PlanImporter[] = [jsonImporter, roomplanUsdzImporter];

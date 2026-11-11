import type { Project } from '../model/types';

/**
 * Anything that turns a file into a Project. The JSON importer is the only one
 * today; a RoomPlan (USDZ / CapturedRoom JSON) importer will implement the same
 * interface and map walls, doors, windows, and objects onto the plan model.
 */
export interface PlanImporter {
  id: string;
  label: string;
  /** File-input accept string. */
  accept: string;
  canImport(file: File): boolean;
  import(file: File): Promise<Project>;
}

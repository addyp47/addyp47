import { describe, expect, it } from 'vitest';
import { jsonImporter, serializeProject } from '../importers/json';
import { createEmptyProject, createWall } from '../model/defaults';

const fileOf = (text: string, name = 'x.json') => ({ name, type: 'application/json', text: async () => text }) as unknown as File;

describe('JSON import/export', () => {
  it('round-trips a project with a fresh id', async () => {
    const p = createEmptyProject('Test');
    p.walls.push(createWall({ x: 0, y: 0 }, { x: 100, y: 0 }));
    const back = await jsonImporter.import(fileOf(serializeProject(p)));
    expect(back.name).toBe('Test');
    expect(back.walls).toEqual(p.walls);
    expect(back.id).not.toBe(p.id);
  });
  it('rejects foreign files', async () => {
    await expect(jsonImporter.import(fileOf('{"hello":1}'))).rejects.toThrow(/Apartment Planner/);
    await expect(jsonImporter.import(fileOf('nope'))).rejects.toThrow(/valid JSON/);
    await expect(jsonImporter.import(fileOf(JSON.stringify({ ...createEmptyProject(), version: 99 })))).rejects.toThrow(/newer version/);
  });
});

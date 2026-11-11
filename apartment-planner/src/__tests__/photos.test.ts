import { describe, expect, it } from 'vitest';
import { describePieces, usableSuggestions } from '../ai/labelFromPhotos';
import { createDemoProject } from '../demo/demoProject';

describe('photo suggestions', () => {
  it('describes each piece with its room and size', () => {
    const p = createDemoProject();
    const d = describePieces(p);
    expect(d).toHaveLength(p.furniture.length);
    const bed = d.find((x) => x.kind === 'bed')!;
    expect(bed).toMatchObject({ room: 'Bedroom', widthIn: 64, depthIn: 86 });
    expect(d.find((x) => x.currentName === 'Television')!.wallMounted).toBe(true);
  });
  it('drops unknown ids, unseen pieces and bad colors', () => {
    const p = createDemoProject();
    const [a, b, c] = p.furniture;
    const u = usableSuggestions(p, {
      pieces: [
        { id: a.id, visible: true, name: '  Wool rug  ', color: '#AABBCC', note: '' },
        { id: b.id, visible: false, name: 'Guess', color: '#000000', note: '' },
        { id: c.id, visible: true, name: 'Table', color: 'brown', note: '' },
        { id: 'made-up', visible: true, name: 'Ghost', color: '#111111', note: '' },
      ],
      floorColor: 'oak',
      wallColor: '#F0F0F0',
    });
    expect(u.pieces.map((x) => [x.name, x.color])).toEqual([['Wool rug', '#aabbcc'], ['Table', null]]);
    expect(u.floorColor).toBeNull();
    expect(u.wallColor).toBe('#f0f0f0');
  });
});

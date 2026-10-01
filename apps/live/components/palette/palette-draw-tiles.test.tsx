import { describe, expect, it } from 'vitest';
import { PALETTE_TILES } from './palette-tile-defs';
import { tileActive } from './PaletteTileGrid';
import type { PendingDraw } from '@/lib/draw-mode';

// The whiteboard's pens in the Draw category (docs/specs/008-canvas/canvas-and-palette.md): the Path
// tool and the three markers sit after the Shape Pen, and each tile shows pressed for its own tool
// only.

const tile = (id: string) => PALETTE_TILES.find((t) => t.id === id)!;
const marker = (penId: 'main' | 'second' | 'third'): PendingDraw => ({
  type: 'freehand',
  variant: 'whiteboard',
  colour: null,
  width: 1.5,
  recognise: false,
  penId,
});

describe('the Draw category', () => {
  it('lists the markers first, then the Path tool, Arrow and Polygon, then the pencils', () => {
    const draw = PALETTE_TILES.filter((t) => t.toolGroup === 'draw').map((t) => t.id);
    expect(draw).toEqual([
      'tools:marker-1',
      'tools:marker-2',
      'tools:marker-3',
      'tools:path',
      'tools:arrow',
      'tools:polygon',
      'tools:pencil',
      'tools:shape-pen',
    ]);
  });

  it('gives the new tools no keys, so P and 6 stay the pencil and the Shape Pen', () => {
    for (const id of ['tools:path', 'tools:marker-1', 'tools:marker-2', 'tools:marker-3'])
      expect(tile(id).shortcut).toBeUndefined();
  });

  it('lights a marker tile only for its own marker', () => {
    expect(tileActive(tile('tools:marker-2'), marker('second'))).toBe(true);
    expect(tileActive(tile('tools:marker-1'), marker('second'))).toBe(false);
    expect(tileActive(tile('tools:marker-3'), marker('second'))).toBe(false);
    // The plain pencil is a different freehand variant.
    expect(tileActive(tile('tools:pencil'), marker('second'))).toBe(false);
  });

  it('lights the Path tool tile for the Path tool only', () => {
    expect(tileActive(tile('tools:path'), { type: 'path' })).toBe(true);
    expect(tileActive(tile('tools:path'), marker('main'))).toBe(false);
    expect(tileActive(tile('tools:marker-1'), { type: 'path' })).toBe(false);
  });
});

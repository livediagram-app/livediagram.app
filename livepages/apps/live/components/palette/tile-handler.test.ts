// A tile pressed again while its tool is armed puts the tool down (docs/specs/008-canvas/canvas-and-palette.md
// "Placement on add").
import { describe, expect, it, vi } from 'vitest';
import { tileHandler, type PaletteTileActions } from './PaletteTileGrid';

const actions = () =>
  ({
    addShape: vi.fn(),
    beginPolygon: vi.fn(),
    cancelDraw: vi.fn(),
  }) as unknown as PaletteTileActions & {
    addShape: ReturnType<typeof vi.fn>;
    beginPolygon: ReturnType<typeof vi.fn>;
    cancelDraw: ReturnType<typeof vi.fn>;
  };

const square = {
  id: 'square',
  label: 'Square',
  action: { type: 'shape', kind: 'square' },
} as never;
const polygon = { id: 'polygon', label: 'Polygon', action: { type: 'polygon' } } as never;

describe('a palette tile pressed', () => {
  it('arms its tool, and puts it down when pressed again while armed', () => {
    const a = actions();
    tileHandler(square, a, null)();
    expect(a.addShape).toHaveBeenCalledTimes(1);
    tileHandler(square, a, { type: 'shape', kind: 'square' } as never)();
    expect(a.cancelDraw).toHaveBeenCalledTimes(1);
    expect(a.addShape).toHaveBeenCalledTimes(1);
    tileHandler(polygon, a, { type: 'polygon' } as never)();
    expect(a.cancelDraw).toHaveBeenCalledTimes(2);
  });

  it('arms another tool over an armed one', () => {
    const a = actions();
    tileHandler(polygon, a, { type: 'shape', kind: 'square' } as never)();
    expect(a.beginPolygon).toHaveBeenCalled();
    expect(a.cancelDraw).not.toHaveBeenCalled();
  });
});

describe('a shape tile pressed', () => {
  it('hands on its own name, so the banner reads as the tile does', () => {
    const a = actions();
    const funnel = {
      id: 'funnel',
      label: 'Add Funnel',
      caption: 'Funnel',
      action: { type: 'shape', kind: 'pyramid', variant: 'funnel' },
    } as never;
    tileHandler(funnel, a, null)();
    expect(a.addShape).toHaveBeenCalledWith(
      'pyramid',
      expect.objectContaining({ variant: 'funnel', name: 'Funnel' }),
    );
    tileHandler({ ...(square as object), label: 'Add Square' } as never, a, null)();
    expect(a.addShape).toHaveBeenLastCalledWith(
      'square',
      expect.objectContaining({ name: 'Square' }),
    );
  });
});

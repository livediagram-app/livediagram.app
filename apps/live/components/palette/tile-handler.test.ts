// A tile pressed again while its tool is armed puts the tool down (docs/specs/008-canvas/canvas-and-palette.md
// "Placement on add"); a marker keeps its press.
import { describe, expect, it, vi } from 'vitest';
import { tileHandler, type PaletteTileActions } from './PaletteTileGrid';

const actions = () =>
  ({
    addShape: vi.fn(),
    beginFreehand: vi.fn(),
    beginMarker: vi.fn(),
    cancelDraw: vi.fn(),
  }) as unknown as PaletteTileActions & {
    addShape: ReturnType<typeof vi.fn>;
    beginFreehand: ReturnType<typeof vi.fn>;
    beginMarker: ReturnType<typeof vi.fn>;
    cancelDraw: ReturnType<typeof vi.fn>;
  };

const square = {
  id: 'square',
  label: 'Square',
  action: { type: 'shape', kind: 'square' },
} as never;
const pen = { id: 'pen', label: 'Pen', action: { type: 'freehand' } } as never;
const marker = { id: 'm', label: 'Marker', action: { type: 'marker', penId: 'marker' } } as never;

describe('a palette tile pressed', () => {
  it('arms its tool, and puts it down when pressed again while armed', () => {
    const a = actions();
    tileHandler(square, a, null)();
    expect(a.addShape).toHaveBeenCalledTimes(1);
    tileHandler(square, a, { type: 'shape', kind: 'square' } as never)();
    expect(a.cancelDraw).toHaveBeenCalledTimes(1);
    expect(a.addShape).toHaveBeenCalledTimes(1);
    tileHandler(pen, a, { type: 'freehand' } as never)();
    expect(a.cancelDraw).toHaveBeenCalledTimes(2);
  });

  it('arms another tool over an armed one, and leaves a marker its own press', () => {
    const a = actions();
    tileHandler(pen, a, { type: 'shape', kind: 'square' } as never)();
    expect(a.beginFreehand).toHaveBeenCalled();
    tileHandler(marker, a, { type: 'freehand' } as never)();
    expect(a.beginMarker).toHaveBeenCalledWith('marker');
    expect(a.cancelDraw).not.toHaveBeenCalled();
  });
});

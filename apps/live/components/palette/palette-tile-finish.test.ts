import { describe, expect, it } from 'vitest';
import { paletteFinishClass, tileTakesFinish } from './palette-tile-finish';
import { PALETTE_TILES } from './palette-tile-defs';

// Palette tiles in the tab's finish (docs/specs/008-canvas/finish.md "Where it shows").
describe('tileTakesFinish', () => {
  const action = (id: string) => PALETTE_TILES.find((t) => t.id === id)!.action;

  it('takes plain shapes and the text, sticky, arrow and table tiles', () => {
    expect(tileTakesFinish(action('shapes:square'))).toBe(true);
    expect(tileTakesFinish(action('shapes:circle'))).toBe(true);
    for (const type of ['text', 'sticky', 'arrow', 'table'] as const) {
      const tile = PALETTE_TILES.find((t) => t.action.type === type);
      expect(tile, type).toBeDefined();
      expect(tileTakesFinish(tile!.action), type).toBe(true);
    }
  });

  it('leaves media, tools and self-painting faces as drawn', () => {
    for (const type of ['image', 'video', 'freehand', 'link-card'] as const) {
      const tile = PALETTE_TILES.find((t) => t.action.type === type);
      if (tile) expect(tileTakesFinish(tile.action), type).toBe(false);
    }
    expect(tileTakesFinish({ type: 'shape', kind: 'icon' } as never)).toBe(false);
    expect(tileTakesFinish({ type: 'shape', kind: 'progress-bar' } as never)).toBe(false);
  });
});

describe('paletteFinishClass', () => {
  it('names a class for Professional and Sketch, none for Flexible', () => {
    expect(paletteFinishClass('professional')).toBe('palette-finish-professional');
    expect(paletteFinishClass('sketch')).toBe('palette-finish-sketch');
    expect(paletteFinishClass('flexible')).toBe('');
    expect(paletteFinishClass(undefined)).toBe('');
  });
});

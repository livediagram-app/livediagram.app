import { describe, expect, it } from 'vitest';
import { paletteFinishClass, tileEnterAnimation } from './palette-tile-finish';

// Palette tiles in the tab's finish (docs/specs/008-canvas/finish.md "Where it shows").
describe('paletteFinishClass', () => {
  it('names a class for Professional, Sketch and Marker, none for Flexible', () => {
    expect(paletteFinishClass('professional')).toBe('palette-finish-professional');
    expect(paletteFinishClass('sketch')).toBe('palette-finish-sketch');
    expect(paletteFinishClass('marker')).toBe('palette-finish-marker');
    expect(paletteFinishClass('flexible')).toBe('');
    expect(paletteFinishClass(undefined)).toBe('');
  });

  it('wobbles full-colour art under Sketch but leaves its weight under Professional', () => {
    for (const action of [{ type: 'sticker' }, { type: 'tech-icon' }] as const) {
      expect(paletteFinishClass('sketch', action)).toBe('palette-finish-sketch');
      expect(paletteFinishClass('professional', action)).toBe('');
    }
    for (const action of [{ type: 'sticker' }, { type: 'tech-icon' }] as const)
      expect(paletteFinishClass('marker', action)).toBe('');
    expect(paletteFinishClass('marker', { type: 'icon' })).toBe('palette-finish-marker');
    expect(paletteFinishClass('professional', { type: 'icon' })).toBe(
      'palette-finish-professional',
    );
  });
});

// docs/specs/008-canvas/finish.md "Where it shows": a Sketch glyph is filtered, and a filtered glyph inside a scaling
// pop-in could stay rasterised small and blurred, so Sketch tiles fade in.
describe('tileEnterAnimation', () => {
  it('fades a Sketch tile in and pops every other finish in', () => {
    expect(tileEnterAnimation('sketch')).toBe('animate-fade-in');
    for (const finish of [undefined, 'flexible', 'professional', 'marker'] as const)
      expect(tileEnterAnimation(finish), String(finish)).toBe('animate-pop-in');
  });
});

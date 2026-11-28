import { describe, expect, it } from 'vitest';
import { SCREEN_VARIANTS } from '@livehuddle/document';
import { PALETTE_TILES } from './palette-tile-defs';
import { SCREEN_PRESET_TILES } from './palette-screen-presets';
import { pieceTypeChoices } from './piece-type-tiles';

// docs/specs/009-elements/screen-and-room-sign.md "Sizes": Meet's Screen tile opens five sizes, smallest first, and a
// placed Screen's Type section offers the same five.

const tile = (id: string) => PALETTE_TILES.find((t) => t.id === id)!;

describe('the screen size tiles', () => {
  it('hang under the Screen tile, smallest first, the Medium placing a plain Screen', () => {
    expect(tile('tools:screen').variants).toBe(SCREEN_PRESET_TILES);
    expect(tile('tools:screen').variantsHint).toBeTruthy();
    expect(SCREEN_PRESET_TILES.map((t) => (t.action as { variant?: string }).variant)).toEqual([
      'monitor',
      'small',
      undefined,
      'large',
      'cinema',
    ]);
    for (const t of SCREEN_PRESET_TILES) {
      expect(t.action).toMatchObject({ type: 'shape', kind: 'screen' });
      expect(t.icon).toBeTruthy();
    }
    expect(PALETTE_TILES.some((t) => t.id === 'tools:screen-cinema')).toBe(false);
  });

  it("offers every size in a Screen's Type section, named as its tile", () => {
    const types = pieceTypeChoices('screen').map((c) => c.type);
    expect([...types].sort()).toEqual([...SCREEN_VARIANTS].sort());
    expect(pieceTypeChoices('screen').map((c) => c.label)).toEqual([
      'Monitor',
      'Small',
      'Medium',
      'Large',
      'Cinema',
    ]);
  });
});

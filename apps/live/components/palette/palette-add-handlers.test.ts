// The shared palette add-handler set (spec/148).
import { describe, expect, it } from 'vitest';
import {
  PALETTE_ADD_HANDLER_KEYS,
  pickPaletteAddHandlers,
  type PaletteAddHandlers,
} from './palette-add-handlers';

describe('pickPaletteAddHandlers', () => {
  it('keeps every add-handler and nothing else', () => {
    const bag = Object.fromEntries([
      ...PALETTE_ADD_HANDLER_KEYS.map((k) => [k, () => k]),
      ['onUndo', () => 'undo'],
      ['readOnly', true],
    ]) as unknown as PaletteAddHandlers;
    const picked = pickPaletteAddHandlers(bag);
    expect(Object.keys(picked).sort()).toEqual([...PALETTE_ADD_HANDLER_KEYS].sort());
    for (const k of PALETTE_ADD_HANDLER_KEYS) expect(picked[k]).toBe(bag[k]);
  });

  it('keeps an optional handler that is absent as absent', () => {
    const bag = Object.fromEntries(
      PALETTE_ADD_HANDLER_KEYS.filter((k) => k !== 'onAddImage').map((k) => [k, () => k]),
    ) as unknown as PaletteAddHandlers;
    // No image uploads on this deployment: the image tiles must still hide.
    expect(pickPaletteAddHandlers(bag).onAddImage).toBeUndefined();
  });
});

import { describe, expect, it } from 'vitest';
import { PALETTE_CATEGORIES } from './palette-categories';
import { openerById } from './palette-openers';

// docs/specs/007-editor/editor-modes.md "The palette per mode": an opener stands for a whole category.
describe('openerById', () => {
  it("draws its category's glyph and opens that category", () => {
    const opener = openerById('open:collab-ask')!;
    expect(opener.icon).toBe(PALETTE_CATEGORIES.find((c) => c.id === 'collab-ask')!.icon);
    expect(opener.action).toEqual({ type: 'open', category: 'collab-ask' });
  });

  it('is undefined for a tile id', () => {
    expect(openerById('rect')).toBeUndefined();
  });
});

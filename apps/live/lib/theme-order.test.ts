import { describe, expect, it } from 'vitest';
import { THEMES } from '@livediagram/diagram';
import { LEAD_THEME_IDS, isLeadTheme, shuffledThemes } from './theme-order';
import { themeCategory } from './themes-taxonomy';

// The picker SHUFFLES its themes on each open, so that a different set greets
// the user each time. That rotation is deliberate — but it also meant the
// Dark category opened on whichever dark theme chance picked, and an earlier
// attempt to make Charcoal lead by reordering the catalogue array did
// nothing at all, invisibly, because the array order is thrown away here.
//
// Leads are pinned THROUGH the shuffle: Basic for the whole catalogue,
// Charcoal for the Dark category.
describe('shuffledThemes', () => {
  const rng = () => 0.42; // deterministic

  it('opens the Dark category on Charcoal, every time', () => {
    for (let i = 0; i < 25; i++) {
      const dark = shuffledThemes(THEMES)
        .filter((t) => t.id !== 'brand' && themeCategory(t.id) === 'dark')
        .map((t) => t.id);
      expect(dark[0]).toBe('charcoal');
    }
  });

  it('still leads the whole catalogue with Basic', () => {
    expect(shuffledThemes(THEMES, rng)[0]!.id).toBe('brand');
  });

  it('still rotates everything that is not a lead', () => {
    const orders = new Set<string>();
    for (let i = 0; i < 40; i++) {
      orders.add(
        shuffledThemes(THEMES)
          .map((t) => t.id)
          .join(),
      );
    }
    // 40 shuffles of 27 themes landing on one order would mean no shuffle.
    expect(orders.size).toBeGreaterThan(1);
  });

  it('names the leads it pins', () => {
    expect(isLeadTheme('brand')).toBe(true);
    expect(isLeadTheme('charcoal')).toBe(true);
    expect(isLeadTheme('midnight')).toBe(false);
    expect([...LEAD_THEME_IDS]).toEqual(['brand', 'charcoal']);
  });
});

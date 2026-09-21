import { describe, expect, it } from 'vitest';
import { THEMES } from '@livediagram/diagram';
import { LEAD_THEME_IDS, darkCategorySchemes, isLeadTheme, shuffledThemes } from './theme-order';
import { themeCategory } from './themes-taxonomy';

// The picker SHUFFLES its themes on each open, so that a different set
// greets the user each time. That rotation is deliberate — but it also meant
// the Dark category opened on whichever dark scheme chance picked, and an
// earlier attempt to make the neutral dark lead by reordering the catalogue
// array did nothing at all, invisibly, because the array order is thrown away
// here.
//
// Leads are pinned THROUGH the shuffle: Default for the whole catalogue, and
// Default again at the head of the Dark category, where Charcoal used to sit
// before the two merged into one scheme.
describe('shuffledThemes', () => {
  const rng = () => 0.42; // deterministic

  it('still leads the whole catalogue with Default', () => {
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
    // 40 shuffles of the catalogue landing on one order would mean no shuffle.
    expect(orders.size).toBeGreaterThan(1);
  });

  it('names the leads it pins', () => {
    expect(isLeadTheme('brand')).toBe(true);
    expect(isLeadTheme('midnight')).toBe(false);
    expect([...LEAD_THEME_IDS]).toEqual(['brand']);
  });
});

describe('darkCategorySchemes', () => {
  it('opens the Dark category on Default, every time', () => {
    for (let i = 0; i < 25; i++) {
      expect(darkCategorySchemes(shuffledThemes(THEMES))[0]?.id).toBe('brand');
    }
  });

  it('lists the dark canvases behind it, and nothing else', () => {
    const rest = darkCategorySchemes(THEMES).slice(1);
    expect(rest.length).toBeGreaterThan(0);
    for (const scheme of rest) {
      expect(themeCategory(scheme.id)).toBe('dark');
    }
  });

  it('shows Default as its dark half, so the card matches its company', () => {
    expect(darkCategorySchemes(THEMES)[0]?.backgroundColor).toBe('#2b2b33');
  });
});

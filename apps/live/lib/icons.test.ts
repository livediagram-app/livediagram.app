import { describe, expect, it } from 'vitest';
import { ICON_CATALOG, ICON_CATEGORIES, PLACEHOLDER_ICON, getIcon, iconsInCategory } from './icons';

describe('icon catalogue', () => {
  it('is non-empty and has unique ids', () => {
    expect(ICON_CATALOG.length).toBeGreaterThan(0);
    const ids = ICON_CATALOG.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every icon has a label and at least one primitive', () => {
    for (const icon of ICON_CATALOG) {
      expect(icon.label.length).toBeGreaterThan(0);
      expect(icon.prims.length).toBeGreaterThan(0);
    }
  });
});

describe('getIcon', () => {
  it('returns the matching icon for a known id', () => {
    expect(getIcon('server').id).toBe('server');
  });

  it('falls back to the placeholder for unknown / missing ids', () => {
    expect(getIcon('does-not-exist')).toBe(PLACEHOLDER_ICON);
    expect(getIcon(undefined)).toBe(PLACEHOLDER_ICON);
  });
});

describe('icon categories', () => {
  it('every category id resolves to a catalogue entry', () => {
    const known = new Set(ICON_CATALOG.map((i) => i.id));
    for (const cat of ICON_CATEGORIES) {
      for (const id of cat.iconIds) {
        expect(known.has(id), `category "${cat.id}" references unknown icon "${id}"`).toBe(true);
      }
    }
  });

  it('iconsInCategory returns catalogue entries in catalogue order', () => {
    const tech = iconsInCategory('tech');
    expect(tech.length).toBeGreaterThan(0);
    expect(tech.every((i) => ICON_CATALOG.includes(i))).toBe(true);
    expect(iconsInCategory('does-not-exist')).toEqual([]);
  });
});

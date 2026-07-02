import { beforeAll, describe, expect, it } from 'vitest';
import {
  getIconCatalog,
  ICON_CATEGORIES,
  PLACEHOLDER_ICON,
  getIcon,
  iconsInCategory,
} from './icons';
import { ensureIconCatalogs } from './icon-registry';

// The catalogue data lives in an async chunk (lib/icon-registry.ts); load it
// once up front so these tests exercise the loaded state. The pre-load
// (placeholder) behaviour is covered in icon-registry.test.ts, which runs in
// its own module graph and can observe the not-yet-loaded registry.
beforeAll(async () => {
  await ensureIconCatalogs();
});

describe('icon catalogue', () => {
  it('is non-empty and has unique ids', () => {
    const catalog = getIconCatalog();
    expect(catalog.length).toBeGreaterThan(0);
    const ids = catalog.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every icon has a label and at least one primitive', () => {
    for (const icon of getIconCatalog()) {
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
    const known = new Set(getIconCatalog().map((i) => i.id));
    for (const cat of ICON_CATEGORIES) {
      for (const id of cat.iconIds) {
        expect(known.has(id), `category "${cat.id}" references unknown icon "${id}"`).toBe(true);
      }
    }
  });

  it('iconsInCategory returns catalogue entries in catalogue order', () => {
    const catalog = getIconCatalog();
    const tech = iconsInCategory('tech');
    expect(tech.length).toBeGreaterThan(0);
    expect(tech.every((i) => catalog.includes(i))).toBe(true);
    expect(iconsInCategory('does-not-exist')).toEqual([]);
  });
});

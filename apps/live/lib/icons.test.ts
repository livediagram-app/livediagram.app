import { beforeAll, describe, expect, it } from 'vitest';
import { isStickerId } from '@livediagram/icons';
import {
  getIconCatalog,
  getLineArtIconCatalog,
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

  // The sticker entries (spec/116) share this catalogue but have their own
  // palette category; their geometry, grouping and search are pinned in
  // stickers.test.ts. What matters here is that the line-art half — the only
  // half the Icons tab shows — is the one everything below reasons about.
  it('getLineArtIconCatalog is the catalogue minus the stickers', () => {
    const all = getIconCatalog();
    const lineArt = getLineArtIconCatalog();
    expect(lineArt.length).toBeGreaterThan(0);
    expect(lineArt.some((i) => isStickerId(i.id))).toBe(false);
    expect(all.length - lineArt.length).toBe(all.filter((i) => isStickerId(i.id)).length);
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

  it('puts every line-art icon in exactly one category', () => {
    // The Icons tab browses BY category since spec/109 — there is no longer
    // an "All" filter to fall back on, so an icon in no category is an icon
    // nobody can reach except by guessing its name in the search box.
    // Stickers are exempt because they are not in this tab at all (spec/116);
    // stickers.test.ts holds them to the same rule against their own groups.
    const seen = new Map<string, string[]>();
    for (const cat of ICON_CATEGORIES) {
      for (const id of cat.iconIds) seen.set(id, [...(seen.get(id) ?? []), cat.id]);
    }
    const orphans = getLineArtIconCatalog()
      .map((i) => i.id)
      .filter((id) => !seen.has(id));
    expect(orphans, 'icons in no ICON_CATEGORIES entry are unreachable in the palette').toEqual([]);
    // Two categories claiming one icon would show it twice; harmless, but it
    // always means one of the two lists is wrong.
    const duplicated = [...seen].filter(([, cats]) => cats.length > 1);
    expect(duplicated).toEqual([]);
  });

  it('iconsInCategory returns catalogue entries in catalogue order', () => {
    const catalog = getIconCatalog();
    const tech = iconsInCategory('tech');
    expect(tech.length).toBeGreaterThan(0);
    expect(tech.every((i) => catalog.includes(i))).toBe(true);
    expect(iconsInCategory('does-not-exist')).toEqual([]);
  });
});

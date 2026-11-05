import { beforeAll, describe, expect, it } from 'vitest';
import { PLACEHOLDER_ICON, getIcon } from './icons';
import {
  ensureIconCatalogs,
  getLoadedIconCatalog,
} from '@liveworkspace/workbench/lib/icon-registry';

// The catalogue data lives in an async chunk (@liveworkspace/workbench/lib/icon-registry.ts); load it
// once up front so these tests exercise the loaded state. The pre-load
// (placeholder) behaviour is covered in icon-registry.test.ts, which runs in
// its own module graph and can observe the not-yet-loaded registry.
beforeAll(async () => {
  await ensureIconCatalogs();
});

describe('icon catalogue', () => {
  it('is non-empty and has unique ids', () => {
    const catalog = getLoadedIconCatalog();
    expect(catalog.length).toBeGreaterThan(0);
    const ids = catalog.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every icon has a label and at least one primitive', () => {
    for (const icon of getLoadedIconCatalog()) {
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

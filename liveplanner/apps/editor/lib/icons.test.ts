import { beforeAll, describe, expect, it } from 'vitest';
import { PLACEHOLDER_ICON, getIcon } from './icons';
import { ensureIconCatalogs } from './icon-registry';

// The catalogue data lives in an async chunk (lib/icon-registry.ts); load it
// once up front so these tests exercise the loaded state. The pre-load
// (placeholder) behaviour is covered in icon-registry.test.ts, which runs in
// its own module graph and can observe the not-yet-loaded registry.
beforeAll(async () => {
  await ensureIconCatalogs();
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

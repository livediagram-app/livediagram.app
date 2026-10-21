import { describe, expect, it } from 'vitest';

import { TIER_APPS, inTier, parseTier } from './apps.ts';

describe('tiers', () => {
  it('a Preview deploys every site but the api; a Full preview adds the api', () => {
    expect(TIER_APPS.preview).not.toContain('api');
    expect(TIER_APPS.full).toEqual(expect.arrayContaining([...TIER_APPS.preview, 'api']));
  });

  it('never deploys mcp, and the router is last so its bindings exist', () => {
    for (const apps of Object.values(TIER_APPS)) {
      expect(apps).not.toContain('mcp');
      expect(apps.at(-1)).toBe('router');
    }
  });

  it('inTier answers for any app name', () => {
    expect(inTier('api', 'full')).toBe(true);
    expect(inTier('api', 'preview')).toBe(false);
    expect(inTier('mcp', 'full')).toBe(false);
  });

  it('parseTier accepts exactly the two tiers', () => {
    expect(parseTier('preview')).toBe('preview');
    expect(parseTier('full')).toBe('full');
    expect(() => parseTier('')).toThrow(/unknown preview tier/);
  });
});

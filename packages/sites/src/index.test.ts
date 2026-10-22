import { describe, expect, it } from 'vitest';
import { PLATFORM_SITE, SITES } from './index';

describe('sites', () => {
  it('lists liveworkspace first, then each app once, each on its own https origin', () => {
    expect(SITES[0]).toBe(PLATFORM_SITE);
    expect(new Set(SITES.map((s) => s.id)).size).toBe(SITES.length);
    for (const site of SITES) {
      // The platform is on its bare domain; links to an app always use www.
      const host = site.id === 'liveworkspace.app' ? site.id : `www.${site.id}`;
      expect(new URL(site.url).origin).toBe(`https://${host}`);
      expect(site.accent).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

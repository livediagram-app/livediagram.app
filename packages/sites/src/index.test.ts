import { describe, expect, it } from 'vitest';
import { LOCAL_PORTS, PLATFORM_SITE, SITES, siteUrl } from './index';

describe('sites', () => {
  it('lists liveworkspace first, then each app once, each on its own https origin', () => {
    expect(SITES[0]).toBe(PLATFORM_SITE);
    expect(new Set(SITES.map((s) => s.id)).size).toBe(SITES.length);
    for (const site of SITES) {
      // The platform is on its bare domain; links to an app always use www.
      const host = site.id === 'liveworkspace.app' ? site.id : `www.${site.id}`;
      expect(new URL(site.url).origin).toBe(`https://${host}`);
      expect(site.accent).toMatch(/^#[0-9a-f]{6}$/);
      expect(site.deep).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('links to each site on its own local port when running locally', () => {
    expect(siteUrl('livediagram.app', 'https://www.livediagram.app', true)).toBe(
      'http://localhost:3100',
    );
    expect(siteUrl('livediagram.app', 'https://www.livediagram.app', false)).toBe(
      'https://www.livediagram.app',
    );
    // One port block of a hundred per site, in the list's order.
    expect(SITES.map((s) => LOCAL_PORTS[s.id])).toEqual([3000, 3100, 3200, 3300, 3400]);
  });
});

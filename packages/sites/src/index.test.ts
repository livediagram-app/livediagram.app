import { describe, expect, it } from 'vitest';
import { LOCAL_PORTS, PLATFORM_SITE, SITES, siteUrl, workspaceOriginFor } from './index';

describe('workspaceOriginFor', () => {
  it("is staging's site from a staging app, else the platform's", () => {
    expect(workspaceOriginFor('staging.liveplanner.app')).toBe(
      'https://liveworkspace-gateway-staging.liveworkspace-easing509.workers.dev',
    );
    expect(workspaceOriginFor('www.livediagram.app')).toBe(PLATFORM_SITE.url);
    expect(workspaceOriginFor('')).toBe(PLATFORM_SITE.url);
  });
});

describe('sites', () => {
  it('lists liveworkspace first, then each app once, each on its own https origin', () => {
    expect(SITES[0]).toBe(PLATFORM_SITE);
    expect(new Set(SITES.map((s) => s.id)).size).toBe(SITES.length);
    for (const site of SITES) {
      // The platform is on its stand-in origin until liveworkspace.app moves (liveworkspace/docs/gateway.md);
      // links to an app always use www.
      // So is livediagram until livediagram.app moves (livediagram/docs/specs/016-platform/stand-in-addresses.md).
      const origin =
        site.id === 'liveworkspace.app'
          ? 'https://liveworkspace-gateway.liveworkspace-easing509.workers.dev'
          : site.id === 'livediagram.app'
            ? 'https://livediagram-router.liveworkspace-easing509.workers.dev'
            : `https://www.${site.id}`;
      expect(new URL(site.url).origin).toBe(origin);
      expect(site.accent).toMatch(/^#[0-9a-f]{6}$/);
      expect(site.deep).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('links to each site on its own local port when running locally', () => {
    expect(
      siteUrl(
        'livediagram.app',
        'https://livediagram-router.liveworkspace-easing509.workers.dev',
        true,
      ),
    ).toBe('http://localhost:3100');
    expect(
      siteUrl(
        'livediagram.app',
        'https://livediagram-router.liveworkspace-easing509.workers.dev',
        false,
      ),
    ).toBe('https://livediagram-router.liveworkspace-easing509.workers.dev');
    // One port block of a hundred per site, in the list's order.
    expect(SITES.map((s) => LOCAL_PORTS[s.id])).toEqual([3000, 3100, 3200, 3300, 3400]);
  });
});

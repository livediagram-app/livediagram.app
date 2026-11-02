import { describe, expect, it } from 'vitest';
import {
  appOfAnyOrigin,
  appOfOrigin,
  appOrigins,
  siteHrefFrom,
  stagingOrigin,
} from './app-origins';
import { APP_SITES, PLATFORM_SITE, SITES } from './index';

describe("each app's origins", () => {
  it('are its bare and www hosts in production, staging. on staging, its router port locally', () => {
    expect(appOrigins('liveplanner.app', 'production')).toEqual([
      'https://liveplanner.app',
      'https://www.liveplanner.app',
    ]);
    expect(appOrigins('livediagram.app', 'production')).toEqual([
      'https://livediagram.app',
      'https://www.livediagram.app',
    ]);
    expect(appOrigins('livediagram.app', 'staging')).toEqual(['https://staging.livediagram.app']);
    expect(appOrigins('liveplanner.app', 'staging')).toEqual(['https://staging.liveplanner.app']);
    expect(appOrigins('livedesign.app', 'development')).toContain('http://localhost:3400');
  });

  it('match exactly, in their own environment only', () => {
    expect(appOfOrigin('https://www.livedocuments.app', 'production')).toBe('livedocuments.app');
    expect(appOfOrigin('https://www.livedocuments.app/path?x', 'production')).toBe(
      'livedocuments.app',
    );
    expect(appOfOrigin('http://localhost:3100', 'production')).toBeNull();
    expect(appOfOrigin('https://staging.livediagram.app', 'production')).toBeNull();
    expect(appOfOrigin('https://livediagram.app.evil.example', 'production')).toBeNull();
    expect(
      appOfOrigin('https://livediagram-router.liveworkspace-easing509.workers.dev', 'production'),
    ).toBeNull();
    expect(appOfOrigin('https://evil.livediagram.app', 'production')).toBeNull();
    expect(appOfOrigin('http://livediagram.app', 'production')).toBeNull();
    expect(appOfOrigin('https://liveworkspace.app', 'production')).toBeNull();
    expect(appOfOrigin('not a url', 'production')).toBeNull();
    expect(appOfAnyOrigin('http://localhost:3200')).toBe('liveplanner.app');
    expect(appOfAnyOrigin('http://localhost:3000')).toBeNull();
  });
});

describe('a link to a site from a staging page', () => {
  const planner = APP_SITES.find((s) => s.id === 'liveplanner.app')!;
  const diagram = APP_SITES.find((s) => s.id === 'livediagram.app')!;

  it("goes to that site's staging origin", () => {
    expect(stagingOrigin('liveworkspace.app')).toBe('https://staging.liveworkspace.app');
    expect(stagingOrigin('liveplanner.app')).toBe('https://staging.liveplanner.app');
    expect(stagingOrigin('livediagram.app')).toBe('https://staging.livediagram.app');
    for (const host of [
      'staging.liveworkspace.app',
      'staging.livedesign.app',
      'staging.livediagram.app',
    ]) {
      expect(siteHrefFrom(planner, planner.url, host)).toBe('https://staging.liveplanner.app');
      expect(siteHrefFrom(PLATFORM_SITE, PLATFORM_SITE.url, host)).toBe(
        'https://staging.liveworkspace.app',
      );
    }
  });

  it("keeps the path and query of a link (the Explorer's)", () => {
    expect(
      siteHrefFrom(diagram, `${diagram.url}/explorer/timeline?id=t1`, 'staging.liveplanner.app'),
    ).toBe('https://staging.livediagram.app/explorer/timeline?id=t1');
  });

  it('leaves every link alone off staging, and before the host is known', () => {
    for (const host of ['liveworkspace.app', 'www.liveplanner.app', 'localhost:3000', '']) {
      for (const site of SITES) expect(siteHrefFrom(site, site.url, host)).toBe(site.url);
    }
    // A link that isn't on the site's own origin is left as it is.
    expect(siteHrefFrom(planner, 'https://example.com/x', 'staging.liveplanner.app')).toBe(
      'https://example.com/x',
    );
  });
});

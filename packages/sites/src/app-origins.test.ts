import { describe, expect, it, vi } from 'vitest';
import {
  appOfAnyOrigin,
  appOfOrigin,
  appOrigins,
  isLiveEmbedFrameRequest,
  liveEmbedFrameAncestors,
  siteHrefFrom,
  siteUrlFrom,
  siteUrlHere,
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
      siteHrefFrom(diagram, `${diagram.url}/explorer/inbox?id=t1`, 'staging.liveplanner.app'),
    ).toBe('https://staging.livediagram.app/explorer/inbox?id=t1');
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

// live-embeds.md "Framed by our apps alone" (Work Tracker 1427).
describe("a live embed frame's frame-ancestors", () => {
  const at = (href: string) => liveEmbedFrameAncestors(new URL(href));

  it('names only the frame page with the live flag', () => {
    expect(
      isLiveEmbedFrameRequest(new URL('https://www.liveplanner.app/embed/workbench?d=p&live=1')),
    ).toBe(true);
    expect(
      isLiveEmbedFrameRequest(new URL('https://www.liveplanner.app/embed/workbench/?d=p&live=1')),
    ).toBe(true);
    expect(
      isLiveEmbedFrameRequest(new URL('https://www.liveplanner.app/embed/workbench?d=p')),
    ).toBe(false);
    expect(isLiveEmbedFrameRequest(new URL('https://www.liveplanner.app/embed?s=c&live=1'))).toBe(
      false,
    );
    expect(
      isLiveEmbedFrameRequest(
        new URL('https://www.liveplanner.app/embed/workbench/explorer?live=1'),
      ),
    ).toBe(false);
    expect(at('https://www.liveplanner.app/embed/workbench?d=p')).toBeNull();
  });

  it("is every app's production origins in production, and nothing else", () => {
    const list = at('https://www.liveplanner.app/embed/workbench?d=p&live=1')!.split(' ');
    expect(list[0]).toBe("'self'");
    for (const site of APP_SITES) {
      expect(list).toContain(`https://www.${site.id}`);
      expect(list).toContain(`https://${site.id}`);
    }
    expect(list).toContain('https://www.livehuddle.app');
    expect(list.some((s) => s.includes('staging') || s.includes('localhost') || s === '*')).toBe(
      false,
    );
  });

  it("is staging's apps on staging, and any local port on a loopback frame", () => {
    const staging = at('https://staging.liveplanner.app/embed/workbench?d=p&live=1')!;
    expect(staging).toContain('https://staging.livehuddle.app');
    expect(staging).not.toContain('https://www.');
    expect(at('http://localhost:3201/embed/workbench?d=p&live=1')).toBe(
      "'self' http://localhost:* http://127.0.0.1:*",
    );
  });
});

describe('the address a page reaches a site on', () => {
  const planner = APP_SITES.find((site) => site.id === 'liveplanner.app')!;

  it('is the staging origin from a staging host, the live address from production and local ones', () => {
    expect(siteUrlFrom(planner, 'staging.liveworkspace.app')).toBe(
      'https://staging.liveplanner.app',
    );
    expect(siteUrlFrom(planner, 'www.liveworkspace.app')).toBe(planner.url);
    expect(siteUrlFrom(planner, 'localhost:3200')).toBe(planner.url);
  });

  it('reads the host of the page it runs on, and is the live address with no page', () => {
    expect(siteUrlHere(planner)).toBe(planner.url);
    vi.stubGlobal('window', { location: { host: 'staging.livediagram.app' } });
    expect(siteUrlHere(planner)).toBe('https://staging.liveplanner.app');
    vi.stubGlobal('window', {});
    expect(siteUrlHere(planner)).toBe(planner.url);
    vi.unstubAllGlobals();
  });
});

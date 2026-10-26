import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APP_NAMES } from './index';
import {
  APP_BARE_HOSTS,
  WORKSPACE_PROXY_HEADER,
  WWW_REDIRECT_CACHE_CONTROL,
  workspaceWwwRedirect,
  wwwRedirect,
} from './workspace-proxy';

// Each app's bare domain sends its pages to www. (docs/specs/016-platform/router-app.md "The bare domain").
function answer(
  href: string,
  init: RequestInit = {},
  landsAt?: (url: URL) => string | null,
): Response | null {
  return wwwRedirect(new Request(href, init), new URL(href), landsAt);
}

describe('wwwRedirect', () => {
  it('covers every app’s bare domain, and liveworkspace.app’s is not one', () => {
    expect([...APP_BARE_HOSTS].sort()).toEqual(APP_NAMES.map((app) => `${app}.app`).sort());
    expect(answer('https://liveworkspace.app/')).toBeNull();
  });

  it.each(APP_NAMES)('sends a page on %s.app to www. with one cacheable 301', (app) => {
    const res = answer(`https://${app}.app/`);
    expect(res?.status).toBe(301);
    expect(res?.headers.get('Location')).toBe(`https://www.${app}.app/`);
    expect(res?.headers.get('Cache-Control')).toBe(WWW_REDIRECT_CACHE_CONTROL);
    expect(res?.body).toBeNull();
  });

  it('keeps the path and query of a link, for GET and HEAD', () => {
    for (const method of ['GET', 'HEAD']) {
      for (const path of [
        '/new',
        '/s/abc123?view=present',
        '/join/t0k3n?team=1&x=%2F',
        '/sign-in?client_id=a&sig=b&ba_param=c',
        '/explorer/timeline?id=t1',
        '/_next/static/chunks/app.js',
      ]) {
        expect(answer(`https://liveplanner.app${path}`, { method })?.headers.get('Location')).toBe(
          `https://www.liveplanner.app${path}`,
        );
      }
    }
  });

  it('lands where the router would redirect next, so a bare-domain visit is one hop', () => {
    expect(
      answer(
        'https://livedesign.app/getting-started?x=1',
        {},
        (u) => `/help${u.pathname}`,
      )?.headers.get('Location'),
    ).toBe('https://www.livedesign.app/help/getting-started?x=1');
    expect(answer('https://livedesign.app/pricing', {}, () => null)?.headers.get('Location')).toBe(
      'https://www.livedesign.app/pricing',
    );
    // Asked only when redirecting.
    let asked = 0;
    answer('https://www.livedesign.app/x', {}, () => String(++asked));
    answer('https://livedesign.app/api/x', {}, () => String(++asked));
    expect(asked).toBe(0);
  });

  it('goes to https on the default port, whatever the request came in on', () => {
    expect(answer('http://livedocuments.app:8080/a?b=1')?.headers.get('Location')).toBe(
      'https://www.livedocuments.app/a?b=1',
    );
  });

  it('leaves the APIs, discovery documents and WebSockets on the bare domain', () => {
    for (const path of [
      '/api',
      '/api/auth/callback?code=1&state=2',
      '/api/workspace/auth/sign-in',
      '/api/index/items',
      '/api/share/x/image.png',
      '/.well-known/security.txt',
      '/.well-known/oauth-protected-resource',
    ]) {
      expect(answer(`https://livediagram.app${path}`), path).toBeNull();
    }
    expect(
      answer('https://livediagram.app/rooms/x', { headers: { Upgrade: 'websocket' } }),
    ).toBeNull();
    // A page path that only starts like one is still a page.
    expect(answer('https://livediagram.app/apis')?.status).toBe(301);
  });

  it('leaves any other method alone, so a form or API POST is never turned into a GET', () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
      expect(answer('https://liveplanner.app/new', { method }), method).toBeNull();
    }
  });

  it('never redirects www., staging, stand-in or local hosts, so it cannot loop or leave staging', () => {
    for (const host of [
      'www.liveplanner.app',
      'staging.liveplanner.app',
      'www.staging.liveplanner.app',
      'livediagram-router.liveworkspace-easing509.workers.dev',
      'livediagram-router-staging.liveworkspace-easing509.workers.dev',
      'localhost:3200',
      '127.0.0.1:3100',
      'evil-liveplanner.app',
      'liveplanner.app.evil.com',
      'www.liveworkspace.app',
      'staging.liveworkspace.app',
    ]) {
      expect(answer(`http://${host}/new`), host).toBeNull();
    }
    // Following the redirect lands on a host that does not redirect again.
    const to = answer('https://livedesign.app/x')!.headers.get('Location')!;
    expect(answer(to)).toBeNull();
  });

  it('is what every app’s router answers first, ahead of any page it forwards', () => {
    for (const app of APP_NAMES) {
      const router = readFileSync(
        new URL(`../../../${app}/apps/router/src/index.ts`, import.meta.url),
        'utf8',
      );
      const route = router.slice(router.indexOf('async function route('));
      const www = route.indexOf('wwwRedirect(request, url');
      expect(www, app).toBeGreaterThan(0);
      // Only the redirects that leave the site come before it.
      expect(route.indexOf('routeToWorkspace('), app).toBeGreaterThan(www);
      expect(route.indexOf('forward('), app).toBeGreaterThan(www);
    }
  });
});

// liveworkspace.app's bare domain (liveworkspace/docs/specs/010-site/site.md "www. is the address"), answered by apps/redirect.
describe('workspaceWwwRedirect', () => {
  const on = (href: string, init: RequestInit = {}) =>
    workspaceWwwRedirect(new Request(href, init), new URL(href));

  it('sends a page load to www. in one cacheable 301, path and query kept', () => {
    for (const method of ['GET', 'HEAD']) {
      for (const path of [
        '/',
        '/explorer/recent?x=1',
        '/sign-in?client_id=a&sig=b',
        '/join?token=t0k3n',
        '/drive/connected?code=c&state=s',
        '/_liveworkspace/_next/static/chunks/app.js',
      ]) {
        const res = on(`https://liveworkspace.app${path}`, { method });
        expect(res?.status, path).toBe(301);
        expect(res?.headers.get('Location'), path).toBe(`https://www.liveworkspace.app${path}`);
        expect(res?.headers.get('Cache-Control'), path).toBe(WWW_REDIRECT_CACHE_CONTROL);
      }
    }
  });

  it('never redirects an API, a discovery document, another method, a WebSocket or a router’s forward', () => {
    for (const path of [
      '/api/auth/oauth2/token',
      '/api/auth/jwks',
      '/api/account/teams',
      '/api/index/items',
      '/.well-known/openid-configuration',
      '/.well-known/oauth-authorization-server',
    ]) {
      expect(on(`https://liveworkspace.app${path}`), path).toBeNull();
    }
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
      expect(on('https://liveworkspace.app/sign-in', { method }), method).toBeNull();
    }
    expect(on('https://liveworkspace.app/', { headers: { Upgrade: 'websocket' } })).toBeNull();
    expect(
      on('https://liveworkspace.app/explorer/recent', {
        headers: { [WORKSPACE_PROXY_HEADER]: 'liveplanner' },
      }),
    ).toBeNull();
  });

  it('never redirects www., staging. or local, so it cannot loop or leave staging', () => {
    for (const href of [
      'https://www.liveworkspace.app/',
      'https://staging.liveworkspace.app/',
      'http://localhost:3000/',
      'https://liveplanner.app/',
    ]) {
      expect(on(href), href).toBeNull();
    }
  });
});

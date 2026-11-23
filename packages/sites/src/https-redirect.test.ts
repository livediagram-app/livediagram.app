import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { APP_NAMES } from './index';
import { HTTPS_ONLY_HOSTS, httpsRedirect } from './https-redirect';
import { WWW_REDIRECT_CACHE_CONTROL } from './workspace-proxy';

// Plain HTTP goes to HTTPS (liveworkspace/docs/specs/010-site/site.md "Only over HTTPS").
const answer = (href: string, init: RequestInit = {}) =>
  httpsRedirect(new Request(href, init), new URL(href));

const DOMAINS = [...APP_NAMES.map((app) => `${app}.app`), 'liveworkspace.app'];

describe('httpsRedirect', () => {
  it('covers the bare, www. and staging. host of every app and of liveworkspace.app', () => {
    expect([...HTTPS_ONLY_HOSTS].sort()).toEqual(
      DOMAINS.flatMap((d) => [d, `www.${d}`, `staging.${d}`]).sort(),
    );
  });

  it.each(DOMAINS)(
    'sends http://www.%s to the same path and query over https in one 301',
    (domain) => {
      for (const method of ['GET', 'HEAD']) {
        for (const path of [
          '/',
          '/x?y=1',
          '/s/abc?view=present&x=%2F',
          '/api/things',
          '/.well-known/a',
        ]) {
          const res = answer(`http://www.${domain}${path}`, { method });
          expect(res?.status, path).toBe(301);
          expect(res?.headers.get('Location'), path).toBe(`https://www.${domain}${path}`);
          expect(res?.headers.get('Cache-Control')).toBe(WWW_REDIRECT_CACHE_CONTROL);
          expect(res?.body).toBeNull();
        }
      }
    },
  );

  it('keeps the host (bare and staging. included) and drops a port', () => {
    expect(answer('http://liveplanner.app/api/x')?.headers.get('Location')).toBe(
      'https://liveplanner.app/api/x',
    );
    expect(answer('http://staging.livedesign.app/a')?.headers.get('Location')).toBe(
      'https://staging.livedesign.app/a',
    );
    expect(answer('http://www.livedocuments.app:80/a?b=1')?.headers.get('Location')).toBe(
      'https://www.livedocuments.app/a?b=1',
    );
  });

  it('answers 308 for a method with a body, so a POST is never turned into a GET', () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
      const res = answer('http://www.liveworkspace.app/api/auth/sign-in', { method });
      expect(res?.status, method).toBe(308);
      expect(res?.headers.get('Location')).toBe('https://www.liveworkspace.app/api/auth/sign-in');
    }
  });

  it('treats a WebSocket upgrade over ws:// like any GET', () => {
    const res = answer('http://www.livehuddle.app/api/rooms/x', {
      headers: { Upgrade: 'websocket' },
    });
    expect(res?.status).toBe(301);
  });

  it('passes https through untouched, so following the redirect can never loop', () => {
    const to = answer('http://www.livediagram.app/x?y=1')!.headers.get('Location')!;
    expect(answer(to)).toBeNull();
    expect(answer('https://livediagram.app/')).toBeNull();
  });

  it('trusts Cloudflare when it marks the visit HTTPS, and ignores a malformed or other mark', () => {
    const marked = (value: string) =>
      answer('http://www.liveplanner.app/x', { headers: { 'CF-Visitor': value } });
    expect(marked('{"scheme":"https"}')).toBeNull();
    expect(marked('{"scheme":"http"}')?.status).toBe(301);
    expect(marked('not json')?.status).toBe(301);
    expect(marked('null')?.status).toBe(301);
  });

  it('never redirects local, test, workers.dev or look-alike hosts', () => {
    for (const host of [
      'localhost:3100',
      'app.localhost:3200',
      '127.0.0.1:3000',
      'livediagram.test',
      'www.livediagram.test',
      'livediagram-router.liveworkspace-easing509.workers.dev',
      'evil-liveplanner.app',
      'www.liveplanner.app.evil.com',
      'preview.livediagram.app',
    ]) {
      expect(answer(`http://${host}/x`), host).toBeNull();
    }
  });

  it('costs a set lookup on an HTTPS request', () => {
    const request = new Request('https://www.livediagram.app/x');
    const url = new URL(request.url);
    expect(
      cpuMsOf(() => {
        for (let i = 0; i < 10_000; i++) httpsRedirect(request, url);
      }),
    ).toBeLessThan(cpuBudgetMs(200));
  });

  it('is asked by every app’s router right after the bare domain’s redirect, never locally', () => {
    // Every app's router is the shared one (app-router.ts), bound to the app.
    for (const app of APP_NAMES) {
      const entry = readFileSync(
        new URL(`../../../${app}/apps/router/src/index.ts`, import.meta.url),
        'utf8',
      );
      expect(entry, app).toContain(`export default createAppRouter<`);
      expect(entry, app).toContain(`app: '${app}',`);
    }
    const router = readFileSync(new URL('./app-router.ts', import.meta.url), 'utf8');
    const route = router.slice(router.indexOf('async function route('));
    const www = route.indexOf('wwwRedirect(request, url');
    expect(www).toBeGreaterThan(0);
    const https = route.indexOf("env.DEPLOY_ENV === 'local' ? null : httpsRedirect(request, url)");
    expect(https).toBeGreaterThan(www);
    expect(route.indexOf('routeToWorkspace(')).toBeGreaterThan(https);
    expect(route.indexOf('forward(')).toBeGreaterThan(https);
  });
});

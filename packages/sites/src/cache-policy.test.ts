import { describe, expect, it } from 'vitest';
import {
  HTML_CACHE_CONTROL,
  IMMUTABLE_CACHE_CONTROL,
  applyCachePolicy,
  cacheRule,
  isBuildAsset,
} from './cache-policy';

// docs/specs/016-platform/stale-builds.md "Caching rules".

describe('isBuildAsset', () => {
  it.each([
    ['/live/_next/static/chunks/0abc.js', true],
    ['/_next/static/css/app.css', true],
    ['/help/_next/static/media/font.woff2', true],
    ['/telemetry/_next/static/chunks/x.js', true],
    ['/explorer/unsorted', false],
    ['/icon.svg', false],
    ['/_next/image', false],
    ['/static/_next/x', false],
  ])('%s → %s', (path, expected) => {
    expect(isBuildAsset(path)).toBe(expected);
  });
});

describe('cacheRule', () => {
  it('keeps every HTML page out of the cache', () => {
    expect(cacheRule('/explorer/unsorted', 200, 'text/html; charset=utf-8')).toBe('no-store');
    expect(cacheRule('/missing-page', 404, 'text/html')).toBe('no-store');
  });

  it('makes a build asset immutable, and a missing one an honest 404', () => {
    expect(cacheRule('/live/_next/static/chunks/a.js', 200, 'text/javascript')).toBe('immutable');
    expect(cacheRule('/live/_next/static/chunks/a.js', 304, null)).toBe('immutable');
    expect(cacheRule('/live/_next/static/css/a.css', 404, 'text/html')).toBe('missing-asset');
  });

  it('leaves everything else as it came', () => {
    expect(cacheRule('/icon.svg', 200, 'image/svg+xml')).toBe('unchanged');
    // Unhashed dev chunks (next dev, locally) keep their own caching.
    expect(
      cacheRule('/live/_next/static/chunks/a.js', 200, 'text/javascript', { hashedAssets: false }),
    ).toBe('unchanged');
    expect(
      cacheRule('/live/_next/static/css/a.css', 404, 'text/html', { hashedAssets: false }),
    ).toBe('missing-asset');
    expect(cacheRule('/live/_next/static/chunks/a.js', 500, 'text/plain')).toBe('unchanged');
  });

  it('uses the immutable year and no-store', () => {
    expect(IMMUTABLE_CACHE_CONTROL).toBe('public, max-age=31536000, immutable');
    expect(HTML_CACHE_CONTROL).toBe('no-store');
  });
});

describe('applyCachePolicy', () => {
  it('stamps no-store on a page, keeping its body and other headers', async () => {
    const page = new Response('<html></html>', {
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'public, max-age=0, must-revalidate',
        'X-A': 'b',
      },
    });
    const res = applyCachePolicy(page, '/explorer/unsorted');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(res.headers.get('X-A')).toBe('b');
    expect(await res.text()).toBe('<html></html>');
  });

  it('stamps immutable on a build asset', () => {
    const asset = new Response('x', { headers: { 'Content-Type': 'text/javascript' } });
    expect(
      applyCachePolicy(asset, '/live/_next/static/chunks/a.js').headers.get('Cache-Control'),
    ).toBe(IMMUTABLE_CACHE_CONTROL);
  });

  it('answers a missing build asset with plain text, never the HTML 404 page', async () => {
    const htmlNotFound = new Response('<html>404</html>', {
      status: 404,
      headers: { 'Content-Type': 'text/html' },
    });
    const res = applyCachePolicy(htmlNotFound, '/live/_next/static/css/old.css');
    expect(res.status).toBe(404);
    expect(res.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(await res.text()).toBe('Not found');
  });

  it('works on a response whose headers cannot change', () => {
    const redirect = Response.redirect('https://example.com/explorer/timeline', 302);
    expect(applyCachePolicy(redirect, '/explorer').headers.get('Location')).toBe(
      'https://example.com/explorer/timeline',
    );
  });

  it('leaves a WebSocket upgrade and anything unruled alone', () => {
    const upgrade = { status: 101, headers: new Headers() } as unknown as Response;
    expect(applyCachePolicy(upgrade, '/api/documents/d/ws')).toBe(upgrade);
    const icon = new Response('svg', { headers: { 'Content-Type': 'image/svg+xml' } });
    expect(applyCachePolicy(icon, '/icon.svg')).toBe(icon);
  });
});

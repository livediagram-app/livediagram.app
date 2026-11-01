import { describe, expect, it } from 'vitest';
import { BUILD_ID_HEADER, DOCUMENT_FORMAT, DOCUMENT_FORMAT_HEADER } from '@livediagram/api-schema';
import { withServerRelease } from './server-release-header';
import { CORS_HEADERS } from './responses';

// The server release signal (docs/specs/016-platform/new-version-prompt.md, docs/specs/016-platform/stale-builds.md):
// the document format number and the live build id on every response.
describe('withServerRelease', () => {
  it('stamps the format number and the build id on a response, keeping it otherwise', async () => {
    const res = withServerRelease(
      new Response('{"ok":true}', { status: 201, headers: { 'X-A': 'b' } }),
      'abc123',
    );
    expect(res.headers.get(DOCUMENT_FORMAT_HEADER)).toBe(String(DOCUMENT_FORMAT));
    expect(res.headers.get(BUILD_ID_HEADER)).toBe('abc123');
    expect(res.status).toBe(201);
    expect(res.headers.get('X-A')).toBe('b');
    expect(await res.text()).toBe('{"ok":true}');
  });

  it('leaves the build id off when the deploy set none, or set something unusable', () => {
    expect(withServerRelease(new Response(null), null).headers.has(BUILD_ID_HEADER)).toBe(false);
    expect(withServerRelease(new Response(null), 'bad id').headers.has(BUILD_ID_HEADER)).toBe(
      false,
    );
  });

  it('rebuilds a response whose headers cannot change', () => {
    const res = withServerRelease(Response.redirect('https://example.com/', 302), 'abc');
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('https://example.com/');
    expect(res.headers.get(DOCUMENT_FORMAT_HEADER)).toBe(String(DOCUMENT_FORMAT));
    expect(res.headers.get(BUILD_ID_HEADER)).toBe('abc');
  });

  it('leaves a WebSocket upgrade alone', () => {
    const upgrade = { status: 101, headers: new Headers() } as unknown as Response;
    expect(withServerRelease(upgrade, 'abc')).toBe(upgrade);
  });

  it('exposes both headers to cross-origin callers', () => {
    expect(CORS_HEADERS['Access-Control-Expose-Headers']).toContain(DOCUMENT_FORMAT_HEADER);
    expect(CORS_HEADERS['Access-Control-Expose-Headers']).toContain(BUILD_ID_HEADER);
  });
});

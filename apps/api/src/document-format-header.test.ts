import { describe, expect, it } from 'vitest';
import { DOCUMENT_FORMAT, DOCUMENT_FORMAT_HEADER } from '@livediagram/api-schema';
import { withDocumentFormat } from './document-format-header';
import { CORS_HEADERS } from './responses';

// docs/specs/016-platform/new-version-prompt.md "How a running editor learns the server's number".
describe('withDocumentFormat', () => {
  it('stamps the document format number on a response, keeping it otherwise', async () => {
    const res = withDocumentFormat(
      new Response('{"ok":true}', { status: 201, headers: { 'X-A': 'b' } }),
    );
    expect(res.headers.get(DOCUMENT_FORMAT_HEADER)).toBe(String(DOCUMENT_FORMAT));
    expect(res.status).toBe(201);
    expect(res.headers.get('X-A')).toBe('b');
    expect(await res.text()).toBe('{"ok":true}');
  });

  it('rebuilds a response whose headers cannot change', () => {
    const immutable = Response.redirect('https://example.com/', 302);
    const res = withDocumentFormat(immutable);
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('https://example.com/');
    expect(res.headers.get(DOCUMENT_FORMAT_HEADER)).toBe(String(DOCUMENT_FORMAT));
  });

  it('leaves a WebSocket upgrade alone', () => {
    const upgrade = { status: 101, headers: new Headers() } as unknown as Response;
    expect(withDocumentFormat(upgrade)).toBe(upgrade);
  });

  it('is exposed to cross-origin callers', () => {
    expect(CORS_HEADERS['Access-Control-Expose-Headers']).toContain(DOCUMENT_FORMAT_HEADER);
  });
});

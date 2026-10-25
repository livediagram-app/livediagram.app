import { describe, expect, it } from 'vitest';
import { PROJECT_CONVERSION_HEADER } from '@liveplanner/api-schema';
import { CORS_HEADERS, json } from './responses';

// The shared envelope and status codes are @liveworkspace/api-kit's, tested there. What is this api's own is its
// CORS allow-list, which every response carries, and the answers only it gives.

describe('json', () => {
  it("carries this api's CORS set on every response", () => {
    // The CORS preflight only succeeds when these headers are on EVERY response, not just the OPTIONS preflight.
    const res = json({ ok: true });
    for (const [key, value] of Object.entries(CORS_HEADERS)) {
      expect(res.headers.get(key), `missing ${key}`).toBe(value);
    }
  });
});

describe('CORS_HEADERS', () => {
  it('allows the custom headers the editor needs to send', () => {
    // Each of these headers must be in the Access-Control-Allow-
    // Headers list or the browser silently rejects the preflight
    // and the editor sees "Failed to fetch" with no other signal.
    // Pinning each one explicitly catches the next "remove one
    // accidentally" diff.
    const allowHeaders = CORS_HEADERS['Access-Control-Allow-Headers'];
    expect(allowHeaders).toContain('Authorization');
    expect(allowHeaders).toContain('X-Index-Grant');
    expect(allowHeaders).not.toContain('X-Owner-Id');
    expect(allowHeaders).toContain('X-Share-Code');
    expect(allowHeaders).not.toContain('X-Image');
    expect(allowHeaders).toContain('Content-Type');
  });

  it('allows the conversion header Take Offline and Sync Project send', () => {
    // Missing, a cross-origin editor (dev on its own port, or a deployment
    // with the api elsewhere) had both conversions fail at the preflight.
    expect(CORS_HEADERS['Access-Control-Allow-Headers']).toContain(PROJECT_CONVERSION_HEADER);
  });

  it('allows the five HTTP methods the live editor uses', () => {
    const methods = CORS_HEADERS['Access-Control-Allow-Methods'];
    expect(methods).toContain('GET');
    expect(methods).toContain('POST');
    expect(methods).toContain('PUT');
    expect(methods).toContain('DELETE');
    expect(methods).toContain('OPTIONS');
  });
});

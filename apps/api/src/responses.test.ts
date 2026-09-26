import { describe, expect, it } from 'vitest';
import {
  aiError,
  badRequest,
  CORS_HEADERS,
  forbidden,
  imagesUnavailable,
  json,
  methodNotAllowed,
  missingAuth,
  notFound,
  payloadTooLarge,
  rateLimited,
  signInRequired,
} from './responses';

// Every endpoint in the worker funnels its non-streaming responses
// through these helpers, so the error-body envelope shape + the
// status codes + the CORS allow-list are essentially the api's
// public contract. A regression here breaks the live editor's
// fetch-error handling in subtle ways (e.g. `error: 'forbidden'`
// becoming `error: 'Forbidden'` would slip past TypeScript on the
// client because the api-client only sees `Promise<Response>`,
// and the editor's "is this a permission issue?" check would
// quietly stop matching).

async function readJson(res: Response): Promise<unknown> {
  return JSON.parse(await res.text());
}

describe('json', () => {
  it('serialises the body to a JSON response with application/json content-type', async () => {
    const res = json({ hello: 'world' });
    expect(res.headers.get('Content-Type')).toBe('application/json');
    expect(await readJson(res)).toEqual({ hello: 'world' });
  });

  it('defaults to status 200 when no init is supplied', () => {
    expect(json({}).status).toBe(200);
  });

  it('respects a supplied status in the init', () => {
    expect(json({}, { status: 201 }).status).toBe(201);
  });

  it('always includes every CORS allow-list header on the response', () => {
    // The CORS preflight only succeeds when these headers are
    // present on EVERY response (not just the OPTIONS pre-flight).
    // Stripping one silently would break the live app's cross-
    // origin fetches in dev.
    const res = json({ ok: true });
    for (const [key, value] of Object.entries(CORS_HEADERS)) {
      expect(res.headers.get(key), `missing ${key}`).toBe(value);
    }
  });

  it('preserves caller-supplied headers alongside CORS + Content-Type', () => {
    const res = json({ ok: true }, { headers: { 'X-Custom': 'value' } });
    expect(res.headers.get('X-Custom')).toBe('value');
    expect(res.headers.get('Content-Type')).toBe('application/json');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });
});

describe('notFound', () => {
  it('returns a 404 with the canonical { error: "not_found" } envelope', async () => {
    const res = notFound();
    expect(res.status).toBe(404);
    expect(await readJson(res)).toEqual({ error: 'not_found' });
  });
});

describe('badRequest', () => {
  it('returns a 400 with the supplied message in the envelope', async () => {
    // The message is what the live editor surfaces to the user
    // for client-side validation failures, so the contract is
    // both status:400 AND `message` populated.
    const res = badRequest('missing tab id');
    expect(res.status).toBe(400);
    expect(await readJson(res)).toEqual({
      error: 'bad_request',
      message: 'missing tab id',
    });
  });
});

describe('methodNotAllowed', () => {
  it('returns a 405 with the canonical { error: "method_not_allowed" } envelope', async () => {
    const res = methodNotAllowed();
    expect(res.status).toBe(405);
    expect(await readJson(res)).toEqual({ error: 'method_not_allowed' });
  });
});

describe('forbidden', () => {
  it('returns a 403 with the canonical { error: "forbidden" } envelope', async () => {
    const res = forbidden();
    expect(res.status).toBe(403);
    expect(await readJson(res)).toEqual({ error: 'forbidden' });
  });

  it('names the specific rule in the error token when a reason is passed', async () => {
    // Keeps the 403 envelope uniform while letting the client branch
    // on which rule fired (teams: admin_required / not_your_invite).
    const res = forbidden('admin_required');
    expect(res.status).toBe(403);
    expect(await readJson(res)).toEqual({ error: 'admin_required' });
  });
});

describe('imagesUnavailable', () => {
  it('returns a 503 with the canonical { error: "images_unavailable" } envelope', async () => {
    // Surfaced when the R2 binding is unset (self-host without
    // R2). The 503 lets clients fall back gracefully rather than
    // treating it as a permanent server error.
    const res = imagesUnavailable();
    expect(res.status).toBe(503);
    expect(await readJson(res)).toEqual({ error: 'images_unavailable' });
  });
});

describe('rateLimited', () => {
  it('returns a 429 with the canonical { error: "rate_limited" } envelope', async () => {
    const res = rateLimited();
    expect(res.status).toBe(429);
    expect(await readJson(res)).toEqual({ error: 'rate_limited' });
  });
});

describe('payloadTooLarge', () => {
  it('returns a 413 with the canonical { error: "payload_too_large" } envelope', async () => {
    const res = payloadTooLarge();
    expect(res.status).toBe(413);
    expect(await readJson(res)).toEqual({ error: 'payload_too_large' });
  });
});

describe('aiError', () => {
  it('returns a 502 with the canonical { error: "ai_error" } envelope', async () => {
    const res = aiError();
    expect(res.status).toBe(502);
    expect(await readJson(res)).toEqual({ error: 'ai_error' });
  });
});

describe('signInRequired', () => {
  it('returns a 401 with the canonical { error: "sign_in_required" } envelope', async () => {
    const res = signInRequired();
    expect(res.status).toBe(401);
    expect(await readJson(res)).toEqual({ error: 'sign_in_required' });
  });
});

describe('missingAuth', () => {
  it('returns a 400 naming both legitimate identity sources in the message', async () => {
    // The message text is load-bearing for developer debugging:
    // pre-Clerk it just said "missing X-Owner-Id", which
    // misdirected signed-in users debugging auth failures. The
    // current copy names BOTH paths so the caller can tell which
    // one they're missing. Asserting the substrings rather than
    // exact equality keeps room for future polish.
    const res = missingAuth();
    expect(res.status).toBe(400);
    const body = (await readJson(res)) as { error: string; message: string };
    expect(body.error).toBe('bad_request');
    expect(body.message).toContain('Clerk Bearer token');
    expect(body.message).toContain('X-Owner-Id');
  });
});

describe('CORS_HEADERS', () => {
  it('allows the four custom headers the editor needs to send', () => {
    // Each of these headers must be in the Access-Control-Allow-
    // Headers list or the browser silently rejects the preflight
    // and the editor sees "Failed to fetch" with no other signal.
    // Pinning each one explicitly catches the next "remove one
    // accidentally" diff.
    const allowHeaders = CORS_HEADERS['Access-Control-Allow-Headers'];
    expect(allowHeaders).toContain('Authorization');
    expect(allowHeaders).toContain('X-Owner-Id');
    expect(allowHeaders).toContain('X-Share-Code');
    expect(allowHeaders).toContain('X-Image-Sha256');
    expect(allowHeaders).toContain('X-Image-Width');
    expect(allowHeaders).toContain('X-Image-Height');
    expect(allowHeaders).toContain('X-Image-Original-Name');
    expect(allowHeaders).toContain('Content-Type');
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

import { describe, expect, it } from 'vitest';
import { BASE_ALLOWED_HEADERS, corsHeaders, createResponses } from './responses';

const CORS_HEADERS = corsHeaders({ allowHeaders: ['X-Product-Client'], exposeHeaders: ['ETag'] });
const {
  badRequest,
  conflict,
  forbidden,
  json,
  methodNotAllowed,
  missingAuth,
  noContent,
  notFound,
  payloadTooLarge,
  rateLimited,
  signInRequired,
  svgImage,
  textPlain,
} = createResponses(CORS_HEADERS);

// Every endpoint in a product's api Worker funnels its non-streaming responses
// through these helpers, so the error-body envelope shape + the
// status codes + the CORS allow-list are essentially every api's
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

  it('is never reused by a browser without asking, unless the route chooses a policy', () => {
    expect(json({}).headers.get('Cache-Control')).toBe('no-cache');
    expect(json({ error: 'document_trashed' }, { status: 410 }).headers.get('Cache-Control')).toBe(
      'no-cache',
    );
    const chosen = json({}, { headers: { 'Cache-Control': 'public, max-age=300' } });
    expect(chosen.headers.get('Cache-Control')).toBe('public, max-age=300');
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
    // Stripping one silently would break the editor app's cross-
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

describe('signInRequired', () => {
  it('returns a 401 with the canonical { error: "sign_in_required" } envelope', async () => {
    const res = signInRequired();
    expect(res.status).toBe(401);
    expect(await readJson(res)).toEqual({ error: 'sign_in_required' });
  });
});

describe('missingAuth', () => {
  it('returns a 400 naming every identity a caller may send', async () => {
    // The message text is load-bearing for developer debugging: it names every Bearer the api accepts, so the
    // caller can tell which one they're missing. Asserting the substrings rather than exact equality keeps room
    // for future polish.
    const res = missingAuth();
    expect(res.status).toBe(400);
    const body = (await readJson(res)) as { error: string; message: string };
    expect(body.error).toBe('bad_request');
    expect(body.message).toContain('account access token');
    expect(body.message).toContain('guest token');
    expect(body.message).toContain('API token');
  });
});

// A same-origin SVG opened directly is a document; it must not run script.
describe('svgImage', () => {
  it('sandboxes the SVG and forbids sniffing', () => {
    const res = svgImage('<svg/>', 'no-store');
    expect(res.headers.get('Content-Type')).toBe('image/svg+xml; charset=utf-8');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    const csp = res.headers.get('Content-Security-Policy')!;
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain('sandbox');
    expect(csp).not.toContain('script-src');
  });
});

describe('textPlain and noContent', () => {
  it('carry the CORS set: text with no-cache, a 204 with no body', async () => {
    const text = textPlain('outline', { status: 200 });
    expect(text.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');
    expect(text.headers.get('Cache-Control')).toBe('no-cache');
    expect(text.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(await text.text()).toBe('outline');
    const none = noContent();
    expect(none.status).toBe(204);
    expect(none.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(await none.text()).toBe('');
  });
});

describe('conflict', () => {
  it('returns a 409 naming the rule that fired', async () => {
    const res = conflict('last_admin');
    expect(res.status).toBe(409);
    expect(await readJson(res)).toEqual({ error: 'last_admin' });
  });
});

describe('corsHeaders', () => {
  it("allows every product's headers, then the product's own, and exposes what it names", () => {
    const allow = CORS_HEADERS['Access-Control-Allow-Headers']!.split(', ');
    expect(allow).toEqual([...BASE_ALLOWED_HEADERS, 'X-Product-Client']);
    for (const h of ['Authorization', 'Content-Type', 'X-Index-Grant', 'X-Share-Code'])
      expect(allow).toContain(h);
    expect(allow).not.toContain('X-Owner-Id');
    expect(CORS_HEADERS['Access-Control-Expose-Headers']).toBe('ETag');
  });

  it('allows the five HTTP methods the editors use', () => {
    const methods = CORS_HEADERS['Access-Control-Allow-Methods'];
    for (const m of ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']) expect(methods).toContain(m);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the async deps the request path touches before dispatch, so the worker's front-door gates run alone.
// `Bearer guest-token:<id>` stands in for a verified guest token.
vi.mock('./auth/accounts', () => ({
  getPersonIdentity: async (_env: unknown, request: Request) => {
    const bearer = request.headers.get('Authorization') ?? '';
    return bearer.startsWith('Bearer guest-token:')
      ? { kind: 'guest', guestId: bearer.slice('Bearer guest-token:'.length) }
      : null;
  },
  accountCredentials: () => null,
}));
const { resolveApiTokenMock } = vi.hoisted(() => ({ resolveApiTokenMock: vi.fn() }));
vi.mock('./db', () => ({
  resolveApiToken: resolveApiTokenMock,
  listDocumentsByOwner: async () => [],
}));

const { handleDocumentsMock } = vi.hoisted(() => ({
  handleDocumentsMock: vi.fn(async () => new Response(null, { status: 204 })),
}));
vi.mock('./routes/documents', () => ({ handleDocuments: handleDocumentsMock }));

import worker from './index';
import type { RouteContext } from './routes/context';
import type { Env } from './types';

function env(): Env {
  return {} as unknown as Env;
}
function get(path: string, headers: Record<string, string> = {}): Request {
  return new Request(`https://api.test${path}`, { method: 'GET', headers });
}

// A guest is who their guest token says (liveworkspace/docs/specs/003-accounts/accounts.md "Guests"); nothing a request names in a
// header makes anyone a guest.
describe('worker guest identity', () => {
  beforeEach(() => resolveApiTokenMock.mockResolvedValue(null));

  it("keys a guest's writes on their guest id", async () => {
    const limit = vi.fn(async () => ({ success: false }));
    const res = await worker.fetch(
      new Request('https://api.test/api/folders', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer guest-token:guest_1',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'f' }),
      }),
      { WRITE_RATE_LIMITER: { limit } } as unknown as Env,
    );
    expect(res.status).toBe(429);
    expect(limit).toHaveBeenCalledWith({ key: 'guest_1' });
  });

  it('reads a request with no token as no one, whatever header it sends', async () => {
    const res = await worker.fetch(
      new Request('https://x.test/api/folders', { headers: { 'X-Owner-Id': 'guest_1' } }),
      env(),
    );
    expect(res.status).toBe(400);
    expect(JSON.stringify(await res.json())).toContain('authentication required');
  });

  it('does not touch a Bearer caller, whose owner id IS an account id', async () => {
    resolveApiTokenMock.mockResolvedValue({
      ownerId: 'user_2abcDEF',
      tokenId: 'tok-1',
      readOnly: false,
    });
    const res = await worker.fetch(
      get('/api/documents', { Authorization: `Bearer lwt_${'a'.repeat(40)}` }),
      env(),
    );
    expect(res.status).not.toBe(401);
  });
});

const LVD = `lwt_${'a'.repeat(40)}`;

describe('read-only API token enforcement (docs/specs/015-api/public-api-and-tokens.md)', () => {
  beforeEach(() => {
    resolveApiTokenMock.mockReset();
    resolveApiTokenMock.mockResolvedValue({
      ownerId: 'user_ro',
      tokenId: 'tok-ro',
      readOnly: true,
    });
  });

  const RO = { Authorization: `Bearer ${LVD}` };
  const req = (method: string) =>
    new Request('https://api.test/api/documents', { method, headers: RO });

  it('403s a POST from a read-only token', async () => {
    const res = await worker.fetch(req('POST'), env());
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'read_only_token' });
  });

  it('403s a PUT from a read-only token', async () => {
    const res = await worker.fetch(
      new Request('https://api.test/api/documents/d1', { method: 'PUT', headers: RO }),
      env(),
    );
    expect(res.status).toBe(403);
  });

  it('403s a DELETE from a read-only token', async () => {
    const res = await worker.fetch(
      new Request('https://api.test/api/documents/d1', { method: 'DELETE', headers: RO }),
      env(),
    );
    expect(res.status).toBe(403);
  });

  it('403s the share-link list, which holds every code and the password', async () => {
    // A read-only token must not be able to lift an edit link.
    const res = await worker.fetch(
      new Request('https://api.test/api/documents/d1/share', { headers: RO }),
      env(),
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'read_only_token' });
  });

  it('lets a read-only token revoke itself, and only itself', async () => {
    const self = await worker.fetch(
      new Request('https://api.test/api/tokens/current', { method: 'DELETE', headers: RO }),
      env(),
    );
    expect(self.status).not.toBe(403);
    const other = await worker.fetch(
      new Request('https://api.test/api/tokens/tok-other', { method: 'DELETE', headers: RO }),
      env(),
    );
    expect(other.status).toBe(403);
  });

  // livehuddle has no workbenches, MCP server or CLI (docs/specs/002-project-scope/not-in-livehuddle.md): their
  // doors are gone, never forwarded to liveworkspace.
  it('answers 404 for the workbench and OAuth exchange doors', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    try {
      for (const path of ['/api/workbench/pairings', '/api/oauth/exchange']) {
        const res = await worker.fetch(new Request(`https://api.test${path}`, { headers: RO }), {
          ...env(),
          ACCOUNTS_URL: 'https://accounts.test',
        });
        expect(res.status, path).toBe(404);
      }
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('lets a GET through (reads are allowed)', async () => {
    const res = await worker.fetch(req('GET'), env());
    expect(res.status).not.toBe(403);
  });

  it('does NOT block a full (read+write) token', async () => {
    resolveApiTokenMock.mockResolvedValue({
      ownerId: 'user_rw',
      tokenId: 'tok-rw',
      readOnly: false,
    });
    const res = await worker.fetch(req('POST'), env());
    expect(res.status).not.toBe(403);
  });
});

// An `lwt_` bearer is a claim to be a token; one that resolves to no live row (unknown, revoked or expired) is
// refused at the front door with 401 `invalid_token`, never treated as a guest or as nobody
// (docs/specs/015-api/public-api-and-tokens.md §3.3).
describe('worker refusal of an unknown API token', () => {
  const TOKEN = `lwt_${'x'.repeat(43)}`;
  beforeEach(() => resolveApiTokenMock.mockResolvedValue(null));

  it('401s an lwt_ bearer that resolves to no live token, on owner-scoped and token routes alike', async () => {
    for (const path of ['/api/documents', '/api/tokens/current', '/api/teams']) {
      const res = await worker.fetch(get(path, { Authorization: `Bearer ${TOKEN}` }), env());
      expect(res.status, path).toBe(401);
      expect(await res.json(), path).toEqual({ error: 'invalid_token' });
      expect(res.headers.get('WWW-Authenticate'), path).toBe('Bearer error="invalid_token"');
    }
  });

  it('refuses a token cut short or mistyped as a token, not as a request with no credential', async () => {
    for (const bearer of ['lwt_', 'lwt_notreal', `lwt_${'x'.repeat(12)}`]) {
      const res = await worker.fetch(
        get('/api/documents', { Authorization: `Bearer ${bearer}` }),
        env(),
      );
      expect(res.status, bearer).toBe(401);
      expect(await res.json(), bearer).toEqual({ error: 'invalid_token' });
    }
  });

  it('leaves a bearer that is not token-shaped to the account path', async () => {
    const res = await worker.fetch(
      get('/api/documents', { Authorization: 'Bearer eyJ.jwt.sig' }),
      env(),
    );
    expect(res.status).not.toBe(401);
  });
});

// Room-ticket mints skip the per-owner write budget (autosave shares it), but
// each is a D1 write, so they have their own bucket keyed on the network.
describe('worker room-ticket throttle', () => {
  beforeEach(() => resolveApiTokenMock.mockResolvedValue(null));

  it('429s a mint once the per-network bucket is spent, keyed on the /64', async () => {
    const limit = vi.fn(async () => ({ success: false }));
    const res = await worker.fetch(
      new Request('https://api.test/api/documents/d1/room-ticket', {
        method: 'POST',
        headers: { 'CF-Connecting-IP': '2001:db8:0:1::9' },
      }),
      { WRITE_RATE_LIMITER: { limit } } as unknown as Env,
    );
    expect(res.status).toBe(429);
    expect(limit).toHaveBeenCalledWith({ key: 'room-ticket:2001:0db8:0000:0001::/64' });
  });
});

// API tokens carried over from the old livehuddle.app (docs/migration.md step 1.5, @liveworkspace/api-kit api-token.ts): `lvd_`
// takes the token path as `lwt_` does.
describe('carried-over lvd_ API tokens', () => {
  beforeEach(() => {
    resolveApiTokenMock.mockReset();
    resolveApiTokenMock.mockResolvedValue({
      ownerId: 'user_old',
      tokenId: 'tok-old',
      readOnly: false,
    });
  });

  it('resolves a well-formed lvd_ token as the token it is', async () => {
    const token = `lvd_${'b'.repeat(43)}`;
    const res = await worker.fetch(
      get('/api/documents', { Authorization: `Bearer ${token}` }),
      env(),
    );
    expect(res.status).not.toBe(401);
    expect(resolveApiTokenMock).toHaveBeenCalledWith(expect.anything(), token);
  });

  it('refuses a cut-short lvd_ bearer as a token, never reading it as anyone else', async () => {
    const res = await worker.fetch(
      get('/api/documents', { Authorization: 'Bearer lvd_short' }),
      env(),
    );
    expect(res.status).toBe(401);
    expect(resolveApiTokenMock).not.toHaveBeenCalled();
  });
});

// The body cap (docs/specs/015-api/api.md "Rate limiting") holds whatever the headers say: a chunked body declares
// no Content-Length (Number(null) is 0, which used to pass), so the gate counts the bytes it reads.
describe('the write body cap', () => {
  // A body of `chunks` pieces of `size` bytes that declares no length, as a chunked upload does.
  const chunkedPut = (chunks: number, size: number, extra: Record<string, string> = {}) => {
    let sent = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (sent === chunks) return controller.close();
        sent++;
        controller.enqueue(new TextEncoder().encode('x'.repeat(size)));
      },
    });
    return new Request('https://api.test/api/documents/doc1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...extra },
      body,
      duplex: 'half',
    } as RequestInit);
  };

  beforeEach(() => {
    resolveApiTokenMock.mockResolvedValue(null);
    handleDocumentsMock.mockClear();
  });

  it('refuses a chunked body past MAX_BODY_BYTES with 413 before any route reads it', async () => {
    const request = chunkedPut(9, 1024 * 1024);
    expect(request.headers.get('content-length')).toBeNull();
    const res = await worker.fetch(request, env());
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: 'payload_too_large' });
    expect(handleDocumentsMock).not.toHaveBeenCalled();
  });

  it('still refuses a declared Content-Length past the cap without reading', async () => {
    const res = await worker.fetch(
      new Request('https://api.test/api/documents/doc1', {
        method: 'PUT',
        headers: { 'Content-Length': String(9 * 1024 * 1024) },
        body: '{}',
      }),
      env(),
    );
    expect(res.status).toBe(413);
    expect(handleDocumentsMock).not.toHaveBeenCalled();
  });

  it('hands a body under the cap to the route unchanged, chunked or not', async () => {
    const seen: string[] = [];
    handleDocumentsMock.mockImplementation((async (ctx: RouteContext) => {
      seen.push(await ctx.request.text());
      return new Response(null, { status: 204 });
    }) as never);
    const chunked = await worker.fetch(chunkedPut(3, 4), env());
    const declared = await worker.fetch(
      new Request('https://api.test/api/documents/doc1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Roadmap' }),
      }),
      env(),
    );
    expect([chunked.status, declared.status]).toEqual([204, 204]);
    expect(seen).toEqual(['x'.repeat(12), JSON.stringify({ name: 'Roadmap' })]);
    handleDocumentsMock.mockImplementation(async () => new Response(null, { status: 204 }));
  });
});
